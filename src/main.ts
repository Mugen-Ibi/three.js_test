import './style.css';
import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import fontData from 'three/examples/fonts/helvetiker_bold.typeface.json';
import { World } from './world';
import { Surface } from './surface';
import { Soundscape } from './audio';
import { Journey, clamp, smooth, smoother, easeInOut } from './timeline';
import type { Stage } from './timeline';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('world');
const home = $('ordinary');
const enter = $<HTMLButtonElement>('enter');
const journeyUI = $('journey-ui');
const soundButton = $<HTMLButtonElement>('sound');
const motionButton = $<HTMLButtonElement>('motion');
const continueButton = $<HTMLButtonElement>('continue');
const returnButton = $<HTMLButtonElement>('return');
const sound = new Soundscape();
const mediaMotion = matchMedia('(prefers-reduced-motion: reduce)');
let reduced = mediaMotion.matches;
let motionOverride = false;
let muted = true;
let motionAmount = reduced ? 0 : 1;
let ready = false;
let busy = false;
let entryPending = false;
let world: World | undefined;
let renderer: THREE.WebGLRenderer | undefined;
let surface: Surface | undefined;
let frame = 0;
let resizeTimer = 0;
let lastTime = performance.now();
let worldTime = 0;
let slowFrames = 0;
let diagnosticAt = 0;
let averageFrame = 1 / 60;
let quality = innerWidth < 700 ? 1.25 : Math.min(devicePixelRatio, 1.65);
const pointer = new THREE.Vector2();
const smoothPointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const scene = new THREE.Scene();
scene.background = new THREE.Color('#e9e8e2');
scene.fog = new THREE.Fog('#e9e8e2', 55, 180);
const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, .08, 280);
camera.position.set(0, 0, 12);
const rail = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, -.6, -14),
  new THREE.Vector3(5, 0, -39),
  new THREE.Vector3(-5, 3.7, -66),
  new THREE.Vector3(6, 1.2, -93),
  new THREE.Vector3(-6, 3, -120),
  new THREE.Vector3(0, 2, -158),
], false, 'catmullrom', .35);
const railPosition = new THREE.Vector3();
const lookPosition = new THREE.Vector3();
const loopFrom = new THREE.Vector3();
const loopQuaternion = new THREE.Quaternion();
const straightQuaternion = new THREE.Quaternion();
const light = new THREE.DirectionalLight('#ffffff', 3.2);
light.position.set(-22, 40, 18);
light.castShadow = true;
light.shadow.mapSize.set(2048, 2048);
Object.assign(light.shadow.camera, { left: -52, right: 52, top: 48, bottom: -35, near: .5, far: 125 });
light.shadow.bias = -.0005;
light.shadow.normalBias = .04;
scene.add(light, light.target, new THREE.HemisphereLight('#ffffff', '#888888', 2.1));

const stageCopy: Record<Stage, [string, string, string]> = {
  ordinary: ['', '', ''],
  fracture: ['02 / THE FRACTURE', 'The surface gives way.', 'EVERY WINDOW HAS AN INSIDE'],
  descent: ['03 / THE DESCENT', 'You are inside the page.', 'MOVE TO LOOK · SCROLL TO TRAVEL'],
  revelation: ['04 / THE REVELATION', 'Haven’t you been here before?', 'CLICK THE SCREEN · OR PRESS ENTER'],
  loop: ['05 / THE LOOP', 'There is no outside.', 'RETURNING TO THE BEGINNING'],
};
const journey = new Journey(onStageChange);

