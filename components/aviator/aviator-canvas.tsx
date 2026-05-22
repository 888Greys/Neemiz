"use client";

import { useEffect, useRef } from "react";
import type { AviatorRoundState } from "@/lib/aviator/types";

interface Props {
  state:            AviatorRoundState;
  multiplier:       number;
  crashPoint?:      number;
  bettingEndsAt?:   string | null;
  flyingStartedAt?: string | null;
}

interface Star     { x: number; y: number; r: number; alpha: number; speed: number }
interface Particle { x: number; y: number; vx: number; vy: number; alpha: number; r: number; color: string }

const GROWTH_RATE = 0.00006;
function multToElapsed(m: number) { return Math.log(Math.max(m, 1.001)) / GROWTH_RATE; }

export function AviatorCanvas({ state, multiplier, crashPoint, bettingEndsAt }: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const starsRef     = useRef<Star[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const crashedRef   = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const obs = new ResizeObserver(() => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      starsRef.current = genStars(canvas.width, canvas.height);
    });
    obs.observe(canvas);
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    starsRef.current = genStars(canvas.width, canvas.height);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (state === "WAITING" || state === "BETTING") {
      crashedRef.current   = false;
      particlesRef.current = [];
    }
    if (state === "CRASHED" && !crashedRef.current) crashedRef.current = true;
  }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let id: number;
    const loop = () => {
      draw(ctx, canvas.width, canvas.height, {
        state, multiplier, crashPoint, bettingEndsAt,
        stars: starsRef.current, particles: particlesRef.current, crashed: crashedRef.current,
      });
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [state, multiplier, crashPoint, bettingEndsAt]);

  return <canvas ref={canvasRef} className="h-full w-full" style={{ display: "block" }} />;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function genStars(w: number, h: number): Star[] {
  return Array.from({ length: 70 }, () => ({
    x: Math.random() * w, y: Math.random() * h,
    r: Math.random() * 1.1 + 0.2,
    alpha: Math.random() * 0.4 + 0.15,
    speed: Math.random() * 0.3 + 0.05,
  }));
}

function drawSunburst(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number, isCrashed: boolean) {
  const maxR   = Math.sqrt(w * w + h * h) * 1.3;
  const rays   = 20;
  const spread = Math.PI * 0.85;          // fan covers ~153°
  const base   = -Math.PI * 0.02;         // start just below horizontal

  ctx.save();
  for (let i = 0; i < rays; i++) {
    if (i % 2 === 0) continue;            // only every other wedge visible
    const a1 = base - (i / rays) * spread;
    const a2 = a1   - (spread / rays);
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.arc(ox, oy, maxR, a1, a2, true);
    ctx.closePath();
    ctx.fillStyle = isCrashed
      ? "rgba(255,40,40,0.028)"
      : "rgba(255,255,255,0.022)";
    ctx.fill();
  }
  ctx.restore();
}

// ─── Main draw ────────────────────────────────────────────────────────────────

