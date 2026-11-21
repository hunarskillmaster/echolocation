import { buildFacilityLevel } from './level';
import {
  castRayWithBounces,
  CircleTarget,
  clamp,
  computeStereoPan,
  dist,
  hasLineOfSight,
  lerp,
  normalize,
  resolveCircleWallCollisions,
} from './math';
import {
  EchoSegment,
  Entity,
  GamePhase,
  HitSpark,
  HudSnapshot,
  InputState,
  RayHit,
  SonarWave,
  SurfaceKind,
  Vec2,
  WorldState,
} from './types';

export const PLAYER_SPEED = 178;
export const PLAYER_SNEAK_SPEED = 86;
export const FOCUSED_PULSE_COST = 20;
export const OMNI_PULSE_COST = 34;
export const PULSE_COOLDOWN = 0.28;
export const ECHO_CHARGE_REGEN = 19; // per second
export const MAX_SPARKS = 420;
export const MAX_ECHO_SEGMENTS = 1800;

interface PendingWaveHit {
  triggerDist: number;
  hit: RayHit;
  intensity: number;
  audioEmitted: boolean;
}

export interface ActiveWaveInternal extends SonarWave {
  pendingHits: PendingWaveHit[];
}

function createSparkPool(): HitSpark[] {
  const pool: HitSpark[] = new Array(MAX_SPARKS);
  for (let i = 0; i < MAX_SPARKS; i++) {
    pool[i] = {
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      kind: 'wall',
      bounce: 0,
    };
  }
  return pool;
}

export function createInitialWorld(phase: GamePhase = 'title'): WorldState {
  const level = buildFacilityLevel();
  return {
    phase,
    outcome: 'none',
    width: level.width,
    height: level.height,
    segments: level.segments,
    walls: level.walls,
    player: {
      pos: { x: level.playerSpawn.x, y: level.playerSpawn.y },
      vel: { x: 0, y: 0 },
      radius: 14,
      facing: 0,
      integrity: 3,
      maxIntegrity: 3,
      invulnTimer: 0,
      echoCharge: 100,
      maxEchoCharge: 100,
      pulseCooldown: 0,
      stepDistanceAccum: 0,
      sneaking: false,
      lastNoiseLevel: 'QUIET',
      noiseDisplayTimer: 0,
    },
    clues: level.clues,
    exit: level.exit,
    entities: level.entities,
    echoSegments: [],
    sparks: createSparkPool(),
    sparkCursor: 0,
    waves: [],
    ripples: [],
    camera: { x: level.playerSpawn.x, y: level.playerSpawn.y },
    trauma: 0,
    hitstopTimer: 0,
    elapsedTime: 0,
    pulsesUsed: 0,
    cluesCollected: 0,
    totalClues: level.clues.length,
    activeClue: null,
    phantomTimer: 0.6,
    events: [],
  };
}

function spawnSpark(
  world: WorldState,
  x: number,
  y: number,
  nx: number,
  ny: number,
  kind: SurfaceKind,
  bounce: number,
): void {
  const s = world.sparks[world.sparkCursor];
  world.sparkCursor = (world.sparkCursor + 1) % MAX_SPARKS;
  const speed = 18 + (bounce === 0 ? 22 : 10);
  s.active = true;
  s.x = x;
  s.y = y;
  s.vx = nx * speed + (Math.random() - 0.5) * 16;
  s.vy = ny * speed + (Math.random() - 0.5) * 16;
  s.maxLife = bounce === 0 ? 0.55 : 0.35;
  s.life = s.maxLife;
  s.kind = kind;
  s.bounce = bounce;
}

