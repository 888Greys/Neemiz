"use client";

import { useEffect, useRef } from "react";
import type { AviatorRoundState } from "@/lib/aviator/types";

interface Props {
  state:           AviatorRoundState;
  multiplier:      number;
  crashPoint?:     number;
  bettingEndsAt?:  string | null;
  flyingStartedAt?:string | null;
}

// Stars generated once per canvas mount
interface Star { x: number; y: number; r: number; alpha: number; speed: number }

// Explosion particle
interface Particle { x: number; y: number; vx: number; vy: number; alpha: number; r: number; color: string }

const GROWTH_RATE = 0.00006;

function multToElapsed(mult: number): number {
  return Math.log(Math.max(mult, 1.001)) / GROWTH_RATE;
}

export function AviatorCanvas({ state, multiplier, crashPoint, bettingEndsAt }: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const starsRef    = useRef<Star[]>([]);
  const particlesRef= useRef<Particle[]>([]);
  const crashedRef  = useRef(false);
  const frameRef    = useRef<number>(0);

  // Resize canvas to parent
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const obs = new ResizeObserver(() => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      // Regenerate stars on resize
      starsRef.current = generateStars(canvas.width, canvas.height);
    });
    obs.observe(canvas);
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    starsRef.current = generateStars(canvas.width, canvas.height);
    return () => obs.disconnect();
  }, []);

  // Reset crash particles when new round starts
  useEffect(() => {
    if (state === "WAITING" || state === "BETTING") {
      crashedRef.current  = false;
      particlesRef.current = [];
    }
    if (state === "CRASHED" && !crashedRef.current) {
      crashedRef.current = true;
    }
  }, [state]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    let animId: number;
    const loop = () => {
      draw(ctx, canvas.width, canvas.height, {
        state,
        multiplier,
        crashPoint,
        bettingEndsAt,
        stars:      starsRef.current,
        particles:  particlesRef.current,
        crashed:    crashedRef.current,
      });
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    frameRef.current = animId;
    return () => cancelAnimationFrame(animId);
  }, [state, multiplier, crashPoint, bettingEndsAt]);

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full"
      style={{ display: "block" }}
    />
  );
}

// ─── Drawing ──────────────────────────────────────────────────────────────────

function generateStars(w: number, h: number): Star[] {
  return Array.from({ length: 80 }, () => ({
    x:     Math.random() * w,
    y:     Math.random() * h,
    r:     Math.random() * 1.2 + 0.3,
    alpha: Math.random() * 0.5 + 0.2,
    speed: Math.random() * 0.3 + 0.05,
  }));
}