function onStageChange(stage: Stage) {
  document.body.dataset.stage = stage;
  if (import.meta.env.DEV) canvas.dataset.loops = String(journey.loopCount);
  const ordinary = stage === 'ordinary';
  home.style.opacity = ordinary ? '1' : '0';
  home.style.pointerEvents = ordinary ? 'auto' : 'none';
  home.inert = !ordinary;
  journeyUI.hidden = ordinary;
  $('act-label').textContent = stageCopy[stage][0];
  $('act-title').textContent = stageCopy[stage][1];
  $('travel-hint').textContent = stageCopy[stage][2];
  $('status').textContent = ordinary ? 'Back at the surface. Enter to explore again.' : stageCopy[stage][1];
  continueButton.hidden = stage !== 'descent';
  returnButton.hidden = stage !== 'revelation';
  canvas.style.cursor = '';
  if (surface) surface.root.visible = stage === 'fracture';
  if (stage === 'ordinary') {
    $('controls').style.opacity = '1';
    $('controls').inert = false;
    journeyUI.inert = false;
    journeyUI.style.opacity = '1';
    camera.position.set(0, 0, 12);
    camera.quaternion.identity();
    // The page stays pixel-identical at the landing. The second-loop change lives in the world.
    enter.disabled = false;
    ready = false;
    // Rebuild only when needed; dispose previous texture after the replacement exists.
    void refreshSurface().then(() => enter.focus({ preventScroll: true }));
  }
  if (stage === 'revelation') { sound.cue('reveal'); returnButton.focus({ preventScroll: true }); }
  if (stage === 'loop') {
    loopFrom.copy(camera.position);
    loopQuaternion.copy(camera.quaternion);
    sound.cue('loop');
  }
}

function showError(message: string) {
  $('fallback-message').textContent = message;
  $('fallback').hidden = false;
  enter.disabled = true;
}

async function refreshSurface() {
  if (!surface) return;
  busy = true;
  try {
    const texture = await surface.capture(camera);
    if (world) world.setHomepage(texture, camera.aspect);
    else world = new World(scene, new FontLoader().parse(fontData), texture, camera.aspect);
    ready = true;
    $('fallback').hidden = true;
    enter.disabled = false;
  } catch (error) {
    console.error('Surface preparation failed', error);
    showError('The page could not be prepared. Please retry to enter.');
  } finally { busy = false; }
}

async function begin(event?: MouseEvent) {
  if (journey.stage !== 'ordinary' || busy || entryPending) return;
  entryPending = true;
  try {
    await sound.unlock();
    home.classList.add('preparing');
    await refreshSurface();
    if (!ready || !surface) return;
    surface.setOrigin((event?.clientX || innerWidth / 2) / innerWidth, (event?.clientY || innerHeight * .75) / innerHeight);
    journey.enter();
    sound.cue('enter');
  } finally { home.classList.remove('preparing'); entryPending = false; }
}

function updateSettings() {
  sound.setMuted(muted);
  soundButton.setAttribute('aria-pressed', String(!muted));
  $('sound-label').textContent = muted ? 'SOUND OFF' : 'SOUND ON';
  motionButton.setAttribute('aria-pressed', String(reduced));
  $('motion-label').textContent = reduced ? 'GENTLE MOTION' : 'REDUCE MOTION';
  document.body.classList.toggle('gentle', reduced);
  if (reduced) home.style.setProperty('--arrow-offset', '0px');
  // The monitor reflects current user settings as well as the page layout.
  if (ready && !busy) void refreshSurface();
}