function addEchoSegmentFromHit(world: WorldState, hit: RayHit, intensity: number): void {
  if (!hit.segment) return;
  const seg = hit.segment;
  const sdx = seg.b.x - seg.a.x;
  const sdy = seg.b.y - seg.a.y;
  const segLen = Math.hypot(sdx, sdy);
  if (segLen < 1) return;

  const ux = sdx / segLen;
  const uy = sdy / segLen;
  const proj = (hit.point.x - seg.a.x) * ux + (hit.point.y - seg.a.y) * uy;
  const halfSpan = hit.bounce === 0 ? 15 : 10;
  const t0 = clamp(proj - halfSpan, 0, segLen);
  const t1 = clamp(proj + halfSpan, 0, segLen);
  if (t1 - t0 < 1) return;

  const maxLife =
    hit.kind === 'exit'
      ? 3.5
      : hit.kind === 'pillar'
        ? 3.0
        : hit.bounce === 0
          ? 3.1
          : hit.bounce === 1
            ? 2.2
            : 1.65;

  const echoSeg: EchoSegment = {
    ax: seg.a.x + ux * t0,
    ay: seg.a.y + uy * t0,
    bx: seg.a.x + ux * t1,
    by: seg.a.y + uy * t1,
    kind: hit.kind,
    intensity: intensity * (hit.bounce === 0 ? 1 : hit.bounce === 1 ? 0.52 : 0.28),
    life: maxLife,
    maxLife,
    bounce: hit.bounce,
  };

  if (world.echoSegments.length >= MAX_ECHO_SEGMENTS) {
    world.echoSegments.shift();
  }
  world.echoSegments.push(echoSeg);
}

function gatherCircleTargets(world: WorldState): CircleTarget[] {
  const targets: CircleTarget[] = [];
  for (const clue of world.clues) {
    if (!clue.collected) {
      targets.push({ id: clue.id, pos: clue.pos, radius: clue.radius + 4, kind: 'clue' });
    }
  }
  targets.push({
    id: 'exit-gate',
    pos: world.exit.pos,
    radius: world.exit.radius,
    kind: 'exit',
  });
  for (const entity of world.entities) {
    targets.push({ id: entity.id, pos: entity.pos, radius: entity.radius + 2, kind: 'entity' });
  }
  return targets;
}

export function emitSonarPulse(
  world: WorldState,
  origin: Vec2,
  angleCenter: number,
  isFocused: boolean,
  isPhantom = false,
): boolean {
  if (!isPhantom) {
    const cost = isFocused ? FOCUSED_PULSE_COST : OMNI_PULSE_COST;
    if (world.player.pulseCooldown > 0 || world.player.echoCharge < cost) {
      return false;
    }
    world.player.echoCharge -= cost;
    world.player.pulseCooldown = PULSE_COOLDOWN;
    world.player.lastNoiseLevel = 'PING';
    world.player.noiseDisplayTimer = 0.85;
    world.pulsesUsed += 1;
    world.trauma = Math.min(0.32, world.trauma + (isFocused ? 0.14 : 0.2));

    world.events.push({
      type: 'sonar_emit',
      pan: 0,
      isFocused,
    });

    // Alert nearby entities to the player's acoustic pulse
    const hearRadius = isFocused ? 540 : 720;
    for (const entity of world.entities) {
      const d = dist(origin, entity.pos);
      if (d <= hearRadius) {
        alertEntityToSound(entity, origin, d);
      }
    }
  }

  const rayCount = isFocused ? 132 : 216;
  const coneHalfAngle = isFocused ? Math.PI * 0.24 : Math.PI;
  const maxDist = isFocused ? 690 : 540;
  const circles = gatherCircleTargets(world);
  const pendingHits: PendingWaveHit[] = [];

  for (let i = 0; i < rayCount; i++) {
    const frac = i / (isFocused ? rayCount - 1 : rayCount);
    const angle = isFocused
      ? angleCenter - coneHalfAngle + frac * (coneHalfAngle * 2)
      : -Math.PI + frac * Math.PI * 2;

    const hits = castRayWithBounces(origin, angle, world.segments, circles, maxDist, 2);
    let accumDist = 0;
    for (let h = 0; h < hits.length; h++) {
      const hit = hits[h];
      accumDist += hit.distance;
      const distAtten = clamp(1 - accumDist / (maxDist * 1.15), 0.18, 1);
      pendingHits.push({
        triggerDist: accumDist,
        hit,
        intensity: distAtten * (isPhantom ? 0.65 : 1),
        audioEmitted: isPhantom,
      });
    }
  }

  pendingHits.sort((a, b) => a.triggerDist - b.triggerDist);

  const wave: ActiveWaveInternal = {
    origin: { x: origin.x, y: origin.y },
    radius: 6,
    maxRadius: maxDist,
    speed: isFocused ? 680 : 560,
    angleCenter,
    coneHalfAngle,
    isFocused,
    intensity: isPhantom ? 0.65 : 1,
    pendingHits,
  };

  world.waves.push(wave);
  return true;
}

