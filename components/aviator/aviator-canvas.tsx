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

function calculateMultiplier(elapsed: number) {
  return 1 + elapsed / 1.5 + elapsed * elapsed * 0.005;
}

function multToElapsed(m: number) {
  const target = Math.max(m, 1.001) - 1;
  const a = 0.005;
  const b = 1 / 1.5;
  return (-b + Math.sqrt(b * b + 4 * a * target)) / (2 * a);
}

export function AviatorCanvas({ state, crashPoint, bettingEndsAt, flyingStartedAt }: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const starsRef     = useRef<Star[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const crashedRef   = useRef(false);

  // ── Props as refs — never cause RAF loop restarts ──────────────────────────
  const stateRef           = useRef(state);
  const crashPointRef      = useRef(crashPoint);
  const bettingEndsAtRef   = useRef(bettingEndsAt);
  const flyingStartedAtRef = useRef(flyingStartedAt);

  useEffect(() => { stateRef.current           = state;          }, [state]);
  useEffect(() => { crashPointRef.current      = crashPoint;     }, [crashPoint]);
  useEffect(() => { bettingEndsAtRef.current   = bettingEndsAt;  }, [bettingEndsAt]);
  useEffect(() => { flyingStartedAtRef.current = flyingStartedAt; }, [flyingStartedAt]);

  // Reset particles on new round
  useEffect(() => {
    if (state === "WAITING" || state === "BETTING") {
      crashedRef.current   = false;
      particlesRef.current = [];
    }
    if (state === "CRASHED" && !crashedRef.current) crashedRef.current = true;
  }, [state]);

  // ── Canvas resize ──────────────────────────────────────────────────────────
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

  // ── Single permanent RAF loop — NEVER restarted, reads refs each frame ─────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let id: number;

    const loop = () => {
      const currentState = stateRef.current;
      const isFlying     = currentState === "FLYING";
      const isCrashed    = currentState === "CRASHED";

      // Compute multiplier live from flyingStartedAt (true 60fps, no React state)
      let currentMult = 1.0;
      if (isFlying && flyingStartedAtRef.current) {
        const elapsed = Math.max(0, Date.now() - new Date(flyingStartedAtRef.current).getTime()) / 1000;
        currentMult = calculateMultiplier(elapsed);
      } else if (isCrashed) {
        currentMult = crashPointRef.current ?? 1.0;
      }

      draw(ctx, canvas.width, canvas.height, {
        state:         currentState,
        multiplier:    currentMult,
        crashPoint:    crashPointRef.current,
        bettingEndsAt: bettingEndsAtRef.current,
        stars:         starsRef.current,
        particles:     particlesRef.current,
        crashed:       crashedRef.current,
      });

      id = requestAnimationFrame(loop);
    };

    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, []); // ← empty deps: one loop, runs forever, zero restarts

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
  const compact   = w < 520;

  // ── Background ──────────────────────────────────────────────────────────
  const bg = ctx.createRadialGradient(w * 0.5, h * 0.35, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.9);
  bg.addColorStop(0, "#111118");
  bg.addColorStop(0.5, "#0a0a0d");
  bg.addColorStop(1, "#030303");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Subtle edge vignette
  const vignette = ctx.createLinearGradient(0, 0, 0, h);
  vignette.addColorStop(0, "rgba(0,0,0,0.45)");
  vignette.addColorStop(0.3, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);

  // ── Stars ────────────────────────────────────────────────────────────────
  stars.forEach((s) => {
    s.alpha += Math.sin(Date.now() * s.speed * 0.001) * 0.006;
    s.alpha  = Math.max(0.08, Math.min(0.7, s.alpha));
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${s.alpha})`;
    ctx.fill();
  });

  // Origin at TOP-LEFT; endpoint at BOTTOM-RIGHT
  // Line curves DOWNWARD from top-left to bottom-right
  const ORIGIN_X = compact ? w * 0.11 : w * 0.08;
  const ORIGIN_Y = compact ? 34 : 28;              // near top
  const MAX_X    = compact ? w * 0.88 : w * 0.92;
  const MAX_Y    = h - (compact ? 36 : 30);        // near bottom

  // ── Guide lines ──────────────────────────────────────────────────────────
  // Vertical line on left (launch column)
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(ORIGIN_X, ORIGIN_Y);
  ctx.lineTo(ORIGIN_X, h);
  ctx.stroke();
  // Horizontal line at bottom
  ctx.beginPath();
  ctx.moveTo(ORIGIN_X, MAX_Y);
  ctx.lineTo(w, MAX_Y);
  ctx.stroke();

  // ── Origin dot ───────────────────────────────────────────────────────────
  ctx.beginPath();
  ctx.arc(ORIGIN_X, ORIGIN_Y, 3, 0, Math.PI * 2);
  ctx.fillStyle = "#ff1838";
  ctx.fill();

  // ── Idle states ──────────────────────────────────────────────────────────
  if (state === "WAITING" || state === "BETTING") {
    drawIdleState(ctx, w, h, ORIGIN_X, ORIGIN_Y, state, bettingEndsAt);
    return;
  }

  // ── Curve ────────────────────────────────────────────────────────────────
  const displayMult  = isCrashed ? (crashPoint ?? multiplier) : multiplier;
  const totalElapsed = Math.max(0.1, multToElapsed(displayMult));

  // normX: linear across canvas width
  const normX    = (seconds: number) => ORIGIN_X + (seconds / totalElapsed) * (MAX_X - ORIGIN_X);
  const logDenom = Math.log(Math.max(displayMult, 1.0001));
  // normY: as multiplier grows, Y increases → line descends (curves DOWN)
  const normY    = (m: number) => ORIGIN_Y + (Math.log(Math.max(m, 1)) / logDenom) * (MAX_Y - ORIGIN_Y);

  const STEPS = 80;

  // Fill: area above the curve (between top edge at ORIGIN_Y and the curve itself)
  ctx.beginPath();
  ctx.moveTo(ORIGIN_X, ORIGIN_Y);
  for (let i = 1; i <= STEPS; i++) {
    const t = i / STEPS;
    ctx.lineTo(normX(t * totalElapsed), normY(calculateMultiplier(t * totalElapsed)));
  }
  // Return along top edge back to origin
  ctx.lineTo(normX(totalElapsed), ORIGIN_Y);
  ctx.closePath();
  const fillGrad = ctx.createLinearGradient(ORIGIN_X, ORIGIN_Y, ORIGIN_X, MAX_Y);
  fillGrad.addColorStop(0,    "rgba(255,24,56,0)");
  fillGrad.addColorStop(0.35, "rgba(255,24,56,0.12)");
  fillGrad.addColorStop(1,    "rgba(255,24,56,0.40)");
  ctx.fillStyle = fillGrad;
  ctx.fill();

  // Curve line
  ctx.beginPath();
  ctx.moveTo(ORIGIN_X, ORIGIN_Y);
  for (let i = 1; i <= STEPS; i++) {
    const t = i / STEPS;
    ctx.lineTo(normX(t * totalElapsed), normY(calculateMultiplier(t * totalElapsed)));
  }
  ctx.strokeStyle = "#ff1838";
  ctx.lineWidth   = compact ? 2 : 2.5;
  ctx.shadowColor = "#ff1838";
  ctx.shadowBlur  = 18;
  ctx.stroke();
  ctx.shadowBlur  = 0;

  const tipX = normX(totalElapsed);
  const tipY = normY(displayMult);

  // Compute plane angle from curve slope at the tip (faces down-right)
  const prevT      = Math.max(0.01, totalElapsed * 0.96);
  const planeAngle = Math.atan2(
    tipY - normY(calculateMultiplier(prevT)),
    tipX - normX(prevT),
  );

  // ── Plane or explosion ────────────────────────────────────────────────────
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
    const fs = Math.min(w * (compact ? 0.075 : 0.065), compact ? 30 : 40);
    ctx.font       = `900 ${fs}px Inter,sans-serif`;
    ctx.textAlign  = "center";
    ctx.fillStyle  = "#ff3030";
    ctx.shadowColor= "#ff3030";
    ctx.shadowBlur = 22;
    ctx.fillText("FLEW AWAY!", w / 2, h * (compact ? 0.36 : 0.42));
    ctx.shadowBlur = 0;
  } else {
    drawPlane(ctx, tipX, tipY, planeAngle, compact ? 0.82 : 1);
    drawTrail(ctx, tipX, tipY, planeAngle);
  }

  // ── Multiplier display ────────────────────────────────────────────────────
  const multColor = isCrashed       ? "#ff4444"
    : displayMult >= 10             ? "#ff2aa8"
    : displayMult >= 5              ? "#8b5cf6"
    :                                 "#ffffff";

  const fs = Math.min(w * (compact ? 0.16 : 0.10), compact ? 54 : 64);
  ctx.font        = `900 ${fs}px Inter,sans-serif`;
  ctx.textAlign   = "center";
  ctx.shadowColor = multColor;
  ctx.shadowBlur  = 28;
  ctx.fillStyle   = multColor;
  ctx.fillText(`${displayMult.toFixed(2)}x`, w / 2, h * (compact ? 0.52 : 0.5) + fs * 0.18);
  ctx.shadowBlur  = 0;

  ctx.font      = `bold ${fs * 0.28}px Inter,sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillText(isCrashed ? "CRASHED" : "Current Multiplier", w / 2, h * (compact ? 0.52 : 0.5) + fs * 0.58);
}

// ─── Plane ───────────────────────────────────────────────────────────────────

function drawPlane(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);

  ctx.shadowColor = "#ff1838";
  ctx.shadowBlur  = 20;

  ctx.fillStyle = "#ff1838";
  ctx.beginPath();
  ctx.moveTo(30, 0); ctx.lineTo(-12, -7); ctx.lineTo(-18, 0); ctx.lineTo(-12, 7);
  ctx.closePath(); ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath(); ctx.ellipse(11, -2, 4.5, 3.2, 0, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = "#ff4d63";
  ctx.beginPath();
  ctx.moveTo(4, 0); ctx.lineTo(-7, -18); ctx.lineTo(-15, -2);
  ctx.closePath(); ctx.fill();

  ctx.fillStyle = "#ff4d63";
  ctx.beginPath();
  ctx.moveTo(-11, 0); ctx.lineTo(-21, -10); ctx.lineTo(-15, 0);
  ctx.closePath(); ctx.fill();

  ctx.shadowColor = "#ff1838";
  ctx.shadowBlur  = 14;
  ctx.fillStyle   = "#ffffff";
  ctx.beginPath(); ctx.ellipse(-15, 0, 6, 3, 0, 0, Math.PI * 2); ctx.fill();

  ctx.shadowBlur = 0;
  ctx.restore();
}

// ─── Trail ───────────────────────────────────────────────────────────────────

function drawTrail(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number) {
  const len  = 28;
  const ex   = x + Math.cos(Math.PI + angle) * len;
  const ey   = y + Math.sin(Math.PI + angle) * len;
  const grad = ctx.createLinearGradient(x, y, ex, ey);
  grad.addColorStop(0,   "rgba(255,24,56,0.9)");
  grad.addColorStop(0.4, "rgba(255,24,56,0.5)");
  grad.addColorStop(1,   "rgba(255,24,56,0)");
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(ex, ey);
  ctx.strokeStyle = grad;
  ctx.lineWidth   = 5;
  ctx.lineCap     = "round";
  ctx.shadowColor = "#ff1838";
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
  const cx      = w / 2;
  const cy      = h / 2;
  const compact = w < 520;
  const isBetting = state === "BETTING";

  if (isBetting) {
    // ── "STARTING IN" label ─────────────────────────────────────────────
    const labelFs = Math.min(w * 0.038, 20);
    ctx.font      = `700 ${labelFs}px Inter,sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillText("STARTING IN", cx, cy - (compact ? 54 : 62));

    if (bettingEndsAt) {
      const TOTAL_MS  = 5000;
      const endMs     = new Date(bettingEndsAt).getTime();
      const remaining = Math.max(0, endMs - Date.now());
      const progress  = Math.max(0, Math.min(1, remaining / TOTAL_MS));
      const remSec    = Math.ceil(remaining / 1000);
      const urgent    = remSec <= 2;

      const ringR = Math.min(w * 0.14, compact ? 44 : 54);
      const ringY = cy - (compact ? 4 : 6);
      const ringW = Math.max(4, ringR * 0.18);
      const color = urgent ? "#ff1838" : "#ffffff";

      // Outer track
      ctx.beginPath();
      ctx.arc(cx, ringY, ringR, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.lineWidth   = ringW;
      ctx.stroke();

      // Progress arc (starts at top, sweeps clockwise, depletes as time runs out)
      if (progress > 0) {
        const startAngle = -Math.PI / 2;
        const endAngle   = startAngle + (Math.PI * 2 * progress);
        ctx.beginPath();
        ctx.arc(cx, ringY, ringR, startAngle, endAngle);
        ctx.strokeStyle = color;
        ctx.lineWidth   = ringW;
        ctx.lineCap     = "round";
        ctx.shadowColor = color;
        ctx.shadowBlur  = urgent ? 20 : 12;
        ctx.stroke();
        ctx.shadowBlur  = 0;
        ctx.lineCap     = "butt";
      }

      // Number in center
      const numFs = Math.min(w * 0.13, compact ? 46 : 56);
      ctx.font        = `900 ${numFs}px Inter,sans-serif`;
      ctx.textAlign   = "center";
      ctx.fillStyle   = color;
      ctx.shadowColor = color;
      ctx.shadowBlur  = urgent ? 30 : 16;
      ctx.fillText(`${remSec}`, cx, ringY + numFs * 0.36);
      ctx.shadowBlur  = 0;
    }

    // Bobbing plane near top-left origin
    const bob = Math.sin(Date.now() * 0.002) * 3;
    drawPlane(ctx, ox + 24, oy + 18 + bob, Math.PI / 6, compact ? 0.75 : 0.9);
  } else {
    const spin   = Date.now() * 0.0015;
    const planeR = Math.min(w * 0.07, 48);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy - planeR * 0.3, planeR, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,24,56,0.12)";
    ctx.lineWidth   = 1;
    ctx.setLineDash([4, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    const orbitX = cx + Math.cos(spin) * planeR;
    const orbitY = (cy - planeR * 0.3) + Math.sin(spin) * planeR * 0.5;
    ctx.save();
    ctx.translate(orbitX, orbitY);
    ctx.rotate(spin + Math.PI * 0.1);
    ctx.scale(0.85, 0.85);
    ctx.shadowColor = "#ff1838"; ctx.shadowBlur = 14;
    ctx.fillStyle = "#ff1838";
    ctx.beginPath();
    ctx.moveTo(24, 0); ctx.lineTo(-10, -5); ctx.lineTo(-15, 0); ctx.lineTo(-10, 5);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.ellipse(8, -2, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ff4d63";
    ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(-7, -16); ctx.lineTo(-13, -2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-19, -9); ctx.lineTo(-14, 0); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    for (let i = 1; i <= 4; i++) {
      const ta = spin - i * 0.18;
      const tx = cx + Math.cos(ta) * planeR;
      const ty = (cy - planeR * 0.3) + Math.sin(ta) * planeR * 0.5;
      ctx.beginPath();
      ctx.arc(tx, ty, Math.max(1, 3.5 - i * 0.7), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,24,56,${0.5 - i * 0.1})`;
      ctx.fill();
    }

    const textY = cy + planeR * 1.45;
    const fs    = Math.min(w * 0.034, 22);
    ctx.font        = `900 ${fs}px Inter,sans-serif`;
    ctx.textAlign   = "center";
    ctx.fillStyle   = "rgba(255,255,255,0.80)";
    ctx.fillText("STARTING NEXT ROUND", cx, textY);

    const lineW = Math.min(w * 0.22, 180);
    ctx.beginPath();
    ctx.moveTo(cx - lineW / 2, textY + fs * 0.5);
    ctx.lineTo(cx + lineW / 2, textY + fs * 0.5);
    ctx.strokeStyle = "#ff1838";
    ctx.lineWidth   = 2;
    ctx.shadowColor = "#ff1838";
    ctx.shadowBlur  = 6;
    ctx.stroke();
    ctx.shadowBlur  = 0;
  }
}
