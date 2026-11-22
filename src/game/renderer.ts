import { clamp, dist } from './math';
import { WorldState } from './types';

export function screenToWorld(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  world: WorldState,
): { x: number; y: number } {
  const cx = rect.width * 0.5;
  const cy = rect.height * 0.5;
  return {
    x: world.camera.x + (clientX - rect.left - cx),
    y: world.camera.y + (clientY - rect.top - cy),
  };
}

export function renderWorld(
  ctx: CanvasRenderingContext2D,
  world: WorldState,
  width: number,
  height: number,
): void {
  // True pitch-black void (#000000)
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  ctx.save();

  // Camera translation + decaying trauma shake
  const shakeMag = world.trauma * world.trauma * 16;
  const shakeX = shakeMag > 0.1 ? (Math.random() * 2 - 1) * shakeMag : 0;
  const shakeY = shakeMag > 0.1 ? (Math.random() * 2 - 1) * shakeMag : 0;

  ctx.translate(width * 0.5 - world.camera.x + shakeX, height * 0.5 - world.camera.y + shakeY);

  // 1. Acoustic ripples (player footsteps, bio-clicks, clue pulses)
  for (const r of world.ripples) {
    const alpha = clamp(r.life / r.maxLife, 0, 1);
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
    if (r.color === 'entity') {
      ctx.strokeStyle = `rgba(248, 113, 113, ${alpha * 0.55})`;
      ctx.lineWidth = 1.5;
    } else if (r.color === 'clue') {
      ctx.strokeStyle = `rgba(103, 232, 249, ${alpha * 0.75})`;
      ctx.lineWidth = 2;
    } else {
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.28})`;
      ctx.lineWidth = 1.25;
    }
    ctx.stroke();
  }

  // 2. Expanding Sonar Wavefronts (crisp white + muted cyan glow)
  for (const wave of world.waves) {
    const progress = clamp(wave.radius / wave.maxRadius, 0, 1);
    const alpha = (1 - progress) * (1 - progress * 0.35) * wave.intensity;
    if (alpha <= 0.01) continue;

    const startAngle = wave.isFocused ? wave.angleCenter - wave.coneHalfAngle : 0;
    const endAngle = wave.isFocused ? wave.angleCenter + wave.coneHalfAngle : Math.PI * 2;

    // Outer muted cyan atmospheric wake
    ctx.beginPath();
    ctx.arc(wave.origin.x, wave.origin.y, wave.radius, startAngle, endAngle);
    ctx.strokeStyle = `rgba(56, 189, 248, ${alpha * 0.42})`;
    ctx.lineWidth = 6;
    ctx.stroke();

    // Inner razor-sharp white wavefront
    ctx.beginPath();
    ctx.arc(wave.origin.x, wave.origin.y, wave.radius, startAngle, endAngle);
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }

  // 3. Fading Echo Segments on walls / pillars / exit frame (only visible when lit by echoes)
  ctx.lineCap = 'round';
  for (const seg of world.echoSegments) {
    const decay = clamp(seg.life / seg.maxLife, 0, 1);
    const alpha = Math.pow(decay, 1.35) * seg.intensity;
    if (alpha <= 0.012) continue;

    // Soft cyan echo glow
    ctx.beginPath();
    ctx.moveTo(seg.ax, seg.ay);
    ctx.lineTo(seg.bx, seg.by);
    if (seg.kind === 'exit') {
      ctx.strokeStyle = world.exit.unlocked
        ? `rgba(52, 211, 153, ${alpha * 0.62})`
        : `rgba(103, 232, 249, ${alpha * 0.52})`;
    } else if (seg.kind === 'pillar') {
      ctx.strokeStyle = `rgba(103, 232, 249, ${alpha * 0.48})`;
    } else {
      ctx.strokeStyle = `rgba(56, 189, 248, ${alpha * 0.45})`;
    }
    ctx.lineWidth = seg.bounce === 0 ? 5.5 : 3.5;
    ctx.stroke();

    // Crisp white wireframe core
    ctx.beginPath();
    ctx.moveTo(seg.ax, seg.ay);
    ctx.lineTo(seg.bx, seg.by);
    ctx.strokeStyle =
      seg.kind === 'exit' && world.exit.unlocked
        ? `rgba(167, 243, 208, ${alpha * 0.98})`
        : `rgba(255, 255, 255, ${alpha * 0.96})`;
    ctx.lineWidth = seg.bounce === 0 ? 1.8 : 1.1;
    ctx.stroke();
  }

  // 4. Hit Sparks at ray intersection & bounce points
  for (let i = 0; i < world.sparks.length; i++) {
    const s = world.sparks[i];
    if (!s.active) continue;
    const alpha = clamp(s.life / s.maxLife, 0, 1) * (s.bounce === 0 ? 0.9 : 0.45);
    ctx.fillStyle =
      s.kind === 'entity'
        ? `rgba(248, 113, 113, ${alpha})`
        : s.kind === 'clue'
          ? `rgba(103, 232, 249, ${alpha})`
          : `rgba(255, 255, 255, ${alpha})`;
    ctx.fillRect(s.x - 1.25, s.y - 1.25, 2.5, 2.5);
  }

  // 5. Clues (visible strictly when illuminated by sonar echo or very close proximity)
  for (const clue of world.clues) {
    if (clue.collected) continue;
    const echoAlpha = clamp(clue.echoVisibility / clue.echoDecayMax, 0, 1);
    const closeProximity = world.phase === 'playing' && dist(world.player.pos, clue.pos) < 56 ? 0.45 : 0;
    const alpha = Math.max(echoAlpha, closeProximity);
    if (alpha <= 0.02) continue;

    ctx.save();
    ctx.translate(clue.pos.x, clue.pos.y);
    ctx.rotate(Math.PI / 4);
    ctx.strokeStyle = `rgba(103, 232, 249, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(-10, -10, 20, 20);
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.85})`;
    ctx.fillRect(-3, -3, 6, 6);
    ctx.restore();
  }

  // 6. Sealed / Unlocked Exit Hatch (echo-only visibility, plus faint chime ring once unlocked)
  {
    const ex = world.exit;
    const echoAlpha = clamp(ex.echoVisibility / ex.echoDecayMax, 0, 1);
    const unlockedGlow = ex.unlocked ? 0.26 + 0.14 * Math.sin(world.elapsedTime * 4) : 0;
    const alpha = Math.max(echoAlpha, unlockedGlow);

    if (alpha > 0.02) {
      ctx.save();
      ctx.translate(ex.pos.x, ex.pos.y);
      ctx.beginPath();
      ctx.arc(0, 0, ex.radius, 0, Math.PI * 2);
      ctx.strokeStyle = ex.unlocked
        ? `rgba(52, 211, 153, ${alpha})`
        : `rgba(148, 163, 184, ${alpha * 0.75})`;
      ctx.lineWidth = 2.2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, ex.radius * 0.52, 0, Math.PI * 2);
      ctx.strokeStyle = ex.unlocked
        ? `rgba(255, 255, 255, ${alpha * 0.9})`
        : `rgba(148, 163, 184, ${alpha * 0.45})`;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.restore();
    }
  }

  // 7. Patrolling Entities (wireframe silhouettes visible ONLY when pinged or telegraphing)
  for (const ent of world.entities) {
    const echoAlpha = clamp(ent.echoVisibility / ent.echoDecayMax, 0, 1);
    const telegraphBoost = ent.state === 'telegraph' ? 0.95 : 0;
    const alpha = Math.max(echoAlpha, telegraphBoost);
    if (alpha <= 0.02) continue;

    ctx.save();
    ctx.translate(ent.pos.x, ent.pos.y);
    ctx.rotate(ent.facing);

    const isHostile = ent.state === 'chase' || ent.state === 'telegraph';
    ctx.strokeStyle = isHostile
      ? `rgba(248, 113, 113, ${alpha})`
      : `rgba(251, 146, 60, ${alpha * 0.92})`;
    ctx.lineWidth = 2;

    if (ent.kind === 'stalker') {
      // Sharp triangular hound silhouette
      ctx.beginPath();
      ctx.moveTo(ent.radius + 4, 0);
      ctx.lineTo(-ent.radius, -ent.radius * 0.85);
      ctx.lineTo(-ent.radius * 0.45, 0);
      ctx.lineTo(-ent.radius, ent.radius * 0.85);
      ctx.closePath();
      ctx.stroke();
    } else if (ent.kind === 'sentinel') {
      // Hexagonal resonant anchor
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const px = Math.cos(a) * ent.radius;
        const py = Math.sin(a) * ent.radius;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    } else {
      // Patroller diamond-eye frame
      ctx.beginPath();
      ctx.moveTo(ent.radius, 0);
      ctx.lineTo(0, ent.radius * 0.85);
      ctx.lineTo(-ent.radius, 0);
      ctx.lineTo(0, -ent.radius * 0.85);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }

  // 8. Player Marker (subtle crisp self-awareness reticle in the dark)
  if (world.phase === 'playing' || world.phase === 'paused') {
    const p = world.player;
    const blinkOff = p.invulnTimer > 0 && Math.floor(p.invulnTimer * 16) % 2 === 1;
    if (!blinkOff) {
      ctx.save();
      ctx.translate(p.pos.x, p.pos.y);
      ctx.rotate(p.facing);

      // Subtle directional aim tick
      ctx.beginPath();
      ctx.moveTo(p.radius + 5, 0);
      ctx.lineTo(p.radius + 11, 0);
      ctx.strokeStyle = 'rgba(103, 232, 249, 0.72)';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // Player ring
      ctx.beginPath();
      ctx.arc(0, 0, p.radius * 0.65, 0, Math.PI * 2);
      ctx.strokeStyle = p.sneaking ? 'rgba(148, 163, 184, 0.7)' : 'rgba(255, 255, 255, 0.92)';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();
    }
  }

  ctx.restore();
}