function draw(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  opts: {
    state: AviatorRoundState; multiplier: number; crashPoint?: number;
    bettingEndsAt?: string | null;
    stars: Star[]; particles: Particle[]; crashed: boolean;
  },
) {
  const { state, multiplier, crashPoint, bettingEndsAt, stars, particles } = opts;
  const isCrashed = state === "CRASHED";
  const isFlying  = state === "FLYING";

  // ── Background ──────────────────────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#080b14");
  bg.addColorStop(1, "#050709");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // ── Stars ───────────────────────────────────────────────────────────
  stars.forEach((s) => {
    s.alpha += Math.sin(Date.now() * s.speed * 0.001) * 0.006;
    s.alpha  = Math.max(0.08, Math.min(0.7, s.alpha));
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${s.alpha})`;
    ctx.fill();
  });

  const ORIGIN_X = w * 0.08;
  const ORIGIN_Y = h - 30;
  const MAX_X    = w * 0.92;
  const MAX_Y    = 30;

  // ── Sunburst rays ────────────────────────────────────────────────────
  drawSunburst(ctx, ORIGIN_X, ORIGIN_Y, w, h, isCrashed);

  // ── Ground line ──────────────────────────────────────────────────────
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(0, ORIGIN_Y);
  ctx.lineTo(w, ORIGIN_Y);
  ctx.stroke();

  // ── Origin dot ───────────────────────────────────────────────────────
  ctx.beginPath();
  ctx.arc(ORIGIN_X, ORIGIN_Y, 3, 0, Math.PI * 2);
  ctx.fillStyle = isCrashed ? "#ff3030" : "#00ff88";
  ctx.fill();

  // ── Betting / waiting state ──────────────────────────────────────────
  if (state === "WAITING" || state === "BETTING") {
    drawIdleState(ctx, w, h, ORIGIN_X, ORIGIN_Y, state, bettingEndsAt);
    return;
  }

  // ── Curve ────────────────────────────────────────────────────────────
  const displayMult  = isCrashed ? (crashPoint ?? multiplier) : multiplier;
  const totalElapsed = multToElapsed(displayMult);

  const normX = (ms: number) => ORIGIN_X + (ms / totalElapsed) * (MAX_X - ORIGIN_X);
  const normY = (m: number)  => ORIGIN_Y - (Math.log(m) / Math.log(displayMult)) * (ORIGIN_Y - MAX_Y);

  const STEPS = 80;

  // Fill under curve
  ctx.beginPath();
  ctx.moveTo(ORIGIN_X, ORIGIN_Y);
  for (let i = 1; i <= STEPS; i++) {
    const t = i / STEPS;
    ctx.lineTo(normX(t * totalElapsed), normY(Math.exp(GROWTH_RATE * t * totalElapsed)));
  }
  ctx.lineTo(normX(totalElapsed), ORIGIN_Y);
  ctx.closePath();
  const fillGrad = ctx.createLinearGradient(ORIGIN_X, ORIGIN_Y, ORIGIN_X, MAX_Y);
  fillGrad.addColorStop(0, isCrashed ? "rgba(255,40,40,0.22)" : "rgba(0,255,136,0.18)");
  fillGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = fillGrad;
  ctx.fill();

  // Curve line
  ctx.beginPath();
  ctx.moveTo(ORIGIN_X, ORIGIN_Y);
  for (let i = 1; i <= STEPS; i++) {
    const t = i / STEPS;
    ctx.lineTo(normX(t * totalElapsed), normY(Math.exp(GROWTH_RATE * t * totalElapsed)));
  }
  ctx.strokeStyle = isCrashed ? "#ff3030" : "#00ff88";
  ctx.lineWidth   = 2.5;
  ctx.shadowColor = isCrashed ? "#ff3030" : "#00ff88";
  ctx.shadowBlur  = 12;
  ctx.stroke();
  ctx.shadowBlur  = 0;

  const tipX = normX(totalElapsed);
  const tipY = normY(displayMult);

  // ── Plane or explosion ────────────────────────────────────────────────
  if (isCrashed) {
    if (particles.length === 0) {
      for (let i = 0; i < 50; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd   = Math.random() * 5 + 1.5;
        particles.push({
          x: tipX, y: tipY,
          vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
          alpha: 1, r: Math.random() * 3 + 1,
          color: Math.random() > 0.5 ? "#ff4444" : "#ffaa00",
        });
      }
    }
    particles.forEach((p) => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.alpha -= 0.012;
      if (p.alpha <= 0) return;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle   = p.color;
      ctx.fill();
      ctx.globalAlpha = 1;
    });
    // "FLEW AWAY!" text
    const fs = Math.min(w * 0.065, 40);
    ctx.font      = `900 ${fs}px Inter,sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = "#ff3030";
    ctx.shadowColor= "#ff3030";
    ctx.shadowBlur = 22;
    ctx.fillText("FLEW AWAY!", w / 2, h / 2 - 14);
    ctx.shadowBlur = 0;
  } else {
    drawPlane(ctx, tipX, tipY, displayMult);
    // Plane trail
    drawTrail(ctx, tipX, tipY);
  }

  // ── Multiplier display ────────────────────────────────────────────────
  const multColor = isCrashed    ? "#ff4444"
    : displayMult >= 10          ? "#c084fc"
    : displayMult >= 5           ? "#fb923c"
    : displayMult >= 2           ? "#facc15"
    :                              "#ffffff";

  const fs = Math.min(w * 0.10, 64);
  ctx.font        = `900 ${fs}px Inter,sans-serif`;
  ctx.textAlign   = "center";
  ctx.shadowColor = multColor;
  ctx.shadowBlur  = 28;
  ctx.fillStyle   = multColor;
  ctx.fillText(`${displayMult.toFixed(2)}x`, w / 2, h / 2 + fs * 0.38);
  ctx.shadowBlur  = 0;

  ctx.font      = `bold ${fs * 0.28}px Inter,sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillText(isCrashed ? "CRASHED" : "Current Multiplier", w / 2, h / 2 + fs * 0.82);
}

// ─── Plane ───────────────────────────────────────────────────────────────────

function drawPlane(ctx: CanvasRenderingContext2D, x: number, y: number, mult: number) {
  const angle = -Math.PI / 5;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  ctx.shadowColor = "#00ff88";
  ctx.shadowBlur  = 18;

  // Body
  ctx.fillStyle = "#f0f0f0";
  ctx.beginPath();
  ctx.moveTo(24, 0);
  ctx.lineTo(-10, -5);
  ctx.lineTo(-15, 0);
  ctx.lineTo(-10, 5);
  ctx.closePath();
  ctx.fill();

  // Window
  ctx.fillStyle = "#00ccff";
  ctx.beginPath();
  ctx.ellipse(8, -2, 4, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wing
  ctx.fillStyle = mult >= 3 ? "#facc15" : "#7dd3fc";
  ctx.beginPath();
  ctx.moveTo(2, 0); ctx.lineTo(-7, -16); ctx.lineTo(-13, -2);
  ctx.closePath();
  ctx.fill();

  // Tail
  ctx.fillStyle = mult >= 3 ? "#facc15" : "#7dd3fc";
  ctx.beginPath();
  ctx.moveTo(-10, 0); ctx.lineTo(-19, -9); ctx.lineTo(-14, 0);
  ctx.closePath();
  ctx.fill();

  // Engine glow
  ctx.shadowColor = "#ff6600";
  ctx.shadowBlur  = 14;
  ctx.fillStyle   = "#ff8833";
  ctx.beginPath();
  ctx.ellipse(-15, 0, 6, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.restore();
}

// ─── Trail ───────────────────────────────────────────────────────────────────

function drawTrail(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const angle = -Math.PI / 5;
  const len   = 28;
  const ex    = x + Math.cos(Math.PI + angle) * len;
  const ey    = y + Math.sin(Math.PI + angle) * len;
  const grad  = ctx.createLinearGradient(x, y, ex, ey);
  grad.addColorStop(0, "rgba(255,160,60,0.8)");
  grad.addColorStop(0.4, "rgba(255,80,0,0.4)");
  grad.addColorStop(1, "rgba(255,80,0,0)");
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(ex, ey);
  ctx.strokeStyle = grad;
  ctx.lineWidth   = 5;
  ctx.lineCap     = "round";
  ctx.shadowColor = "#ff6600";
  ctx.shadowBlur  = 10;
  ctx.stroke();
  ctx.shadowBlur  = 0;
}

// ─── Idle state ───────────────────────────────────────────────────────────────

function drawIdleState(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  ox: number, oy: number,
  state: AviatorRoundState,
  bettingEndsAt?: string | null,
) {
  // Idle plane bobbing at origin
  const bob = Math.sin(Date.now() * 0.002) * 4;
  drawPlane(ctx, ox + 20, oy - 18 + bob, 1);

  const isBetting = state === "BETTING";
  const label     = isBetting ? "Place your bets" : "Waiting for next round";

  ctx.font      = `900 ${Math.min(w * 0.048, 32)}px Inter,sans-serif`;
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.80)";
  ctx.fillText(label, w / 2, h / 2 - 18);

  if (isBetting && bettingEndsAt) {
    const rem = Math.max(0, Math.ceil((new Date(bettingEndsAt).getTime() - Date.now()) / 1000));
    ctx.font      = `900 ${Math.min(w * 0.13, 78)}px Inter,sans-serif`;
    ctx.fillStyle = rem <= 3 ? "#ff4444" : "#00ff88";
    ctx.shadowColor= rem <= 3 ? "#ff4444" : "#00ff88";
    ctx.shadowBlur = 28;
    ctx.fillText(`${rem}`, w / 2, h / 2 + 50);
    ctx.shadowBlur = 0;
  } else {
    const dots = ".".repeat(Math.floor(Date.now() / 500) % 4);
    ctx.font      = `bold ${Math.min(w * 0.055, 34)}px Inter,sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillText(dots, w / 2, h / 2 + 28);
  }
}
