import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { Journey } from '../src/timeline.ts';

// Run the real animation/visibility orchestration with a synthetic frame clock.
// No GPU, browser, wall-clock sleeps or altered browser-test deadlines are needed.
const source = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
function section(start, end) {
  const from = source.indexOf(start), to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `Missing frame source boundary: ${start}`);
  return source.slice(from, to);
}
const frameSource = stripTypeScriptTypes([
  section('function animate(', '\nasync function initialize('),
  section("document.addEventListener('visibilitychange'", "\ncanvas.addEventListener('webglcontextlost'"),
].join('\n').replaceAll('import.meta.env.DEV', 'false'));

function harness(reduced = false) {
  let now = 0;
  const listeners = {}, changes = [], tickDeltas = [], pointerWeights = [];
  const journey = new Journey(stage => changes.push(stage));
  const tick = journey.tick.bind(journey);
  journey.tick = (dt, gentle) => { tickDeltas.push(dt); tick(dt, gentle); };
  const counters = { rendered: 0, suspended: 0, resumed: 0 };
  const context = vm.createContext({
    frame: 0, lastTime: 0, worldTime: 0, reduced, motionAmount: reduced ? 0 : 1,
    averageFrame: 1 / 60, slowFrames: 0, quality: 1, diagnosticAt: 0,
    journey, requestAnimationFrame: () => 1, performance: { now: () => now },
    document: { hidden: false, addEventListener: (type, listener) => { listeners[type] = listener; } },
    renderer: { render() { counters.rendered++; }, setPixelRatio() {}, shadowMap: {} },
    world: { update() {} }, scene: {}, camera: { position: { x: 0, z: 12 } },
    light: { position: { set() {} }, target: { position: { set() {} } } },
    pointer: {}, smoothPointer: { lerp: (_pointer, weight) => pointerWeights.push(weight) },
    updateCamera() {}, $: () => ({ style: {}, textContent: '' }),
    sound: { update() {}, suspend() { counters.suspended++; }, resume() { counters.resumed++; } },
  });
  vm.runInContext(frameSource, context);
  return { context, journey, changes, tickDeltas, pointerWeights, counters,
    frameAfter(ms) { now += ms; context.animate(now); },
    visibility(hidden, afterMs = 0) { now += afterMs; context.document.hidden = hidden; listeners.visibilitychange(); },
  };
}

for (const frameMs of [333, 500, 750]) {
  test(`${frameMs} ms visible frames retain journey durations and repeated completion`, () => {
    for (const reduced of [false, true]) {
      const app = harness(reduced);
      function advanceTo(stage, maxSeconds) {
        let elapsed = 0;
        while (app.journey.stage !== stage && elapsed < maxSeconds) {
          app.frameAfter(frameMs);
          elapsed += frameMs / 1000;
        }
        assert.equal(app.journey.stage, stage, `${stage} must not be tied to a minimum frame rate`);
        return elapsed;
      }
      for (let loop = 1; loop <= 2; loop++) {
        app.journey.enter();
        const fracture = advanceTo('descent', 4.8 + frameMs / 1000);
        assert.ok(fracture >= 4.8 && fracture <= 4.8 + frameMs / 1000 + 1e-9);
        // Keep the automatic rail and reduced-motion pacing, not only button jumps.
        const descent = advanceTo('revelation', reduced ? 51 : 34);
        assert.ok(descent >= (reduced ? 47 : 30));
        app.journey.return();
        const returning = advanceTo('ordinary', 3.6 + frameMs / 1000);
        assert.ok(returning >= 3.6 && returning <= 3.6 + frameMs / 1000 + 1e-9);
        assert.equal(app.journey.loopCount, loop);
      }
      assert.deepEqual(app.changes, Array(2).fill(['fracture', 'descent', 'revelation', 'loop', 'ordinary']).flat());
    }
  });
}

test('normal 16 ms frames preserve the previous journey timing exactly', () => {
  for (const reduced of [false, true]) {
    const app = harness(reduced), reference = new Journey(() => {});
    app.journey.enter();
    reference.enter();
    for (let frame = 0; frame < 4000 && app.journey.stage !== 'revelation'; frame++) {
      app.frameAfter(16);
      reference.tick(.016, reduced);
      assert.equal(app.journey.stage, reference.stage);
      assert.equal(app.journey.elapsed, reference.elapsed);
      assert.equal(app.journey.progress, reference.progress);
      assert.equal(app.journey.target, reference.target);
    }
    assert.equal(app.journey.stage, 'revelation');
  }
});

test('a long visible stall is bounded and visual smoothing retains its 50 ms cap', () => {
  const app = harness();
  app.journey.enter();
  app.frameAfter(5000);
  assert.equal(app.journey.stage, 'fracture');
  assert.equal(app.journey.elapsed, 1, 'A single foreground stall must not skip the whole fracture');
  assert.equal(app.context.worldTime, .05);
  assert.equal(app.pointerWeights[0], 1 - Math.exp(-.05 * 4));
  assert.deepEqual(app.tickDeltas, [1]);
});

test('hidden time is paused even without hidden animation frames, then visible time resumes', () => {
  const app = harness();
  app.journey.enter();
  app.frameAfter(500);
  assert.equal(app.journey.elapsed, .5);
  app.visibility(true);
  app.frameAfter(30000);
  assert.equal(app.journey.elapsed, .5);
  assert.equal(app.counters.rendered, 1);
  app.visibility(false, 30000);
  app.frameAfter(500);
  assert.equal(app.journey.elapsed, 1, 'Resuming must exclude the entire hidden interval');
  assert.equal(app.counters.rendered, 2);
  assert.equal(app.counters.suspended, 1);
  assert.equal(app.counters.resumed, 1);
  assert.deepEqual(app.tickDeltas, [.5, .5]);
});
