import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialWorld,
  emitSonarPulse,
  FOCUSED_PULSE_COST,
  getHudSnapshot,
  OMNI_PULSE_COST,
  stepWorld,
} from './engine';
import { computeFootstepProfile } from './audio';
import { castRayWithBounces, rectToSegments, resolveCircleWallCollisions } from './math';
import { GameEvent, InputState } from './types';

function makeIdleInput(overrides: Partial<InputState> = {}): InputState {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
    sneak: false,
    mouseWorld: { x: 400, y: 760 },
    pulseDirectionalJustPressed: false,
    pulseOmniJustPressed: false,
    ...overrides,
  };
}

test('raycast reflects off perpendicular wall segment and produces bounce hit', () => {
  const segs = rectToSegments({ x: 300, y: 0, w: 40, h: 400, kind: 'wall' }, 'w');
  const hits = castRayWithBounces({ x: 100, y: 200 }, 0, segs, [], 600, 1);
  assert.ok(hits.length >= 1);
  assert.equal(hits[0].kind, 'wall');
  assert.equal(Math.round(hits[0].point.x), 300);
  assert.equal(Math.round(hits[0].normal.x), -1);
  assert.equal(Math.round(hits[0].normal.y), 0);
});

test('circle-vs-wall collision slides cleanly and prevents wall penetration', () => {
  const walls = [{ x: 200, y: 100, w: 50, h: 200, kind: 'wall' as const }];
  const resolved = resolveCircleWallCollisions({ x: 195, y: 180 }, 14, walls, 1000, 1000);
  assert.ok(resolved.x <= 200 - 14 + 0.001);
  assert.equal(resolved.y, 180);
});

test('player spawns safely and survives 5 seconds without input', () => {
  const world = createInitialWorld('playing');
  const idle = makeIdleInput();
  for (let i = 0; i < 300; i++) {
    stepWorld(world, 1 / 60, idle);
  }
  assert.equal(world.phase, 'playing');
  assert.equal(world.player.integrity, world.player.maxIntegrity);
});

test('directional and omni sonar pulses spend charge, emit waves, and reveal echo segments', () => {
  const world = createInitialWorld('playing');
  const okOmni = emitSonarPulse(world, world.player.pos, 0, false, false);
  assert.equal(okOmni, true);
  assert.equal(world.player.echoCharge, 100 - OMNI_PULSE_COST);
  assert.equal(world.pulsesUsed, 1);
  assert.equal(world.waves.length, 1);

  // Step 0.5s so expanding wave hits vestibule walls
  const idle = makeIdleInput();
  for (let i = 0; i < 30; i++) {
    stepWorld(world, 1 / 60, idle);
  }
  assert.ok(world.echoSegments.length > 0, 'Expected sonar wave to illuminate echo segments');

  // Wait out cooldown and test focused cone cost
  world.player.pulseCooldown = 0;
  const before = world.player.echoCharge;
  const okFocused = emitSonarPulse(world, world.player.pos, 0, true, false);
  assert.equal(okFocused, true);
  assert.equal(world.player.echoCharge, before - FOCUSED_PULSE_COST);
});

test('collecting all 4 clues unlocks exit and reaching unlocked exit triggers victory', () => {
  const world = createInitialWorld('playing');
  const idle = makeIdleInput();

  // Move player onto each clue sequentially
  for (const clue of world.clues) {
    world.player.pos.x = clue.pos.x;
    world.player.pos.y = clue.pos.y;
    stepWorld(world, 1 / 60, idle);
  }

  assert.equal(world.cluesCollected, 4);
  assert.equal(world.exit.unlocked, true);

  // Move player into unlocked exit
  world.player.pos.x = world.exit.pos.x;
  world.player.pos.y = world.exit.pos.y;
  stepWorld(world, 1 / 60, idle);

  assert.equal(world.phase, 'gameover');
  assert.equal(world.outcome, 'victory');
});

test('entity contact reduces integrity and triggers defeat at 0 integrity', () => {
  const world = createInitialWorld('playing');
  const ent = world.entities[0];
  const idle = makeIdleInput();

  for (let hit = 0; hit < 3; hit++) {
    world.player.invulnTimer = 0;
    world.hitstopTimer = 0;
    world.player.pos.x = ent.pos.x;
    world.player.pos.y = ent.pos.y;
    stepWorld(world, 1 / 60, idle);
  }

  const snap = getHudSnapshot(world);
  assert.equal(snap.integrity, 0);
  assert.equal(snap.phase, 'gameover');
  assert.equal(snap.outcome, 'defeat');
});

test('computeFootstepProfile scales volume and hardness with speedRatio and sneak state', () => {
  const fullWalk = computeFootstepProfile(1, false);
  const slowWalk = computeFootstepProfile(0.4, false);
  const sneak = computeFootstepProfile(0.48, true);

  assert.ok(fullWalk.volume > slowWalk.volume, 'Full walk should be louder than slow walk');
  assert.ok(fullWalk.hardness > slowWalk.hardness, 'Full walk should be harder than slow walk');
  assert.ok(fullWalk.cutoffHz > slowWalk.cutoffHz, 'Full walk should have higher cutoff than slow walk');

  assert.ok(slowWalk.volume > sneak.volume, 'Sneaking should be quieter than slow normal walking');
  assert.ok(slowWalk.hardness > sneak.hardness, 'Sneaking should have softer impact hardness');
  assert.ok(sneak.transientGain < fullWalk.transientGain * 0.25, 'Sneaking transient click should be heavily damped');
});

test('stepWorld emits footstep events with speedRatio reflecting walk vs sneak velocity', () => {
  const world = createInitialWorld('playing');
  const walkEvents: GameEvent[] = [];
  const walkInput = makeIdleInput({ right: true, sneak: false });

  for (let i = 0; i < 30; i++) {
    stepWorld(world, 1 / 60, walkInput);
    for (const ev of world.events) {
      if (ev.type === 'footstep') walkEvents.push({ ...ev });
    }
  }

  assert.ok(walkEvents.length >= 1, 'Expected at least one walk footstep event');
  assert.equal(walkEvents[0].sneaking, false);
  assert.ok((walkEvents[0].speedRatio ?? 0) > 0.9, 'Expected full walk speedRatio near 1.0');

  const sneakWorld = createInitialWorld('playing');
  const sneakEvents: GameEvent[] = [];
  const sneakInput = makeIdleInput({ right: true, sneak: true });

  for (let i = 0; i < 65; i++) {
    stepWorld(sneakWorld, 1 / 60, sneakInput);
    for (const ev of sneakWorld.events) {
      if (ev.type === 'footstep') sneakEvents.push({ ...ev });
    }
  }

  assert.ok(sneakEvents.length >= 1, 'Expected at least one sneak footstep event');
  assert.equal(sneakEvents[0].sneaking, true);
  assert.ok(
    (sneakEvents[0].speedRatio ?? 1) < 0.55,
    'Expected sneak speedRatio near 0.48',
  );
});
