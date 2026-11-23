import { rectToSegments } from './math';
import { ClueNode, Entity, ExitGate, Segment, Vec2, WallRect } from './types';

export interface LevelBlueprint {
  width: number;
  height: number;
  playerSpawn: Vec2;
  walls: WallRect[];
  segments: Segment[];
  clues: ClueNode[];
  exit: ExitGate;
  entities: Entity[];
}

/**
 * The main level - a 2200x1600 underground facility.
 * Corridors are at least 140px wide so the player can navigate comfortably
 * and echoes have room to bounce back without clipping inside walls.
 * 
 * Layout overview (rough):
 *  - West: spawn vestibule + resonance lab (safe zone)
 *  - Center: acoustic atrium with pillar baffles
 *  - South: archive wing, 2 clues down here
 *  - East: containment corridor leading to exit hatch
 */
export function buildFacilityLevel(): LevelBlueprint {
  const width = 2200;
  const height = 1600;

  const walls: WallRect[] = [
    // outer walls
    { x: 0, y: 0, w: width, h: 32, kind: 'wall' },
    { x: 0, y: height - 32, w: width, h: 32, kind: 'wall' },
    { x: 0, y: 32, w: 32, h: height - 64, kind: 'wall' },
    { x: width - 32, y: 32, w: 32, h: height - 64, kind: 'wall' },

    // west vestibule divider (gap left for door at y=380-610 and y=1030-1210)
    { x: 380, y: 32, w: 36, h: 380, kind: 'wall' },
    { x: 380, y: 610, w: 36, h: 420, kind: 'wall' },
    { x: 380, y: 1210, w: 36, h: 358, kind: 'wall' },

    // north-west lab section + small pillars
    { x: 416, y: 360, w: 340, h: 36, kind: 'wall' },
    { x: 180, y: 210, w: 60, h: 60, kind: 'pillar' },
    { x: 180, y: 1240, w: 68, h: 68, kind: 'pillar' },

    // central atrium baffle pillars
    { x: 756, y: 220, w: 36, h: 380, kind: 'wall' },
    { x: 756, y: 790, w: 36, h: 410, kind: 'wall' },
    { x: 960, y: 520, w: 72, h: 72, kind: 'pillar' },
    { x: 1180, y: 520, w: 72, h: 72, kind: 'pillar' },
    { x: 960, y: 920, w: 72, h: 72, kind: 'pillar' },
    { x: 1180, y: 920, w: 72, h: 72, kind: 'pillar' },

    // south archive wing
    { x: 580, y: 1200, w: 420, h: 36, kind: 'wall' },
    { x: 1200, y: 1200, w: 380, h: 36, kind: 'wall' },
    { x: 1080, y: 1360, w: 64, h: 64, kind: 'pillar' },

    // east containment corridor leading to exit
    { x: 1410, y: 190, w: 36, h: 410, kind: 'wall' },
    { x: 1410, y: 790, w: 36, h: 410, kind: 'wall' },
    { x: 1446, y: 360, w: 360, h: 36, kind: 'wall' },
    { x: 1760, y: 560, w: 36, h: 480, kind: 'wall' },
    { x: 1600, y: 740, w: 60, h: 60, kind: 'pillar' },
    { x: 1940, y: 340, w: 68, h: 68, kind: 'pillar' },
    { x: 1940, y: 1180, w: 68, h: 68, kind: 'pillar' },
  ];

  const segments: Segment[] = [];
  for (let i = 0; i < walls.length; i++) {
    segments.push(...rectToSegments(walls[i], `w-${i}`));
  }

  const playerSpawn: Vec2 = { x: 195, y: 760 };

  const clues: ClueNode[] = [
    {
      id: 'clue-1',
      index: 1,
      pos: { x: 210, y: 165 },
      radius: 18,
      title: 'Log 01 · Hydrophone Intake',
      text: 'Power failed at 02:47. They did not turn off the lights—something in Wing B drank the current.',
      collected: false,
      echoVisibility: 0,
      echoDecayMax: 3.4,
      pingPulse: 0,
    },
    {
      id: 'clue-2',
      index: 2,
      pos: { x: 610, y: 1420 },
      radius: 18,
      title: 'Log 02 · Archive Tape 4B',
      text: 'The sweepers are blind. Hold Shift to soften your footsteps; every sonar ping draws the Hound.',
      collected: false,
      echoVisibility: 0,
      echoDecayMax: 3.4,
      pingPulse: 0,
    },
    {
      id: 'clue-3',
      index: 3,
      pos: { x: 1105, y: 755 },
      radius: 18,
      title: 'Log 03 · Central Baffle',
      text: 'Four acoustic keys unseal the East Bulkhead. Listen for their crystalline pitch in the dark.',
      collected: false,
      echoVisibility: 0,
      echoDecayMax: 3.4,
      pingPulse: 0,
    },
    {
      id: 'clue-4',
      index: 4,
      pos: { x: 1630, y: 1410 },
      radius: 18,
      title: 'Log 04 · Shift Supervisor',
      text: 'Seal overridden once all four relays chime. Run east when the Sentinel clicks away.',
      collected: false,
      echoVisibility: 0,
      echoDecayMax: 3.4,
      pingPulse: 0,
    },
  ];

  const exit: ExitGate = {
    pos: { x: 2040, y: 800 },
    radius: 30,
    unlocked: false,
    echoVisibility: 0,
    echoDecayMax: 3.6,
  };

  // 3 distinct entity archetypes placed away from spawn so player is safe on idle
  const entities: Entity[] = [
    {
      id: 'entity-patroller',
      kind: 'patroller',
      name: 'Sweep Ward',
      pos: { x: 620, y: 540 },
      vel: { x: 0, y: 0 },
      radius: 17,
      facing: 0,
      waypoints: [
        { x: 580, y: 510 },
        { x: 580, y: 1080 },
        { x: 890, y: 1080 },
        { x: 890, y: 510 },
      ],
      waypointIndex: 1,
      state: 'patrol',
      stateTimer: 0,
      investigateTarget: null,
      echoVisibility: 0,
      echoDecayMax: 2.2,
      soundCooldown: 1.2,
      bioPulseTimer: 2.0,
    },
    {
      id: 'entity-stalker',
      kind: 'stalker',
      name: 'Acoustic Hound',
      pos: { x: 1120, y: 310 },
      vel: { x: 0, y: 0 },
      radius: 16,
      facing: Math.PI * 0.5,
      waypoints: [
        { x: 1100, y: 280 },
        { x: 1290, y: 740 },
        { x: 1290, y: 1380 },
        { x: 930, y: 1380 },
      ],
      waypointIndex: 1,
      state: 'patrol',
      stateTimer: 0,
      investigateTarget: null,
      echoVisibility: 0,
      echoDecayMax: 2.0,
      soundCooldown: 1.8,
      bioPulseTimer: 3.1,
    },
    {
      id: 'entity-sentinel',
      kind: 'sentinel',
      name: 'Resonant Anchor',
      pos: { x: 1620, y: 520 },
      vel: { x: 0, y: 0 },
      radius: 20,
      facing: Math.PI,
      waypoints: [
        { x: 1620, y: 500 },
        { x: 1620, y: 1060 },
        { x: 1920, y: 1060 },
        { x: 1920, y: 500 },
      ],
      waypointIndex: 1,
      state: 'patrol',
      stateTimer: 0,
      investigateTarget: null,
      echoVisibility: 0,
      echoDecayMax: 2.4,
      soundCooldown: 0.9,
      bioPulseTimer: 1.6,
    },
  ];

  return {
    width,
    height,
    playerSpawn,
    walls,
    segments,
    clues,
    exit,
    entities,
  };
}
