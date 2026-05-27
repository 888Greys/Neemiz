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

  const stateRef           = useRef(state);
  const crashPointRef      = useRef(crashPoint);
  const bettingEndsAtRef   = useRef(bettingEndsAt);
  const flyingStartedAtRef = useRef(flyingStartedAt);

  useEffect(() => { stateRef.current           = state;          }, [state]);
  useEffect(() => { crashPointRef.current      = crashPoint;     }, [crashPoint]);
  useEffect(() => { bettingEndsAtRef.current   = bettingEndsAt;  }, [bettingEndsAt]);
  useEffect(() => { flyingStartedAtRef.current = flyingStartedAt; }, [flyingStartedAt]);

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

  // Single permanent RAF loop — empty deps, zero restarts = no shake
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let id: number;

    const loop = () => {
      const currentState = stateRef.current;
      const isFlying     = currentState === "FLYING";
      const isCrashed    = currentState === "CRASHED";

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
  }, []);

  return <canvas ref={canvasRef} className="h-full w-full" style={{ display: "block" }} />;
}

function genStars(w: number, h: number): Star[] {
  return Array.from({ length: 60 }, () => ({
    x: Math.random() * w, y: Math.random() * h,
    r: Math.random() * 1.1 + 0.2,
    alpha: Math.random() * 0.35 + 0.1,
    speed: Math.random() * 0.3 + 0.05,
  }));
}

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

  // Background
  ctx.fillStyle = "#020617";
  ctx.fillRect(0, 0, w, h);

  const bg = ctx.createRadialGradient(w * 0.5, h * 0.35, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.9);
  bg.addColorStop(0, "#111118");
  bg.addColorStop(0.55, "#0a0a0d");
  bg.addColorStop(1, "#020617");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Vignette
  const vig = ctx.createLinearGradient(0, 0, 0, h);
  vig.addColorStop(0, "rgba(0,0,0,0.4)");
  vig.addColorStop(0.35, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  // Grid
  ctx.save();
  ctx.globalAlpha = 0.045;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  const grid = compact ? 40 : 60;
  for (let x = 0; x <= w; x += grid) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y <= h; y += grid) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  ctx.restore();

  // Stars
  stars.forEach((s) => {
    s.alpha += Math.sin(Date.now() * s.speed * 0.001) * 0.005;
    s.alpha  = Math.max(0.06, Math.min(0.6, s.alpha));
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${s.alpha})`;
    ctx.fill();
  });

  // Origin BOTTOM-LEFT → curve rises UP to TOP-RIGHT
  const ORIGIN_X = compact ? 8  : 6;
  const ORIGIN_Y = h - (compact ? 12 : 10);
  const MAX_X    = w - (compact ? 8  : 6);
  const MAX_Y    = compact ? 12 : 10;

  // Guide lines
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth   = 1;
  ctx.beginPath(); ctx.moveTo(ORIGIN_X, 0);      ctx.lineTo(ORIGIN_X, ORIGIN_Y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ORIGIN_X, MAX_Y);  ctx.lineTo(w, MAX_Y);           ctx.stroke();

  // Origin dot
  ctx.beginPath();
  ctx.arc(ORIGIN_X, ORIGIN_Y, 3, 0, Math.PI * 2);
  ctx.fillStyle = "#ff1838";
  ctx.fill();

  if (state === "WAITING" || state === "BETTING") {
    drawIdleState(ctx, w, h, ORIGIN_X, ORIGIN_Y, state, bettingEndsAt);
    return;
  }

  // Curve maths
  const displayMult = isCrashed ? (crashPoint ?? multiplier) : multiplier;
  const curElapsed  = Math.max(0.1, multToElapsed(displayMult));

  // Fixed reference: 15x fills the canvas. Above 15x the canvas scales so
  // the plane stays near the top rather than flying off-screen.
  const refElapsed  = Math.max(multToElapsed(15), curElapsed / 0.88);

  const normX  = (t: number) => ORIGIN_X + (t / refElapsed) * (MAX_X - ORIGIN_X);
  const normYT = (t: number) => {
    const frac = Math.min(t / refElapsed, 1);
    return ORIGIN_Y + frac * frac * (MAX_Y - ORIGIN_Y);
  };

  const STEPS = 80;

  // Fill below curve (wedge between curve and bottom edge)
  ctx.beginPath();
  ctx.moveTo(ORIGIN_X, ORIGIN_Y);
  for (let i = 1; i <= STEPS; i++) {
    const t = (i / STEPS) * curElapsed;
    ctx.lineTo(normX(t), normYT(t));
  }
  ctx.lineTo(normX(curElapsed), ORIGIN_Y);
  ctx.closePath();
  const fill = ctx.createLinearGradient(0, MAX_Y, 0, ORIGIN_Y);
  fill.addColorStop(0,    "rgba(255,24,56,0)");
  fill.addColorStop(0.5,  "rgba(255,24,56,0.12)");
  fill.addColorStop(1,    "rgba(255,24,56,0.45)");
  ctx.fillStyle = fill;
  ctx.fill();

  // Curve line
  ctx.beginPath();
  ctx.moveTo(ORIGIN_X, ORIGIN_Y);
  for (let i = 1; i <= STEPS; i++) {
    const t = (i / STEPS) * curElapsed;
    ctx.lineTo(normX(t), normYT(t));
  }
  ctx.strokeStyle = "#ff1838";
  ctx.lineWidth   = compact ? 2 : 2.5;
  ctx.shadowColor = "#ff1838";
  ctx.shadowBlur  = 16;
  ctx.stroke();
  ctx.shadowBlur  = 0;

  const tipX = normX(curElapsed);
  const tipY = normYT(curElapsed);

  // Plane angle from slope at tip
  const prevT = Math.max(0.01, curElapsed * 0.96);
  const planeAngle = Math.atan2(
    tipY - normYT(prevT),
    tipX - normX(prevT),
  );

  if (isCrashed) {
    if (particles.length === 0) {
      for (let i = 0; i < 50; i++) {
        const a = Math.random() * Math.PI * 2;
        const spd = Math.random() * 5 + 1.5;
        particles.push({ x: tipX, y: tipY, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd, alpha: 1, r: Math.random()*3+1, color: Math.random()>0.5?"#ff4444":"#ffaa00" });
      }
    }
    particles.forEach((p) => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.alpha -= 0.012;
      if (p.alpha <= 0) return;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color; ctx.fill(); ctx.globalAlpha = 1;
    });
    const fs = Math.min(w * (compact ? 0.075 : 0.065), compact ? 30 : 40);
    ctx.font = `900 ${fs}px Inter,sans-serif`; ctx.textAlign = "center";
    ctx.fillStyle = "#ff3030"; ctx.shadowColor = "#ff3030"; ctx.shadowBlur = 22;
    ctx.fillText("FLEW AWAY!", w/2, h*(compact?0.36:0.42)); ctx.shadowBlur = 0;
  } else {
    drawTrail(ctx, tipX, tipY, planeAngle);
    drawPlane(ctx, tipX, tipY, planeAngle, compact ? 0.82 : 1);
  }

  // Multiplier
  const mc = isCrashed ? "#ff4444" : displayMult>=10 ? "#ff2aa8" : displayMult>=5 ? "#8b5cf6" : "#ffffff";
  const fs = Math.min(w*(compact?0.16:0.10), compact?54:64);
  ctx.font = `900 ${fs}px Inter,sans-serif`; ctx.textAlign = "center";
  ctx.shadowColor = mc; ctx.shadowBlur = 28; ctx.fillStyle = mc;
  ctx.fillText(`${displayMult.toFixed(2)}x`, w/2, h*(compact?0.52:0.5)+fs*0.18);
  ctx.shadowBlur = 0;
  ctx.font = `bold ${fs*0.28}px Inter,sans-serif`; ctx.fillStyle = "rgba(255,255,255,0.35)";
  if (isCrashed) ctx.fillText("CRASHED", w/2, h*(compact?0.52:0.5)+fs*0.58);
}

// Plane — y-axis flipped (scale 1,-1) so it appears right-side-up when going down-right
function drawPlane(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);

  ctx.shadowColor = "#ff1838"; ctx.shadowBlur = 20;

  ctx.fillStyle = "#ff1838";
  ctx.beginPath();
  ctx.moveTo(30,0); ctx.lineTo(-12,-7); ctx.lineTo(-18,0); ctx.lineTo(-12,7);
  ctx.closePath(); ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath(); ctx.ellipse(11,-2,4.5,3.2,0,0,Math.PI*2); ctx.fill();

  ctx.fillStyle = "#ff4d63";
  ctx.beginPath(); ctx.moveTo(4,0); ctx.lineTo(-7,-18); ctx.lineTo(-15,-2); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-11,0); ctx.lineTo(-21,-10); ctx.lineTo(-15,0); ctx.closePath(); ctx.fill();

  ctx.shadowColor = "#ff1838"; ctx.shadowBlur = 14;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath(); ctx.ellipse(-15,0,6,3,0,0,Math.PI*2); ctx.fill();

  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawTrail(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number) {
  const len = 30;
  const ex  = x + Math.cos(Math.PI + angle) * len;
  const ey  = y + Math.sin(Math.PI + angle) * len;
  const g   = ctx.createLinearGradient(x, y, ex, ey);
  g.addColorStop(0,   "rgba(255,24,56,0.9)");
  g.addColorStop(0.4, "rgba(255,24,56,0.5)");
  g.addColorStop(1,   "rgba(255,24,56,0)");
  ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(ex,ey);
  ctx.strokeStyle = g; ctx.lineWidth = 5; ctx.lineCap = "round";
  ctx.shadowColor = "#ff1838"; ctx.shadowBlur = 10; ctx.stroke(); ctx.shadowBlur = 0;
}

function drawIdleState(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  ox: number, oy: number,
  state: AviatorRoundState,
  bettingEndsAt?: string | null,
) {
  const cx = w/2, cy = h/2;
  const compact = w < 520;

  if (state === "BETTING") {
    const labelFs = Math.min(w*0.038, 20);
    ctx.font = `700 ${labelFs}px Inter,sans-serif`; ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillText("STARTING IN", cx, cy-(compact?54:62));

    if (bettingEndsAt) {
      const endMs = new Date(bettingEndsAt).getTime();
      const remaining = Math.max(0, endMs - Date.now());
      const progress  = Math.max(0, Math.min(1, remaining / 5000));
      const remSec    = Math.ceil(remaining / 1000);
      const urgent    = remSec <= 2;
      const ringR = Math.min(w*0.14, compact?44:54);
      const ringY = cy-(compact?4:6);
      const ringW = Math.max(4, ringR*0.18);
      const color = urgent ? "#ff1838" : "#ffffff";

      ctx.beginPath(); ctx.arc(cx,ringY,ringR,0,Math.PI*2);
      ctx.strokeStyle = "rgba(255,255,255,0.10)"; ctx.lineWidth = ringW; ctx.stroke();

      if (progress > 0) {
        ctx.beginPath(); ctx.arc(cx,ringY,ringR,-Math.PI/2,-Math.PI/2+Math.PI*2*progress);
        ctx.strokeStyle = color; ctx.lineWidth = ringW; ctx.lineCap = "round";
        ctx.shadowColor = color; ctx.shadowBlur = urgent?20:12; ctx.stroke();
        ctx.shadowBlur = 0; ctx.lineCap = "butt";
      }

      const numFs = Math.min(w*0.13, compact?46:56);
      ctx.font = `900 ${numFs}px Inter,sans-serif`; ctx.textAlign = "center";
      ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = urgent?30:16;
      ctx.fillText(`${remSec}`, cx, ringY+numFs*0.36); ctx.shadowBlur = 0;
    }

    // Bobbing plane near origin (bottom-left), faces upper-right to match flight direction
    const bob = Math.sin(Date.now() * 0.002) * 3;
    drawPlane(ctx, ox+24, oy-20+bob, -Math.PI/6, compact?0.75:0.9);
  } else {
    // WAITING: orbiting plane
    const spin = Date.now() * 0.0015;
    const planeR = Math.min(w*0.07, 48);

    ctx.save();
    ctx.beginPath(); ctx.arc(cx,cy-planeR*0.3,planeR,0,Math.PI*2);
    ctx.strokeStyle = "rgba(255,24,56,0.12)"; ctx.lineWidth=1; ctx.setLineDash([4,6]); ctx.stroke(); ctx.setLineDash([]); ctx.restore();

    const orbitX = cx + Math.cos(spin)*planeR;
    const orbitY = cy - planeR*0.3 + Math.sin(spin)*planeR*0.5;
    ctx.save();
    ctx.translate(orbitX, orbitY); ctx.rotate(spin+Math.PI*0.1); ctx.scale(0.85,0.85);
    ctx.shadowColor="#ff1838"; ctx.shadowBlur=14;
    ctx.fillStyle="#ff1838"; ctx.beginPath(); ctx.moveTo(24,0); ctx.lineTo(-10,-5); ctx.lineTo(-15,0); ctx.lineTo(-10,5); ctx.closePath(); ctx.fill();
    ctx.fillStyle="#ffffff"; ctx.beginPath(); ctx.ellipse(8,-2,4,3,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#ff4d63"; ctx.beginPath(); ctx.moveTo(2,0); ctx.lineTo(-7,-16); ctx.lineTo(-13,-2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-10,0); ctx.lineTo(-19,-9); ctx.lineTo(-14,0); ctx.closePath(); ctx.fill();
    ctx.shadowBlur=0; ctx.restore();

    for (let i=1;i<=4;i++) {
      const ta=spin-i*0.18, tx=cx+Math.cos(ta)*planeR, ty=cy-planeR*0.3+Math.sin(ta)*planeR*0.5;
      ctx.beginPath(); ctx.arc(tx,ty,Math.max(1,3.5-i*0.7),0,Math.PI*2);
      ctx.fillStyle=`rgba(255,24,56,${0.5-i*0.1})`; ctx.fill();
    }

    const textY = cy+planeR*1.45;
    const fs    = Math.min(w*0.034, 22);
    ctx.font=`900 ${fs}px Inter,sans-serif`; ctx.textAlign="center";
    ctx.fillStyle="rgba(255,255,255,0.80)"; ctx.fillText("STARTING NEXT ROUND",cx,textY);
    const lineW=Math.min(w*0.22,180);
    ctx.beginPath(); ctx.moveTo(cx-lineW/2,textY+fs*0.5); ctx.lineTo(cx+lineW/2,textY+fs*0.5);
    ctx.strokeStyle="#ff1838"; ctx.lineWidth=2; ctx.shadowColor="#ff1838"; ctx.shadowBlur=6; ctx.stroke(); ctx.shadowBlur=0;
  }
}
