import { test, expect, chromium } from '@playwright/test';
const baseURL = process.env.BROWSERCEPTION_URL || 'http://localhost:5173';

test('two complete journeys, direct screen click, keyboard return, resize, controls, GPU reuse', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await expect(page.locator('#enter')).toBeEnabled();
  await page.screenshot({ path: 'docs/screenshots/01-ordinary.jpg' });
  let resourceCount = 0;
  for (let loop = 0; loop < 2; loop++) {
    await page.locator('#enter').click();
    await expect(page.locator('body')).toHaveAttribute('data-stage', 'fracture');
    if (loop === 0) {
      await page.waitForTimeout(1600);
      await page.screenshot({ path: 'docs/screenshots/02-fracture.jpg' });
    }
    await expect(page.locator('body')).toHaveAttribute('data-stage', 'descent');
    if (loop === 1) {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.locator('#motion').click();
      await expect(page.locator('#motion')).toHaveAttribute('aria-pressed', 'true');
      await page.waitForTimeout(500);
    }
    await page.mouse.move(1000, 350);
    await page.mouse.wheel(0, 650);
    await page.locator('#continue').click();
    await page.waitForTimeout(1200);
    if (loop === 0) await page.screenshot({ path: 'docs/screenshots/03-descent.jpg' });
    for (let i = 0; i < 5; i++) await page.locator('#continue').click();
    await expect(page.locator('body')).toHaveAttribute('data-stage', 'revelation');
    if (loop === 0) {
      resourceCount = Number(await page.locator('#world').getAttribute('data-textures'));
      await page.screenshot({ path: 'docs/screenshots/04-revelation.jpg' });
      await page.mouse.click(720, 450);
    } else {
      expect(Number(await page.locator('#world').getAttribute('data-textures'))).toBeLessThanOrEqual(resourceCount);
      await page.locator('#return').press('Enter');
    }
    await expect(page.locator('body')).toHaveAttribute('data-stage', 'loop');
    if (loop === 0) {
      await page.waitForTimeout(2900);
      await page.screenshot({ path: 'docs/screenshots/05-loop.jpg' });
    }
    await expect(page.locator('body')).toHaveAttribute('data-stage', 'ordinary');
    await expect(page.locator('#enter')).toBeEnabled();
    if (await page.locator('#world').getAttribute('data-loops') !== null) {
      await expect(page.locator('#world')).toHaveAttribute('data-loops', String(loop + 1));
    }
  }
  await page.locator('#sound').click();
  await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('m');
  await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#enter')).toBeEnabled();
  await page.locator('#enter').click();
  await expect(page.locator('body')).toHaveAttribute('data-stage', 'fracture');
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).toHaveAttribute('data-stage', 'ordinary');
  expect(errors).toEqual([]);
});

test('mobile touch journey and responsive controls', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(baseURL);
  await expect(page.locator('#enter')).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'docs/screenshots/06-mobile.jpg' });
  await page.locator('#enter').tap();
  await expect(page.locator('body')).toHaveAttribute('data-stage', 'descent');
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 190, y: 600 }] });
  for (const y of [540, 470, 400, 330]) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 190, y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'docs/screenshots/07-mobile-descent.jpg' });
  for (let i = 0; i < 5; i++) await page.locator('#continue').tap();
  await expect(page.locator('body')).toHaveAttribute('data-stage', 'revelation');
  await page.screenshot({ path: 'docs/screenshots/08-mobile-monitor.jpg' });
  await page.locator('#return').tap();
  await expect(page.locator('body')).toHaveAttribute('data-stage', 'ordinary');
  await expect(page.locator('#enter')).toBeEnabled();
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(400);
  for (const selector of ['#enter', '#controls']) {
    const rect = await page.locator(selector).boundingBox();
    expect(rect!.y).toBeGreaterThanOrEqual(0);
    expect(rect!.y + rect!.height).toBeLessThanOrEqual(390);
  }
  await page.screenshot({ path: 'docs/screenshots/09-mobile-landscape.jpg' });
  expect(errors).toEqual([]);
  await context.close();
});

test('OS motion preference and recovery from a lost graphics context', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(baseURL);
  await expect(page.locator('#enter')).toBeEnabled();
  await expect(page.locator('#motion')).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('#world')!;
    canvas.getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext();
  });
  await expect(page.locator('#fallback')).toBeVisible();
  await expect(page.locator('#fallback')).toContainText('interrupted');
  await page.locator('#retry').click();
  await expect(page.locator('#fallback')).toBeHidden();
  await expect(page.locator('#enter')).toBeEnabled();
  await context.close();
});

test('WebGL unavailable preserves readable page and reports the limitation', async () => {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined, headless: true, args: ['--disable-webgl'] });
  const page = await browser.newPage();
  await page.goto(baseURL);
  await expect(page.locator('#fallback')).toContainText('WebGL 2');
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('#enter')).toBeDisabled();
  await page.screenshot({ path: 'docs/screenshots/10-webgl-fallback.jpg' });
  await browser.close();
});