function draw(
  ctx:  CanvasRenderingContext2D,
  w:    number,
  h:    number,
  opts: {
    state:        AviatorRoundState;
    multiplier:   number;
    crashPoint?:  number;
    bettingEndsAt?: string | null;
    stars:        Star[];
    particles:    Particle[];
    crashed:      boolean;
  },
) {
  const { state, multiplier, crashPoint, bettingEndsAt, stars, particles } = opts;

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#0a0c14");
  bg.addColorStop(1, "#060810");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Twinkle stars
  stars.forEach((s) => {
    s.alpha += Math.sin(Date.now() * s.speed * 0.001) * 0.008;
    s.alpha  = Math.max(0.1, Math.min(0.8, s.alpha));
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${s.alpha})`;
    ctx.fill();
  });

  // Ground line
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(0, h - 30);
  ctx.lineTo(w, h - 30);
  ctx.stroke();

  if (state === "WAITING" || state === "BETTING") {
    drawBettingState(ctx, w, h, state, bettingEndsAt);
    return;
  }

  // Flying or crashed
  const displayMult  = state === "CRASHED" ? (crashPoint ?? multiplier) : multiplier;
  const totalElapsed = multToElapsed(displayMult);

  // Build curve path
  const ORIGIN_X  = w * 0.08;
  const ORIGIN_Y  = h - 30;
  const MAX_X     = w * 0.92;
  const MAX_Y     = 30;

  // Map elapsed → x (linear), multiplier → y (logarithmic → linear in screen space)
  const normX = (elapsedMs: number) => ORIGIN_X + ((elapsedMs / totalElapsed) * (MAX_X - ORIGIN_X));
  const normY = (mult: number) => ORIGIN_Y - ((Math.log(mult) / Math.log(displayMult)) * (ORIGIN_Y - MAX_Y));

  // Draw glow under curve
  const steps = 80;
  ctx.beginPath();
  ctx.moveTo(ORIGIN_X, ORIGIN_Y);
  for (let i = 1; i <= steps; i++) {
    const t    = i / steps;
    const elMs = t * totalElapsed;
    const m    = Math.exp(GROWTH_RATE * elMs);
    ctx.lineTo(normX(elMs), normY(m));
  }
  ctx.lineTo(normX(totalElapsed), ORIGIN_Y);
  ctx.closePath();

  const isCrashed = state === "CRASHED";
  const fillGrad  = ctx.createLinearGradient(ORIGIN_X, ORIGIN_Y, ORIGIN_X, MAX_Y);
  fillGrad.addColorStop(0, isCrashed ? "rgba(255,40,40,0.18)" : "rgba(0,255,136,0.18)");
  fillGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = fillGrad;
  ctx.fill();

  // Draw curve line
  ctx.beginPath();
  ctx.moveTo(ORIGIN_X, ORIGIN_Y);
  for (let i = 1; i <= steps; i++) {
    const t    = i / steps;
    const elMs = t * totalElapsed;
    const m    = Math.exp(GROWTH_RATE * elMs);
    ctx.lineTo(normX(elMs), normY(m));
  }
  ctx.strokeStyle = isCrashed ? "#ff3030" : "#00ff88";
  ctx.lineWidth   = 2.5;
  ctx.shadowColor = isCrashed ? "#ff3030" : "#00ff88";
  ctx.shadowBlur  = 10;
  ctx.stroke();
  ctx.shadowBlur  = 0;

  // Plane / explosion at tip
  const tipX = normX(totalElapsed);
  const tipY = normY(displayMult);

  if (isCrashed) {
    // Spawn particles once
    if (particles.length === 0) {
      for (let i = 0; i < 40; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 4 + 1;
        particles.push({
          x: tipX, y: tipY,
          vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          alpha: 1, r: Math.random() * 3 + 1,
          color: Math.random() > 0.5 ? "#ff4444" : "#ffaa00",
        });
      }
    }
    // Draw + update particles
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12; // gravity
      p.alpha -= 0.015;
      if (p.alpha <= 0) return;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color.replace(")", `,${p.alpha})`).replace("rgb", "rgba").replace("##", "#");
      ctx.globalAlpha = p.alpha;
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    // "FLEW AWAY!" text
    ctx.font         = `bold ${Math.min(w * 0.07, 42)}px Inter, sans-serif`;
    ctx.textAlign    = "center";
    ctx.fillStyle    = "#ff3030";
    ctx.shadowColor  = "#ff3030";
    ctx.shadowBlur   = 20;
    ctx.fillText("FLEW AWAY!", w / 2, h / 2 - 10);
    ctx.shadowBlur   = 0;
  } else {
    drawPlane(ctx, tipX, tipY, displayMult);
  }

  // Multiplier display
  const multColor = isCrashed ? "#ff4444"
    : displayMult >= 10 ? "#c084fc"
    : displayMult >= 5  ? "#fb923c"
    : displayMult >= 2  ? "#facc15"
    : "#ffffff";

  const fontSize = Math.min(w * 0.11, 68);
  ctx.font        = `900 ${fontSize}px Inter, sans-serif`;
  ctx.textAlign   = "center";
  ctx.shadowColor = multColor;
  ctx.shadowBlur  = 30;
  ctx.fillStyle   = multColor;
  ctx.fillText(`${displayMult.toFixed(2)}x`, w / 2, h / 2 + fontSize * 0.35);
  ctx.shadowBlur  = 0;

  // Sub-label
  ctx.font      = `bold ${fontSize * 0.3}px Inter, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.fillText(isCrashed ? "CRASHED" : "Current Multiplier", w / 2, h / 2 + fontSize * 0.8);
}

function drawPlane(ctx: CanvasRenderingContext2D, x: number, y: number, mult: number) {
  // Simple plane using canvas paths, tilted upward
  const angle = -Math.PI / 5; // tilt
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Glow
  ctx.shadowColor = "#00ff88";
  ctx.shadowBlur  = 20;

  // Body
  ctx.fillStyle   = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(22, 0);
  ctx.lineTo(-10, -5);
  ctx.lineTo(-14, 0);
  ctx.lineTo(-10, 5);
  ctx.closePath();
  ctx.fill();

  // Wing
  ctx.fillStyle = mult >= 3 ? "#facc15" : "#a0d8ef";
  ctx.beginPath();
  ctx.moveTo(2, 0);
  ctx.lineTo(-8, -14);
  ctx.lineTo(-12, -2);
  ctx.closePath();
  ctx.fill();

  // Tail
  ctx.fillStyle = mult >= 3 ? "#facc15" : "#a0d8ef";
  ctx.beginPath();
  ctx.moveTo(-10, 0);
  ctx.lineTo(-18, -8);
  ctx.lineTo(-14, 0);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawBettingState(
  ctx:          CanvasRenderingContext2D,
  w:            number,
  h:            number,
  state:        AviatorRoundState,
  bettingEndsAt?: string | null,
) {
  // Idle plane at bottom-left
  drawPlane(ctx, w * 0.1, h - 55, 1);

  // Countdown
  const isBetting = state === "BETTING";
  const label     = isBetting ? "Place your bets" : "Waiting for next round";

  ctx.font      = `900 ${Math.min(w * 0.055, 36)}px Inter, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(label, w / 2, h / 2 - 20);

  if (isBetting && bettingEndsAt) {
    const remaining = Math.max(0, Math.ceil((new Date(bettingEndsAt).getTime() - Date.now()) / 1000));
    ctx.font      = `900 ${Math.min(w * 0.12, 72)}px Inter, sans-serif`;
    ctx.fillStyle = remaining <= 3 ? "#ff4444" : "#00ff88";
    ctx.shadowColor= remaining <= 3 ? "#ff4444" : "#00ff88";
    ctx.shadowBlur = 25;
    ctx.fillText(`${remaining}`, w / 2, h / 2 + 45);
    ctx.shadowBlur = 0;
  } else {
    // Pulsing dots
    const dots = Math.floor(Date.now() / 500) % 4;
    ctx.font      = `bold ${Math.min(w * 0.06, 32)}px Inter, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillText(".".repeat(dots), w / 2, h / 2 + 30);
  }
}