function updateCamera() {
  const stage = journey.stage;
  if (stage === 'ordinary') return;
  if (stage === 'fracture') {
    const t = clamp(journey.elapsed / 4.8);
    // First perceive the thickness. Only then cross the page's original plane.
    const flight = smoother((t - .32) / .68);
    camera.position.set(Math.sin(t * Math.PI) * .55 * motionAmount, -.6 * flight, 12 - 26 * flight);
    camera.lookAt(0, -.6 * flight, -28);
    camera.rotateZ(Math.sin(t * Math.PI) * -.032 * motionAmount);
    surface?.update(smooth(t / .83), worldTime, motionAmount);
  } else if (stage === 'descent') {
    const p = smoother(journey.progress);
    rail.getPoint(p, railPosition);
    // Blend gently to a straight route when the preference changes during travel.
    railPosition.lerp(new THREE.Vector3(0, THREE.MathUtils.lerp(-.6, 2, p), THREE.MathUtils.lerp(-14, -158, p)), 1 - motionAmount);
    camera.position.copy(railPosition);
    const settle = 1 - smooth((p - .82) / .18);
    camera.position.x += smoothPointer.x * 1.6 * settle * motionAmount;
    camera.position.y += smoothPointer.y * .7 * settle * motionAmount;
    rail.getPoint(Math.min(1, p + .06), lookPosition);
    lookPosition.z -= 15;
    lookPosition.lerp(new THREE.Vector3(0, camera.position.y, camera.position.z - 20), 1 - motionAmount);
    lookPosition.x += smoothPointer.x * 4 * settle * motionAmount;
    lookPosition.y += smoothPointer.y * 2 * settle * motionAmount;
    lookPosition.lerp(new THREE.Vector3(0, 2, -175), smooth((p - .8) / .2));
    camera.lookAt(lookPosition);
    camera.rotateZ(Math.sin(p * Math.PI * 2) * .035 * settle * motionAmount);
  } else if (stage === 'revelation') {
    camera.position.set(0, 2, -158);
    camera.quaternion.identity();
  } else if (stage === 'loop') {
    const t = clamp(journey.elapsed / 3.6);
    const p = easeInOut(t);
    const exactFitDistance = 2.7 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.copy(loopFrom).lerp(new THREE.Vector3(0, 2, -174.996 + exactFitDistance), p);
    camera.quaternion.copy(loopQuaternion).slerp(straightQuaternion, smooth(t * 2));
    // Chrome leaves with the bezel. The underlying screen remains opaque throughout.
    journeyUI.style.opacity = String(1 - smooth((t - .25) / .45));
    $('controls').style.opacity = String(1 - smooth(t / .25));
  }
  if (stage !== 'loop') { journeyUI.style.opacity = '1'; $('controls').style.opacity = '1'; }
  if (stage === 'fracture') {
    const reveal = smooth((journey.elapsed - 2.2) / 1.3);
    journeyUI.style.opacity = String(reveal);
    $('controls').style.opacity = String(reveal);
    journeyUI.inert = reveal < .1;
  } else journeyUI.inert = false;
  $('controls').inert = stage === 'fracture' || stage === 'loop';
}

function animate(now: number) {
  frame = requestAnimationFrame(animate);
  const rawDt = (now - lastTime) / 1000;
  lastTime = now;
  if (document.hidden || !renderer) return;
  const dt = Math.min(rawDt, .05);
  worldTime += dt;
  if (journey.stage === 'ordinary') return;
  journey.tick(dt, reduced);
  motionAmount += ((reduced ? 0 : 1) - motionAmount) * (1 - Math.exp(-dt * 2));
  smoothPointer.lerp(pointer, 1 - Math.exp(-dt * 4));
  updateCamera();
  world?.update(worldTime, journey.progress, smoothPointer, reduced, journey.loopCount);
  light.position.set(camera.position.x - 25, 40, camera.position.z + 18);
  light.target.position.set(camera.position.x, -5, camera.position.z - 32);
  sound.update(journey.progress, journey.stage);
  $('progress-fill').style.width = `${journey.stage === 'fracture' ? 3 : journey.stage === 'loop' ? 100 : 8 + journey.progress * 84}%`;
  $('depth-label').textContent = `DEPTH ${String(Math.round(Math.max(0, 12 - camera.position.z))).padStart(3, '0')}`;
  if (journey.stage === 'descent') {
    const echo = journey.progress > .51 && journey.progress < .72;
    $('act-title').textContent = echo ? 'Even your cursor is inside.' : 'You are inside the page.';
  }
  renderer.render(scene, camera);
  if (import.meta.env.DEV && now - diagnosticAt > 1000) {
    diagnosticAt = now;
    Object.assign(canvas.dataset, {
      loops: String(journey.loopCount),
      drawCalls: String(renderer.info.render.calls),
      geometries: String(renderer.info.memory.geometries),
      textures: String(renderer.info.memory.textures),
      fps: String(Math.round(1 / averageFrame)),
      dpr: quality.toFixed(2),
    });
  }
  averageFrame += (Math.min(rawDt, .1) - averageFrame) * .03;
  // Sustained slow frames reduce pixel cost without changing the composition.
  if (rawDt > .026 && rawDt < .2) slowFrames++; else slowFrames = Math.max(0, slowFrames - 1);
  if (slowFrames > 90 && quality > .8) {
    quality = Math.max(.8, quality - .2);
    renderer.setPixelRatio(quality);
    if (quality < 1.1) renderer.shadowMap.enabled = false;
    slowFrames = 0;
  }
}

