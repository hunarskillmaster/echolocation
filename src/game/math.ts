import { RayHit, Segment, SurfaceKind, Vec2, WallRect } from './types';

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function distSq(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function normalize(v: Vec2): Vec2 {
  const len = Math.hypot(v.x, v.y);
  if (len < 1e-6) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

// returns [-0.92, 0.92] - positive = right speaker
export function computeStereoPan(listener: Vec2, source: Vec2, maxPanDist = 520): number {
  return clamp((source.x - listener.x) / maxPanDist, -0.92, 0.92);
}

export function rectToSegments(rect: WallRect, prefix: string): Segment[] {
  const { x, y, w, h, kind } = rect;
  const tl = { x, y };
  const tr = { x: x + w, y };
  const br = { x: x + w, y: y + h };
  const bl = { x, y: y + h };

  return [
    { id: `${prefix}-t`, a: tl, b: tr, nx: 0, ny: -1, kind },
    { id: `${prefix}-r`, a: tr, b: br, nx: 1, ny: 0, kind },
    { id: `${prefix}-b`, a: br, b: bl, nx: 0, ny: 1, kind },
    { id: `${prefix}-l`, a: bl, b: tl, nx: -1, ny: 0, kind },
  ];
}

export interface RaySegmentIntersection {
  t: number; // distance along unit ray
  u: number; // [0..1] along segment
  point: Vec2;
  normal: Vec2;
}

export function intersectRaySegment(
  origin: Vec2,
  dir: Vec2,
  seg: Segment,
  maxDist: number,
): RaySegmentIntersection | null {
  const rx = dir.x;
  const ry = dir.y;
  const sx = seg.b.x - seg.a.x;
  const sy = seg.b.y - seg.a.y;

  const denom = rx * sy - ry * sx;
  if (Math.abs(denom) < 1e-7) return null; // parallel

  const qpx = seg.a.x - origin.x;
  const qpy = seg.a.y - origin.y;

  const t = (qpx * sy - qpy * sx) / denom;
  if (t < 0.5 || t > maxDist) return null;

  const u = (qpx * ry - qpy * rx) / denom;
  if (u < 0 || u > 1) return null;

  // flip normal to face toward ray origin
  let nx = seg.nx;
  let ny = seg.ny;
  if (rx * nx + ry * ny > 0) {
    nx = -nx;
    ny = -ny;
  }

  return {
    t,
    u,
    point: {
      x: origin.x + rx * t,
      y: origin.y + ry * t,
    },
    normal: { x: nx, y: ny },
  };
}

export interface CircleTarget {
  id: string;
  pos: Vec2;
  radius: number;
  kind: 'entity' | 'clue' | 'exit';
}

export function intersectRayCircle(
  origin: Vec2,
  dir: Vec2,
  center: Vec2,
  radius: number,
  maxDist: number,
): { t: number; point: Vec2; normal: Vec2 } | null {
  const fx = origin.x - center.x;
  const fy = origin.y - center.y;
  const b = 2 * (fx * dir.x + fy * dir.y);
  const c = fx * fx + fy * fy - radius * radius;
  const disc = b * b - 4 * c;
  if (disc < 0) return null;
  const sqrtDisc = Math.sqrt(disc);
  const t1 = (-b - sqrtDisc) / 2;
  const t = t1 >= 0.5 ? t1 : (-b + sqrtDisc) / 2;
  if (t < 0.5 || t > maxDist) return null;
  const px = origin.x + dir.x * t;
  const py = origin.y + dir.y * t;
  const n = normalize({ x: px - center.x, y: py - center.y });
  return { t, point: { x: px, y: py }, normal: n };
}

export function reflectVector(dir: Vec2, normal: Vec2): Vec2 {
  const dot = dir.x * normal.x + dir.y * normal.y;
  return normalize({
    x: dir.x - 2 * dot * normal.x,
    y: dir.y - 2 * dot * normal.y,
  });
}

export function castRayWithBounces(
  origin: Vec2,
  initialAngle: number,
  segments: Segment[],
  circles: CircleTarget[],
  maxTotalDist: number,
  maxBounces = 2,
): RayHit[] {
  const hits: RayHit[] = [];
  let curOrigin = { x: origin.x, y: origin.y };
  let curDir = { x: Math.cos(initialAngle), y: Math.sin(initialAngle) };
  let remainingDist = maxTotalDist;

  for (let bounce = 0; bounce <= maxBounces; bounce++) {
    let bestT = remainingDist;
    let bestHit: RayHit | null = null;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const res = intersectRaySegment(curOrigin, curDir, seg, bestT);
      if (res && res.t < bestT) {
        bestT = res.t;
        bestHit = {
          point: res.point,
          normal: res.normal,
          distance: res.t,
          segment: seg,
          kind: seg.kind,
          bounce,
        };
      }
    }

    for (let i = 0; i < circles.length; i++) {
      const circle = circles[i];
      const res = intersectRayCircle(curOrigin, curDir, circle.pos, circle.radius, bestT);
      if (res && res.t < bestT) {
        bestT = res.t;
        bestHit = {
          point: res.point,
          normal: res.normal,
          distance: res.t,
          segment: null,
          kind: circle.kind as SurfaceKind,
          entityId: circle.kind === 'entity' ? circle.id : undefined,
          clueId: circle.kind === 'clue' ? circle.id : undefined,
          bounce,
        };
      }
    }

    if (!bestHit) break;

    hits.push(bestHit);
    remainingDist -= bestHit.distance;
    if (remainingDist < 28) break;

    // soft objects absorb the ray instead of reflecting it
    if (bestHit.kind === 'entity' || bestHit.kind === 'clue') {
      break;
    }

    curDir = reflectVector(curDir, bestHit.normal);
    curOrigin = {
      x: bestHit.point.x + bestHit.normal.x * 1.2,
      y: bestHit.point.y + bestHit.normal.y * 1.2,
    };
  }

  return hits;
}

export function resolveCircleWallCollisions(
  pos: Vec2,
  radius: number,
  walls: WallRect[],
  worldW: number,
  worldH: number,
): Vec2 {
  let x = clamp(pos.x, radius + 24, worldW - radius - 24);
  let y = clamp(pos.y, radius + 24, worldH - radius - 24);

  // two passes helps with corner cases (pun intended)
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < walls.length; i++) {
      const w = walls[i];
      const closestX = clamp(x, w.x, w.x + w.w);
      const closestY = clamp(y, w.y, w.y + w.h);
      const dx = x - closestX;
      const dy = y - closestY;
      const dSq = dx * dx + dy * dy;

      if (dSq < radius * radius) {
        const d = Math.sqrt(dSq);
        if (d > 1e-5) {
          const overlap = radius - d;
          x += (dx / d) * overlap;
          y += (dy / d) * overlap;
        } else {
          // center is inside the rect, push out along shortest axis
          const leftPen = x - w.x;
          const rightPen = w.x + w.w - x;
          const topPen = y - w.y;
          const bottomPen = w.y + w.h - y;
          const minPen = Math.min(leftPen, rightPen, topPen, bottomPen);
          if (minPen === leftPen) x = w.x - radius;
          else if (minPen === rightPen) x = w.x + w.w + radius;
          else if (minPen === topPen) y = w.y - radius;
          else y = w.y + w.h + radius;
        }
      }
    }
  }

  return { x, y };
}

export function hasLineOfSight(a: Vec2, b: Vec2, segments: Segment[]): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const totalDist = Math.hypot(dx, dy);
  if (totalDist < 1) return true;
  const dir = { x: dx / totalDist, y: dy / totalDist };

  for (let i = 0; i < segments.length; i++) {
    const hit = intersectRaySegment(a, dir, segments[i], totalDist - 2);
    if (hit) return false;
  }
  return true;
}