function alertEntityToSound(entity: Entity, soundOrigin: Vec2, d: number): void {
  if (entity.kind === 'stalker') {
    if (d < 520) {
      entity.investigateTarget = { x: soundOrigin.x, y: soundOrigin.y };
      if (entity.state === 'patrol') {
        entity.state = 'telegraph';
        entity.stateTimer = 0.42;
      } else if (entity.state === 'investigate') {
        entity.state = 'chase';
        entity.stateTimer = 4.0;
      }
    }
  } else if (entity.kind === 'patroller') {
    if (d < 460) {
      entity.investigateTarget = { x: soundOrigin.x, y: soundOrigin.y };
      entity.state = 'investigate';
      entity.stateTimer = 3.6;
    }
  } else if (entity.kind === 'sentinel') {
    if (d < 320) {
      entity.investigateTarget = { x: soundOrigin.x, y: soundOrigin.y };
      entity.state = 'investigate';
      entity.stateTimer = 2.8;
    }
  }
}

function processWaveHits(world: WorldState, wave: ActiveWaveInternal): void {
  const pending = wave.pendingHits;
  let wallAudioCount = 0;
  let specialAudioCount = 0;

  while (pending.length > 0 && pending[0].triggerDist <= wave.radius) {
    const item = pending.shift()!;
    const { hit, intensity } = item;

    if (hit.kind === 'wall' || hit.kind === 'pillar' || hit.kind === 'exit') {
      addEchoSegmentFromHit(world, hit, intensity);
      if (hit.bounce === 0 || Math.random() < 0.45) {
        spawnSpark(
          world,
          hit.point.x,
          hit.point.y,
          hit.normal.x,
          hit.normal.y,
          hit.kind,
          hit.bounce,
        );
      }
    }

    if (hit.kind === 'clue' && hit.clueId) {
      const clue = world.clues.find((c) => c.id === hit.clueId);
      if (clue && !clue.collected) {
        clue.echoVisibility = Math.max(clue.echoVisibility, clue.echoDecayMax);
        clue.pingPulse = 1;
        spawnSpark(world, hit.point.x, hit.point.y, hit.normal.x, hit.normal.y, 'clue', 0);
      }
    }

    if (hit.kind === 'exit') {
      world.exit.echoVisibility = Math.max(world.exit.echoVisibility, world.exit.echoDecayMax);
    }

    if (hit.kind === 'entity' && hit.entityId) {
      const ent = world.entities.find((e) => e.id === hit.entityId);
      if (ent) {
        ent.echoVisibility = Math.max(ent.echoVisibility, ent.echoDecayMax);
        spawnSpark(world, hit.point.x, hit.point.y, hit.normal.x, hit.normal.y, 'entity', 0);
      }
    }

    if (!item.audioEmitted) {
      const isSpecial = hit.kind === 'clue' || hit.kind === 'entity' || hit.kind === 'exit';
      if ((isSpecial && specialAudioCount < 2) || (!isSpecial && wallAudioCount < 2 && hit.bounce === 0)) {
        if (isSpecial) specialAudioCount++;
        else wallAudioCount++;

        world.events.push({
          type: 'echo_return',
          pan: computeStereoPan(world.player.pos, hit.point),
          distanceRatio: clamp(item.triggerDist / wave.maxRadius, 0, 1),
          surfaceKind: hit.kind,
        });
      }
    }
  }
}