async function initialize() {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(quality);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = innerWidth > 700;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    surface = new Surface(scene, home);
    await refreshSurface();
    renderer.compile(scene, camera);
    renderer.render(scene, camera);
    frame = requestAnimationFrame(animate);
  } catch (error) {
    console.error('WebGL initialization failed', error);
    showError('This experience needs WebGL 2. Try a current browser with graphics acceleration enabled.');
  }
}

enter.addEventListener('click', (e) => void begin(e));
enter.addEventListener('pointerenter', () => sound.cue('hover'));
soundButton.addEventListener('click', () => { muted = !muted; updateSettings(); void sound.unlock(); });
motionButton.addEventListener('click', () => { reduced = !reduced; motionOverride = true; updateSettings(); });
mediaMotion.addEventListener('change', (event) => { if (!motionOverride) { reduced = event.matches; updateSettings(); } });
continueButton.addEventListener('click', () => journey.travel(.19));
returnButton.addEventListener('click', () => journey.return());
$('exit').addEventListener('click', () => journey.reset());
$('retry').addEventListener('click', () => { if (!renderer) location.reload(); else void refreshSurface(); });

window.addEventListener('pointermove', (event) => {
  pointer.set(event.clientX / innerWidth * 2 - 1, 1 - event.clientY / innerHeight * 2);
  if (journey.stage === 'ordinary' && !reduced) home.style.setProperty('--arrow-offset', `${pointer.x * 5}px`);
  if (journey.stage === 'revelation' && world) {
    raycaster.setFromCamera(pointer, camera);
    canvas.style.cursor = raycaster.intersectObject(world.monitorScreen).length ? 'pointer' : '';
  }
});
canvas.addEventListener('click', (event) => {
  if (journey.stage !== 'revelation' || !world) return;
  raycaster.setFromCamera(new THREE.Vector2(event.clientX / innerWidth * 2 - 1, 1 - event.clientY / innerHeight * 2), camera);
  if (raycaster.intersectObject(world.monitorScreen).length) journey.return();
});
window.addEventListener('wheel', (event) => {
  if (journey.stage !== 'descent') return;
  event.preventDefault();
  const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
  journey.travel(clamp(pixels / 4000, -.12, .12));
}, { passive: false });
let touchY: number | null = null;
canvas.addEventListener('pointerdown', (event) => { if (event.pointerType === 'touch') touchY = event.clientY; });
canvas.addEventListener('pointermove', (event) => {
  if (event.pointerType !== 'touch' || touchY === null) return;
  journey.travel((touchY - event.clientY) / 1600); touchY = event.clientY;
});
window.addEventListener('pointerup', () => { touchY = null; });
window.addEventListener('pointercancel', () => { touchY = null; });
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && journey.stage !== 'ordinary') { journey.reset(); return; }
  if (event.key.toLowerCase() === 'm') { soundButton.click(); return; }
  // Native button activation owns Enter/Space when a control has focus.
  if (event.target instanceof HTMLElement && event.target.closest('button, a')) return;
  if (['ArrowDown', 'ArrowRight', 'PageDown', ' '].includes(event.key)) { event.preventDefault(); journey.travel(.1); }
  if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(event.key)) { event.preventDefault(); journey.travel(-.1); }
  if (event.key === 'Enter') { if (journey.stage === 'ordinary') void begin(); else journey.return(); }
});
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer?.setSize(innerWidth, innerHeight);
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    if (busy) { window.dispatchEvent(new Event('resize')); return; }
    void refreshSurface();
  }, 160);
});
document.addEventListener('visibilitychange', () => {
  lastTime = performance.now();
  if (document.hidden) sound.suspend(); else sound.resume();
});
canvas.addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  cancelAnimationFrame(frame);
  sound.suspend();
  home.style.opacity = '1'; home.style.pointerEvents = 'auto'; home.inert = false; journeyUI.hidden = true;
  showError('The graphics connection was interrupted. Reload to return to the surface.');
  $('retry').onclick = () => location.reload();
});
function dispose() { cancelAnimationFrame(frame); clearTimeout(resizeTimer); sound.dispose(); world?.dispose(); surface?.dispose(); renderer?.dispose(); }
window.addEventListener('pagehide', (event) => { if (!event.persisted) dispose(); });
if (import.meta.hot) import.meta.hot.dispose(dispose);

updateSettings();
document.body.dataset.stage = 'ordinary';
void initialize();
