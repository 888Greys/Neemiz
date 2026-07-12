"use client";

/**
 * Game feel: haptics + synthesized sound for a tactile, "instant" gaming UX.
 *
 * Everything here is mobile-first and zero-dependency:
 *  • Sounds are SYNTHESIZED with the Web Audio API (oscillators + gain
 *    envelopes) — no audio files to ship, no CSP/asset headaches, and they
 *    fire with zero network latency so feedback feels instant on a tap.
 *  • Haptics use navigator.vibrate (Android/Chrome). iOS Safari ignores it, so
 *    we always pair a vibration with a visual/audio cue that works everywhere.
 *
 * Usage:
 *   import { haptic, playSound, tap } from "@/lib/game-feel";
 *   tap();                 // button press: light buzz + soft click
 *   playSound("win");      // on a win
 *   playSound("lose");     // on a loss
 *   haptic("success");     // vibration only
 *
 * Respect the user: sound is muted by default until they opt in (a gambling
 * app blaring audio unprompted is hostile), but haptics are on by default.
 */

const SOUND_KEY = "nz.sound.enabled";
const HAPTIC_KEY = "nz.haptic.enabled";

function readFlag(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const v = window.localStorage.getItem(key);
    return v == null ? fallback : v === "1";
  } catch {
    return fallback;
  }
}

function writeFlag(key: string, value: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value ? "1" : "0");
  } catch {
    /* private mode / storage disabled — ignore */
  }
}

/* ── Preferences (sound off by default, haptics on) ── */

// Sound on by default — this is a game. It stays silent until the first user
// gesture unlocks the audio context (browser autoplay policy), which always
// happens in normal play, so nothing ever blares unprompted on load.
let soundEnabled = readFlag(SOUND_KEY, true);
let hapticEnabled = readFlag(HAPTIC_KEY, true);

type PrefListener = () => void;
const prefListeners = new Set<PrefListener>();
function notifyPrefs() {
  prefListeners.forEach((fn) => fn());
}

export function onGameFeelChange(fn: PrefListener): () => void {
  prefListeners.add(fn);
  return () => prefListeners.delete(fn);
}

export function isSoundEnabled() {
  return soundEnabled;
}
export function isHapticEnabled() {
  return hapticEnabled;
}

export function setSoundEnabled(on: boolean) {
  soundEnabled = on;
  writeFlag(SOUND_KEY, on);
  // Turning sound on counts as a user gesture — unlock the audio context now
  // and give an audible confirmation so they know it worked.
  if (on) {
    unlockAudio();
    playSound("tap");
  }
  notifyPrefs();
}

export function setHapticEnabled(on: boolean) {
  hapticEnabled = on;
  writeFlag(HAPTIC_KEY, on);
  if (on) haptic("light");
  notifyPrefs();
}

/* ── Haptics ── */

export type HapticKind = "light" | "medium" | "heavy" | "success" | "warning" | "error";

// Patterns in milliseconds. Single number = one buzz; array = buzz/pause/buzz…
const HAPTIC_PATTERNS: Record<HapticKind, number | number[]> = {
  light: 8,
  medium: 18,
  heavy: 32,
  success: [14, 40, 26],
  warning: [24, 50, 24],
  error: [40, 60, 40],
};

export function haptic(kind: HapticKind = "light") {
  if (!hapticEnabled) return;
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(HAPTIC_PATTERNS[kind]);
  } catch {
    /* some browsers throw if called without a user gesture — ignore */
  }
}

/* ── Sound (synthesized) ── */

type Ctx = AudioContext & { _master?: GainNode };
let audioCtx: Ctx | null = null;

function getCtx(): Ctx | null {
  if (typeof window === "undefined") return null;
  if (audioCtx) return audioCtx;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    const ctx = new AC() as Ctx;
    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    ctx._master = master;
    audioCtx = ctx;
    return ctx;
  } catch {
    return null;
  }
}

/**
 * Call from a user gesture (first tap, or the sound toggle) to unlock audio on
 * mobile — browsers start the context "suspended" until a gesture resumes it.
 */
export function unlockAudio() {
  const ctx = getCtx();
  if (ctx && ctx.state === "suspended") void ctx.resume();
}

/** One shaped oscillator note with an ADSR-ish gain envelope. */
function note(
  ctx: Ctx,
  opts: {
    type: OscillatorType;
    freq: number;
    freqTo?: number;
    start: number;
    dur: number;
    gain: number;
    attack?: number;
  },
) {
  const { type, freq, freqTo, start, dur, gain, attack = 0.006 } = opts;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (freqTo != null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqTo), start + dur);

  // Envelope: quick attack, exponential decay to near-silence (no clicks).
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);

  osc.connect(g);
  g.connect(ctx._master ?? ctx.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

export type SoundKind =
  | "tap"      // button press — soft click
  | "bet"      // trade placed — short confident blip
  | "win"      // profit — bright ascending arpeggio
  | "lose"     // loss — soft descending tone (never harsh)
  | "cashout"  // secured winnings — celebratory coin sparkle
  | "tick";    // countdown / spin tick

export function playSound(kind: SoundKind) {
  if (!soundEnabled) return;
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  const t = ctx.currentTime;

  switch (kind) {
    case "tap":
      note(ctx, { type: "triangle", freq: 520, freqTo: 380, start: t, dur: 0.05, gain: 0.14 });
      break;

    case "bet":
      note(ctx, { type: "triangle", freq: 440, start: t, dur: 0.07, gain: 0.16 });
      note(ctx, { type: "triangle", freq: 660, start: t + 0.05, dur: 0.09, gain: 0.16 });
      break;

    case "win": {
      // Major arpeggio C5–E5–G5–C6, bright triangle with a sine sparkle on top.
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, i) => {
        note(ctx, { type: "triangle", freq: f, start: t + i * 0.075, dur: 0.28, gain: 0.17 });
      });
      note(ctx, { type: "sine", freq: 1568, start: t + 0.24, dur: 0.4, gain: 0.09 });
      break;
    }

    case "cashout": {
      // Coin-like: two quick bright blips then a shimmer up.
      note(ctx, { type: "square", freq: 988, start: t, dur: 0.08, gain: 0.12 });
      note(ctx, { type: "square", freq: 1319, start: t + 0.07, dur: 0.1, gain: 0.12 });
      note(ctx, { type: "sine", freq: 1760, freqTo: 2637, start: t + 0.16, dur: 0.28, gain: 0.08 });
      break;
    }

    case "lose": {
      // Gentle downward two-tone — acknowledges the loss without punishing.
      note(ctx, { type: "sine", freq: 392, freqTo: 293.66, start: t, dur: 0.22, gain: 0.15 });
      note(ctx, { type: "sine", freq: 261.63, freqTo: 196, start: t + 0.16, dur: 0.34, gain: 0.13 });
      break;
    }

    case "tick":
      note(ctx, { type: "square", freq: 880, start: t, dur: 0.03, gain: 0.08 });
      break;
  }
}

/* ── Convenience: the common "button press" combo ── */

export function tap(kind: HapticKind = "light") {
  haptic(kind);
  playSound("tap");
}

/** A trade/bet was placed: firmer haptic + confident blip. */
export function placed() {
  haptic("medium");
  playSound("bet");
}

/** Outcome helpers that pair sound + haptic in one call. */
export function outcomeWin() {
  haptic("success");
  playSound("win");
}
export function outcomeLose() {
  haptic("warning");
  playSound("lose");
}
export function outcomeCashout() {
  haptic("success");
  playSound("cashout");
}
