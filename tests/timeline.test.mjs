import test from 'node:test';
import assert from 'node:assert/strict';
import { Journey } from '../src/timeline.ts';

const DT = 0.05;

function advanceUntil(journey, stage, reduced = false, inspect = () => {}) {
  let ticks = 0;
  while (journey.stage !== stage && ticks < 2000) {
    journey.tick(DT, reduced);
    inspect(journey);
    ticks++;
  }
  assert.equal(journey.stage, stage, `Journey should reach ${stage} without further input`);
  return ticks * DT;
}

function makeJourney() {
  const changes = [];
  const journey = new Journey(stage => changes.push(stage));
  return { journey, changes };
}

test('all five scenes connect twice, and the loop count advances only at the completed return', () => {
  const { journey, changes } = makeJourney();
  assert.equal(journey.stage, 'ordinary');
  assert.equal(journey.loopCount, 0);

  for (let completed = 0; completed < 2; completed++) {
    journey.enter();
    assert.equal(journey.stage, 'fracture');
    advanceUntil(journey, 'descent', false, state => assert.equal(state.loopCount, completed));
    advanceUntil(journey, 'revelation', false, state => {
      assert.equal(state.loopCount, completed);
      assert.ok(state.progress >= 0 && state.progress <= 1);
    });
    assert.equal(journey.progress, 1);
    assert.equal(journey.target, 1);

    // The discovery remains available until the visitor activates the monitor.
    for (let i = 0; i < 200; i++) journey.tick(DT, false);
    assert.equal(journey.stage, 'revelation');
    assert.equal(journey.loopCount, completed);
    journey.return();
    assert.equal(journey.stage, 'loop');
    advanceUntil(journey, 'ordinary', false, state => {
      assert.equal(state.loopCount, completed + (state.stage === 'ordinary' ? 1 : 0));
    });
    assert.equal(journey.loopCount, completed + 1);
    assert.equal(journey.progress, 0);
    assert.equal(journey.target, 0);
  }

  assert.deepEqual(changes, [
    'fracture', 'descent', 'revelation', 'loop', 'ordinary',
    'fracture', 'descent', 'revelation', 'loop', 'ordinary',
  ]);
});

test('rapid ENTER and RETURN activations cannot skip scenes or restart active transitions', () => {
  const { journey, changes } = makeJourney();
  for (let i = 0; i < 20; i++) journey.return();
  assert.equal(journey.stage, 'ordinary');
  assert.deepEqual(changes, []);

  journey.enter();
  for (let i = 0; i < 20; i++) {
    journey.tick(DT, false);
    journey.enter();
    journey.return();
  }
  assert.equal(journey.stage, 'fracture');
  assert.ok(journey.elapsed > 0.99, 'Repeated ENTER must not reset the fracture clock');
  assert.deepEqual(changes, ['fracture']);

  advanceUntil(journey, 'descent');
  for (let i = 0; i < 20; i++) {
    journey.enter();
    journey.return();
  }
  assert.equal(journey.stage, 'descent');
  advanceUntil(journey, 'revelation');
  journey.enter();
  assert.equal(journey.stage, 'revelation');
  journey.return();
  for (let i = 0; i < 20; i++) {
    journey.tick(DT, false);
    journey.return();
    journey.enter();
  }
  assert.equal(journey.stage, 'loop');
  assert.ok(journey.elapsed > 0.99, 'Repeated RETURN must not reset the loop clock');
  advanceUntil(journey, 'ordinary');
  assert.equal(journey.loopCount, 1);
  assert.deepEqual(changes, ['fracture', 'descent', 'revelation', 'loop', 'ordinary']);
});

test('manual travel clamps both endpoints, supports reversing, and only affects descent', () => {
  const { journey } = makeJourney();
  journey.travel(100);
  assert.equal(journey.target, 0);
  journey.enter();
  journey.travel(100);
  assert.equal(journey.target, 0);
  advanceUntil(journey, 'descent');

  journey.travel(100);
  assert.equal(journey.target, 1);
  journey.tick(DT, false);
  const forwardProgress = journey.progress;
  assert.ok(forwardProgress > 0 && forwardProgress < 1, 'Travel should ease toward its target');

  journey.travel(-100);
  assert.equal(journey.target, 0);
  journey.tick(DT, false);
  assert.ok(journey.progress < forwardProgress, 'A reverse gesture moves the camera back');
  assert.ok(journey.progress >= 0);
  journey.travel(100);
  advanceUntil(journey, 'revelation');
  journey.travel(-100);
  assert.equal(journey.target, 1);
  journey.return();
  journey.travel(-100);
  assert.equal(journey.target, 1);
});

for (const interruptedStage of ['fracture', 'descent', 'revelation', 'loop']) {
  test(`reset during ${interruptedStage} restores an interactive ordinary scene without counting a loop`, () => {
    const { journey } = makeJourney();
    journey.enter();
    if (interruptedStage !== 'fracture') advanceUntil(journey, 'descent');
    if (['revelation', 'loop'].includes(interruptedStage)) advanceUntil(journey, 'revelation');
    if (interruptedStage === 'loop') journey.return();
    assert.equal(journey.stage, interruptedStage);
    journey.tick(DT, false);
    journey.reset();
    assert.equal(journey.stage, 'ordinary');
    assert.equal(journey.progress, 0);
    assert.equal(journey.target, 0);
    assert.equal(journey.elapsed, 0);
    assert.equal(journey.loopCount, 0);
    journey.enter();
    assert.equal(journey.stage, 'fracture', 'Reset must leave ENTER usable');
  });
}

test('an interrupted later visit preserves completed loop history', () => {
  const { journey } = makeJourney();
  journey.enter();
  advanceUntil(journey, 'revelation');
  journey.return();
  advanceUntil(journey, 'ordinary');
  journey.enter();
  advanceUntil(journey, 'descent');
  journey.reset();
  assert.equal(journey.loopCount, 1);
});

test('reduced motion follows a slower automatic rail while preserving transition durations', () => {
  function measure(reduced) {
    const { journey } = makeJourney();
    journey.enter();
    const fracture = advanceUntil(journey, 'descent', reduced);
    const descent = advanceUntil(journey, 'revelation', reduced);
    journey.return();
    const loop = advanceUntil(journey, 'ordinary', reduced);
    assert.equal(journey.loopCount, 1);
    return { fracture, descent, loop };
  }

  const normal = measure(false);
  const reduced = measure(true);
  assert.equal(reduced.fracture, normal.fracture);
  assert.equal(reduced.loop, normal.loop);
  assert.ok(normal.fracture >= 4.8 && normal.fracture <= 4.8 + DT * 1.01);
  assert.ok(normal.loop >= 3.6 && normal.loop <= 3.6 + DT * 1.01);
  assert.ok(normal.descent >= 31 && normal.descent < 34);
  assert.ok(reduced.descent >= 48 && reduced.descent < 51);
  assert.ok(reduced.descent > normal.descent * 1.4, 'Reduced motion must not accelerate the camera');
});
