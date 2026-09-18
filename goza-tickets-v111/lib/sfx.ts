'use client';

/* Retro chiptune SFX, generated live with WebAudio — no audio files to load,
   nothing to host, works offline. Square waves for the classic 8-bit blip.
   Browsers block audio until the user interacts, so every call is wrapped:
   if the context isn't allowed yet, it fails silently instead of throwing. */

let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch { return null; }
}

type Note = { f: number; t: number; d: number; type?: OscillatorType; vol?: number };

function play(notes: Note[]) {
  const a = audio();
  if (!a) return;
  const now = a.currentTime;
  for (const n of notes) {
    try {
      const osc = a.createOscillator();
      const gain = a.createGain();
      osc.type = n.type || 'square';
      osc.frequency.setValueAtTime(n.f, now + n.t);
      const vol = n.vol ?? 0.06;              // quiet by default; this is UI, not a game
      gain.gain.setValueAtTime(0, now + n.t);
      gain.gain.linearRampToValueAtTime(vol, now + n.t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.t + n.d);
      osc.connect(gain); gain.connect(a.destination);
      osc.start(now + n.t);
      osc.stop(now + n.t + n.d + 0.02);
    } catch { /* ignore */ }
  }
}

/** short tick — hovering or focusing something */
export function sfxTick() {
  play([{ f: 880, t: 0, d: 0.05, vol: 0.03 }]);
}

/** standard button press */
export function sfxClick() {
  play([
    { f: 660, t: 0, d: 0.06 },
    { f: 990, t: 0.05, d: 0.07 },
  ]);
}

/** the good one — credit accepted, money landing, power-up arpeggio */
export function sfxCoin() {
  play([
    { f: 784, t: 0, d: 0.09 },      // G5
    { f: 1047, t: 0.07, d: 0.10 },  // C6
    { f: 1319, t: 0.15, d: 0.12 },  // E6
    { f: 1568, t: 0.24, d: 0.28, vol: 0.07 }, // G6, held
  ]);
}

/** counting up — call repeatedly while a number climbs */
export function sfxTally(step: number) {
  const base = 520 + (step % 6) * 60;
  play([{ f: base, t: 0, d: 0.035, vol: 0.022 }]);
}

/** the quieter, plainer choice (refund) — no reward sound, just an acknowledgement */
export function sfxConfirm() {
  play([
    { f: 520, t: 0, d: 0.08, type: 'triangle', vol: 0.05 },
    { f: 392, t: 0.08, d: 0.14, type: 'triangle', vol: 0.05 },
  ]);
}

/** something went wrong */
export function sfxError() {
  play([
    { f: 300, t: 0, d: 0.10, vol: 0.05 },
    { f: 200, t: 0.09, d: 0.16, vol: 0.05 },
  ]);
}