function stepEntities(world: WorldState, dt: number): void {
  const playerPos = world.player.pos;

  for (const ent of world.entities) {
    ent.echoVisibility = Math.max(0, ent.echoVisibility - dt);
    ent.soundCooldown -= dt;
    ent.bioPulseTimer -= dt;

    const dToPlayer = dist(ent.pos, playerPos);
    const canSee = dToPlayer < 280 && hasLineOfSight(ent.pos, playerPos, world.segments);

    // Distinct behavioral policies per archetype
    if (ent.kind === 'patroller') {
      // Sweep Ward: steady corridor patrol, detours to investigate loud sounds
      if (canSee && !world.player.sneaking && dToPlayer < 210) {
        ent.state = 'chase';
        ent.stateTimer = 2.6;
        ent.investigateTarget = { ...playerPos };
      }

      if (ent.state === 'chase' || ent.state === 'investigate') {
        ent.stateTimer -= dt;
        const target = ent.investigateTarget ?? ent.waypoints[ent.waypointIndex];
        moveEntityToward(world, ent, target, ent.state === 'chase' ? 124 : 92, dt);
        if (ent.stateTimer <= 0 || dist(ent.pos, target) < 22) {
          ent.state = 'patrol';
          ent.investigateTarget = null;
        }
      } else {
        const wp = ent.waypoints[ent.waypointIndex];
        moveEntityToward(world, ent, wp, 76, dt);
        if (dist(ent.pos, wp) < 20) {
          ent.waypointIndex = (ent.waypointIndex + 1) % ent.waypoints.length;
        }
      }
    } else if (ent.kind === 'stalker') {
      // Acoustic Hound: slower creep on patrol, telegraphs then lunges fast toward pings/footsteps
      if (canSee && dToPlayer < 175) {
        ent.investigateTarget = { ...playerPos };
        if (ent.state === 'patrol') {
          ent.state = 'telegraph';
          ent.stateTimer = 0.45;
          world.events.push({
            type: 'entity_telegraph',
            pan: computeStereoPan(playerPos, ent.pos),
            distanceRatio: clamp(dToPlayer / 650, 0, 1),
            entityKind: ent.kind,
          });
        }
      }

      if (ent.state === 'telegraph') {
        ent.stateTimer -= dt;
        ent.echoVisibility = Math.max(ent.echoVisibility, 0.9);
        if (ent.stateTimer <= 0) {
          ent.state = 'chase';
          ent.stateTimer = 3.8;
        }
      } else if (ent.state === 'chase' || ent.state === 'investigate') {
        ent.stateTimer -= dt;
        if (canSee && !world.player.sneaking) {
          ent.investigateTarget = { ...playerPos };
        }
        const target = ent.investigateTarget ?? ent.waypoints[ent.waypointIndex];
        moveEntityToward(world, ent, target, ent.state === 'chase' ? 148 : 108, dt);
        if (ent.stateTimer <= 0 || dist(ent.pos, target) < 22) {
          ent.state = 'patrol';
          ent.investigateTarget = null;
        }
      } else {
        const wp = ent.waypoints[ent.waypointIndex];
        moveEntityToward(world, ent, wp, 62, dt);
        if (dist(ent.pos, wp) < 20) {
          ent.waypointIndex = (ent.waypointIndex + 1) % ent.waypoints.length;
        }
      }
    } else {
      // Resonant Anchor (sentinel): guards east wing, emits periodic bio-clicks
      if (ent.bioPulseTimer <= 0) {
        ent.bioPulseTimer = 2.4;
        ent.echoVisibility = Math.max(ent.echoVisibility, 1.15);
        world.ripples.push({
          x: ent.pos.x,
          y: ent.pos.y,
          radius: 8,
          maxRadius: 95,
          life: 0.65,
          maxLife: 0.65,
          color: 'entity',
        });
      }

      if (canSee && dToPlayer < 220) {
        ent.state = 'chase';
        ent.stateTimer = 2.2;
        ent.investigateTarget = { ...playerPos };
      }

      if (ent.state === 'chase' || ent.state === 'investigate') {
        ent.stateTimer -= dt;
        const target = ent.investigateTarget ?? ent.waypoints[ent.waypointIndex];
        moveEntityToward(world, ent, target, 102, dt);
        if (ent.stateTimer <= 0 || dist(ent.pos, target) < 22) {
          ent.state = 'patrol';
          ent.investigateTarget = null;
        }
      } else {
        const wp = ent.waypoints[ent.waypointIndex];
        moveEntityToward(world, ent, wp, 72, dt);
        if (dist(ent.pos, wp) < 20) {
          ent.waypointIndex = (ent.waypointIndex + 1) % ent.waypoints.length;
        }
      }
    }

    // Distance-attenuated ambient entity sound
    if (ent.soundCooldown <= 0 && dToPlayer < 680) {
      ent.soundCooldown = ent.state === 'chase' ? 0.52 : clamp(0.65 + (dToPlayer / 680) * 1.1, 0.55, 1.75);
      world.events.push({
        type: 'entity_sound',
        pan: computeStereoPan(playerPos, ent.pos),
        distanceRatio: clamp(dToPlayer / 680, 0, 1),
        entityKind: ent.kind,
      });
    }

    // Player contact check
    if (
      world.player.invulnTimer <= 0 &&
      dToPlayer < ent.radius + world.player.radius - 2
    ) {
      applyPlayerHit(world, ent);
    }
  }
}

