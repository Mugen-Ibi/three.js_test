import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

// Execute the actual orchestration functions with deferred captures and a fake
// event loop. This checks interrupted async work without a browser or WebGL.
const source = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
function section(start, end) {
  const from = source.indexOf(start), to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `Missing lifecycle source boundary: ${start}`);
  return source.slice(from, to);
}
const lifecycleSource = stripTypeScriptTypes([
  section('function showError(', '\nasync function begin('),
  section("window.addEventListener('resize'", "\ndocument.addEventListener('visibilitychange'"),
  section("canvas.addEventListener('webglcontextlost'", "\nwindow.addEventListener('pagehide'"),
].join('\n'));

function harness() {
  const timers = new Map(), listeners = {}, elements = new Map(), captures = [];
  const counters = { resized: 0, updated: 0, disposed: 0, errors: 0 };
  let nextTimer = 0;
  const context = vm.createContext({
    console: { error() { counters.errors++; } }, innerWidth: 1440, innerHeight: 900,
    clearTimeout: id => timers.delete(id), cancelAnimationFrame() {},
    ready: true, busy: false, preparationId: 0, unavailable: false, resizeTimer: 0, frame: 1,
    $: id => {
      if (!elements.has(id)) elements.set(id, { hidden: true, disabled: false, textContent: '', style: {} });
      return elements.get(id);
    },
    surface: {
      capture: () => new Promise((resolve, reject) => captures.push({ resolve, reject })),
      dispose() {},
    },
    camera: { aspect: 1, updateProjectionMatrix() {} },
    world: { setHomepage() { counters.updated++; }, dispose() {} },
    renderer: { setSize() { counters.resized++; }, dispose() { counters.disposed++; } },
    enter: { disabled: false }, home: { style: {}, inert: true }, journeyUI: { hidden: false },
    sound: { suspend() {}, dispose() {} }, journey: { reset() {} },
    window: {
      addEventListener: (type, listener) => { listeners[type] = listener; },
      dispatchEvent: event => listeners[event.type](event),
      setTimeout: callback => { timers.set(++nextTimer, callback); return nextTimer; },
    },
    canvas: { addEventListener: (type, listener) => { listeners[type] = listener; } },
    Event: class { constructor(type) { this.type = type; } },
  });
  vm.runInContext(lifecycleSource, context);
  return { context, timers, listeners, elements, captures, counters,
    refresh: () => vm.runInContext('refreshSurface()', context),
    dispose: () => vm.runInContext('dispose()', context) };
}

for (const interruption of ['context loss', 'dispose']) {
  test(`${interruption} releases pending capture and prevents a resize retry loop`, async () => {
    const app = harness();
    const pending = app.refresh();
    assert.equal(app.context.busy, true);
    app.listeners.resize();
    assert.equal(app.timers.size, 1);
    const alreadyQueued = [...app.timers.values()][0];
    if (interruption === 'context loss') app.listeners.webglcontextlost({ preventDefault() {} });
    else app.dispose();
    assert.equal(app.context.busy, false);
    assert.equal(app.context.ready, false);
    assert.equal(app.context.unavailable, true);
    assert.equal(app.timers.size, 0);
    // Also cover a callback that had already left the timer queue.
    alreadyQueued();
    if (interruption === 'context loss') app.captures[0].resolve({});
    else app.captures[0].reject(new Error('Capture superseded by disposal'));
    await pending;
    for (let i = 0; i < 3; i++) app.listeners.resize();
    assert.equal(app.context.busy, false);
    assert.equal(app.timers.size, 0);
    assert.equal(app.counters.resized, 1);
    assert.equal(app.counters.updated, 0);
    assert.equal(app.counters.errors, 0);
  });
}

test('an older capture completion cannot clear the newer request busy state', async () => {
  const app = harness();
  const older = app.refresh(), newer = app.refresh();
  app.captures[0].resolve({});
  await older;
  assert.equal(app.context.busy, true);
  assert.equal(app.context.ready, false);
  assert.equal(app.counters.updated, 0);
  app.captures[1].resolve({});
  await newer;
  assert.equal(app.context.busy, false);
  assert.equal(app.context.ready, true);
  assert.equal(app.counters.updated, 1);
});
