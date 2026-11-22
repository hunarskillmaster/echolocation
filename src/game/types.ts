export interface Vec2 {
  x: number;
  y: number;
}

export type SurfaceKind = 'wall' | 'pillar' | 'exit' | 'clue' | 'entity';

export interface Segment {
  id: string;
  a: Vec2;
  b: Vec2;
  nx: number;
  ny: number;
  kind: 'wall' | 'pillar' | 'exit';
}

export interface WallRect {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'wall' | 'pillar';
}

export interface ClueNode {
  id: string;
  index: number;
  pos: Vec2;
  radius: number;
  title: string;
  text: string;
  collected: boolean;
  echoVisibility: number;
  echoDecayMax: number;
  pingPulse: number;
}

export interface ExitGate {
  pos: Vec2;
  radius: number;
  unlocked: boolean;
  echoVisibility: number;
  echoDecayMax: number;
}

export type EntityKind = 'patroller' | 'stalker' | 'sentinel';

export type EntityAlertState = 'patrol' | 'investigate' | 'telegraph' | 'chase';

export interface Entity {
  id: string;
  kind: EntityKind;
  name: string;
  pos: Vec2;
  vel: Vec2;
  radius: number;
  facing: number;
  waypoints: Vec2[];
  waypointIndex: number;
  state: EntityAlertState;
  stateTimer: number;
  investigateTarget: Vec2 | null;
  echoVisibility: number;
  echoDecayMax: number;
  soundCooldown: number;
  bioPulseTimer: number;
}

export interface EchoSegment {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  kind: SurfaceKind;
  intensity: number;
  life: number;
  maxLife: number;
  bounce: number;
}

export interface HitSpark {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  kind: SurfaceKind;
  bounce: number;
}

export interface SonarWave {
  origin: Vec2;
  radius: number;
  maxRadius: number;
  speed: number;
  angleCenter: number;
  coneHalfAngle: number; // Math.PI for full 360
  isFocused: boolean;
  intensity: number;
}

export interface SoundRipple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  color: 'player' | 'entity' | 'clue';
}

export interface RayHit {
  point: Vec2;
  normal: Vec2;
  distance: number;
  segment: Segment | null;
  kind: SurfaceKind;
  entityId?: string;
  clueId?: string;
  bounce: number;
}

export interface PlayerState {
  pos: Vec2;
  vel: Vec2;
  radius: number;
  facing: number;
  integrity: number;
  maxIntegrity: number;
  invulnTimer: number;
  echoCharge: number;
  maxEchoCharge: number;
  pulseCooldown: number;
  stepDistanceAccum: number;
  sneaking: boolean;
  lastNoiseLevel: 'QUIET' | 'STEP' | 'PING';
  noiseDisplayTimer: number;
}

export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

export type GameOutcome = 'none' | 'victory' | 'defeat';

export interface ActiveClueMessage {
  title: string;
  text: string;
  timer: number;
  maxTimer: number;
}

export interface GameEvent {
  type:
    | 'sonar_emit'
    | 'echo_return'
    | 'footstep'
    | 'clue_collected'
    | 'exit_unlocked'
    | 'entity_sound'
    | 'entity_telegraph'
    | 'player_hit'
    | 'victory'
    | 'defeat';
  pan: number;
  distanceRatio?: number;
  surfaceKind?: SurfaceKind;
  entityKind?: EntityKind;
  isFocused?: boolean;
  sneaking?: boolean;
  speedRatio?: number;
}

export interface WorldState {
  phase: GamePhase;
  outcome: GameOutcome;
  width: number;
  height: number;
  segments: Segment[];
  walls: WallRect[];
  player: PlayerState;
  clues: ClueNode[];
  exit: ExitGate;
  entities: Entity[];
  echoSegments: EchoSegment[];
  sparks: HitSpark[];
  sparkCursor: number;
  waves: SonarWave[];
  ripples: SoundRipple[];
  camera: Vec2;
  trauma: number;
  hitstopTimer: number;
  elapsedTime: number;
  pulsesUsed: number;
  cluesCollected: number;
  totalClues: number;
  activeClue: ActiveClueMessage | null;
  phantomTimer: number;
  events: GameEvent[];
}

export interface HudSnapshot {
  phase: GamePhase;
  outcome: GameOutcome;
  integrity: number;
  maxIntegrity: number;
  echoCharge: number;
  maxEchoCharge: number;
  cluesCollected: number;
  totalClues: number;
  exitUnlocked: boolean;
  elapsedSeconds: number;
  pulsesUsed: number;
  noiseLevel: 'QUIET' | 'STEP' | 'PING';
  activeClue: { title: string; text: string } | null;
  nearestDangerRatio: number; // 0 = safe, 1 = very close
}

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  sneak: boolean;
  mouseWorld: Vec2;
  pulseDirectionalJustPressed: boolean;
  pulseOmniJustPressed: boolean;
}