function moveEntityToward(
  world: WorldState,
  ent: Entity,
  target: Vec2,
  speed: number,
  dt: number,
): void {
  const dir = normalize({ x: target.x - ent.pos.x, y: target.y - ent.pos.y });
  ent.vel.x = dir.x * speed;
  ent.vel.y = dir.y * speed;
  if (Math.hypot(dir.x, dir.y) > 0.05) {
    ent.facing = Math.atan2(dir.y, dir.x);
  }
  const next = resolveCircleWallCollisions(
    { x: ent.pos.x + ent.vel.x * dt, y: ent.pos.y + ent.vel.y * dt },
    ent.radius,
    world.walls,
    world.width,
    world.height,
  );
  ent.pos.x = next.x;
  ent.pos.y = next.y;
}

function applyPlayerHit(world: WorldState, attacker: Entity): void {
  world.player.integrity = Math.max(0, world.player.integrity - 1);
  world.player.invulnTimer = 1.25;
  world.hitstopTimer = 0.065;
  world.trauma = 0.72;

  const pushDir = normalize({
    x: world.player.pos.x - attacker.pos.x,
    y: world.player.pos.y - attacker.pos.y,
  });
  const pushed = resolveCircleWallCollisions(
    {
      x: world.player.pos.x + pushDir.x * 38,
      y: world.player.pos.y + pushDir.y * 38,
    },
    world.player.radius,
    world.walls,
    world.width,
    world.height,
  );
  world.player.pos.x = pushed.x;
  world.player.pos.y = pushed.y;

  // Shockwave reveals nearby walls briefly so the player can bolt
  emitSonarPulse(world, world.player.pos, 0, false, true);

  world.events.push({
    type: 'player_hit',
    pan: computeStereoPan(world.player.pos, attacker.pos),
  });

  if (world.player.integrity <= 0) {
    world.phase = 'gameover';
    world.outcome = 'defeat';
    world.events.push({ type: 'defeat', pan: 0 });
  }
}

export function stepWorld(world: WorldState, rawDt: number, input: InputState): void {
  world.events.length = 0;
  const dt = Math.min(rawDt, 0.05);

  // Title screen ambient phantom sonar showcase
  if (world.phase === 'title') {
    world.phantomTimer -= dt;
    if (world.phantomTimer <= 0) {
      world.phantomTimer = 1.85;
      const angle = (world.elapsedTime * 0.7) % (Math.PI * 2);
      const phantomOrigin = {
        x: 680 + Math.cos(angle) * 320,
        y: 780 + Math.sin(angle * 0.8) * 260,
      };
      emitSonarPulse(world, phantomOrigin, angle, false, true);
    }
    world.elapsedTime += dt;
    world.camera.x = lerp(world.camera.x, 760 + Math.cos(world.elapsedTime * 0.16) * 240, 0.04);
    world.camera.y = lerp(world.camera.y, 780 + Math.sin(world.elapsedTime * 0.12) * 180, 0.04);
    stepVisualDecays(world, dt);
    return;
  }

  if (world.phase !== 'playing') {
    return;
  }

  // Hitstop freezes simulation physics briefly while rendering & trauma continue
  world.trauma = Math.max(0, world.trauma - dt * 1.45);
  if (world.hitstopTimer > 0) {
    world.hitstopTimer = Math.max(0, world.hitstopTimer - dt);
    stepVisualDecays(world, dt);
    return;
  }

  world.elapsedTime += dt;

  const p = world.player;
  p.invulnTimer = Math.max(0, p.invulnTimer - dt);
  p.pulseCooldown = Math.max(0, p.pulseCooldown - dt);
  p.echoCharge = Math.min(p.maxEchoCharge, p.echoCharge + ECHO_CHARGE_REGEN * dt);
  p.sneaking = input.sneak;

  if (p.noiseDisplayTimer > 0) {
    p.noiseDisplayTimer = Math.max(0, p.noiseDisplayTimer - dt);
    if (p.noiseDisplayTimer === 0) {
      p.lastNoiseLevel = 'QUIET';
    }
  }

  // Player movement
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const moveVec = normalize({ x: mx, y: my });
  const speed = p.sneaking ? PLAYER_SNEAK_SPEED : PLAYER_SPEED;
  p.vel.x = moveVec.x * speed;
  p.vel.y = moveVec.y * speed;

  const prevX = p.pos.x;
  const prevY = p.pos.y;
  const resolved = resolveCircleWallCollisions(
    { x: p.pos.x + p.vel.x * dt, y: p.pos.y + p.vel.y * dt },
    p.radius,
    world.walls,
    world.width,
    world.height,
  );
  p.pos.x = resolved.x;
  p.pos.y = resolved.y;

  const movedDist = Math.hypot(p.pos.x - prevX, p.pos.y - prevY);
  p.stepDistanceAccum += movedDist;

  const aimDx = input.mouseWorld.x - p.pos.x;
  const aimDy = input.mouseWorld.y - p.pos.y;
  if (Math.hypot(aimDx, aimDy) > 4) {
    p.facing = Math.atan2(aimDy, aimDx);
  }

  const actualSpeed = dt > 0 ? movedDist / dt : 0;
  const speedRatio = clamp(actualSpeed / PLAYER_SPEED, 0, 1);

  // Footstep acoustic ripple & entity hearing check
  const stepStride = p.sneaking ? 74 : 52;
  if (p.stepDistanceAccum >= stepStride) {
    p.stepDistanceAccum = 0;
    const rippleMax = p.sneaking ? 38 : Math.round(52 + 48 * speedRatio);
    world.ripples.push({
      x: p.pos.x,
      y: p.pos.y,
      radius: 6,
      maxRadius: rippleMax,
      life: 0.45,
      maxLife: 0.45,
      color: 'player',
    });
    if (p.noiseDisplayTimer <= 0.15) {
      p.lastNoiseLevel = p.sneaking ? 'QUIET' : 'STEP';
      p.noiseDisplayTimer = 0.32;
    }
    world.events.push({
      type: 'footstep',
      pan: 0,
      sneaking: p.sneaking,
      speedRatio,
    });

    if (!p.sneaking) {
      for (const entity of world.entities) {
        const d = dist(p.pos, entity.pos);
        if (d < 250) {
          alertEntityToSound(entity, p.pos, d);
        }
      }
    }
  }

  // Sonar emission
  if (input.pulseDirectionalJustPressed) {
    emitSonarPulse(world, p.pos, p.facing, true, false);
  } else if (input.pulseOmniJustPressed) {
    emitSonarPulse(world, p.pos, p.facing, false, false);
  }

  // Clue collection & ambient clue harmonic shimmer
  for (const clue of world.clues) {
    clue.echoVisibility = Math.max(0, clue.echoVisibility - dt);
    clue.pingPulse = Math.max(0, clue.pingPulse - dt * 1.6);

    if (!clue.collected && dist(p.pos, clue.pos) <= p.radius + clue.radius + 8) {
      clue.collected = true;
      world.cluesCollected += 1;
      world.activeClue = {
        title: clue.title,
        text: clue.text,
        timer: 6.0,
        maxTimer: 6.0,
      };
      world.ripples.push({
        x: clue.pos.x,
        y: clue.pos.y,
        radius: 10,
        maxRadius: 150,
        life: 0.75,
        maxLife: 0.75,
        color: 'clue',
      });
      world.events.push({
        type: 'clue_collected',
        pan: 0,
      });

      if (world.cluesCollected >= world.totalClues && !world.exit.unlocked) {
        world.exit.unlocked = true;
        world.exit.echoVisibility = world.exit.echoDecayMax;
        world.events.push({ type: 'exit_unlocked', pan: 0 });
      }
    }
  }

  // Exit reachability
  world.exit.echoVisibility = Math.max(0, world.exit.echoVisibility - dt);
  if (world.exit.unlocked && dist(p.pos, world.exit.pos) <= world.exit.radius + p.radius) {
    world.phase = 'gameover';
    world.outcome = 'victory';
    world.events.push({ type: 'victory', pan: 0 });
    return;
  }

  // Active clue banner decay
  if (world.activeClue) {
    world.activeClue.timer -= dt;
    if (world.activeClue.timer <= 0) {
      world.activeClue = null;
    }
  }

  // Entities AI & contact
  stepEntities(world, dt);

  // Smooth camera tracking
  const camAlpha = 1 - Math.exp(-8.5 * dt);
  world.camera.x = lerp(world.camera.x, p.pos.x, camAlpha);
  world.camera.y = lerp(world.camera.y, p.pos.y, camAlpha);

  stepVisualDecays(world, dt);
}

function stepVisualDecays(world: WorldState, dt: number): void {
  // Expand sonar waves & reveal hits progressively
  for (let i = world.waves.length - 1; i >= 0; i--) {
    const w = world.waves[i] as ActiveWaveInternal;
    w.radius += w.speed * dt;
    processWaveHits(world, w);
    if (w.radius >= w.maxRadius) {
      world.waves.splice(i, 1);
    }
  }

  // Decay echo segments
  for (let i = world.echoSegments.length - 1; i >= 0; i--) {
    const seg = world.echoSegments[i];
    seg.life -= dt;
    if (seg.life <= 0) {
      world.echoSegments.splice(i, 1);
    }
  }

  // Update pooled sparks
  for (let i = 0; i < MAX_SPARKS; i++) {
    const s = world.sparks[i];
    if (!s.active) continue;
    s.life -= dt;
    if (s.life <= 0) {
      s.active = false;
      continue;
    }
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vx *= 0.92;
    s.vy *= 0.92;
  }

  // Update footstep/bio ripples
  for (let i = world.ripples.length - 1; i >= 0; i--) {
    const r = world.ripples[i];
    r.life -= dt;
    if (r.life <= 0) {
      world.ripples.splice(i, 1);
      continue;
    }
    const progress = 1 - r.life / r.maxLife;
    r.radius = lerp(6, r.maxRadius, progress);
  }
}

export function getHudSnapshot(world: WorldState): HudSnapshot {
  let minEntityDist = Infinity;
  for (const ent of world.entities) {
    const d = dist(world.player.pos, ent.pos);
    if (d < minEntityDist) minEntityDist = d;
  }
  const nearestDangerRatio = clamp(1 - (minEntityDist - 35) / 210, 0, 1);

  return {
    phase: world.phase,
    outcome: world.outcome,
    integrity: world.player.integrity,
    maxIntegrity: world.player.maxIntegrity,
    echoCharge: Math.round(world.player.echoCharge),
    maxEchoCharge: world.player.maxEchoCharge,
    cluesCollected: world.cluesCollected,
    totalClues: world.totalClues,
    exitUnlocked: world.exit.unlocked,
    elapsedSeconds: Math.floor(world.elapsedTime),
    pulsesUsed: world.pulsesUsed,
    noiseLevel: world.player.lastNoiseLevel,
    activeClue: world.activeClue
      ? { title: world.activeClue.title, text: world.activeClue.text }
      : null,
    nearestDangerRatio,
  };
}
