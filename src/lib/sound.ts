// Tiny synthesized sound effects (no audio files to download).
// The AudioContext is only created after the visitor's first interaction,
// which is what browsers require anyway.

let ac: AudioContext | null = null;
let armed = false;
let muted = false;

if (typeof window !== 'undefined') {
  const arm = () => {
    armed = true;
  };
  addEventListener('pointerdown', arm, { capture: true, once: true });
  addEventListener('keydown', arm, { capture: true, once: true });
}

function ctx(): AudioContext | null {
  if (!armed || muted) return null;
  if (!ac) {
    try {
      ac = new AudioContext();
    } catch {
      return null;
    }
  }
  if (ac.state === 'suspended') void ac.resume();
  return ac;
}

export function setMuted(m: boolean) {
  muted = m;
}
export const isMuted = () => muted;

/** Filtered noise burst, optionally with a low "thud" sine sweep under it. */
export function click(freq = 2400, dur = 0.025, gain = 0.3, thud = 0, q = 1.4) {
  const a = ctx();
  if (!a) return;
  const n = Math.max(1, Math.floor(a.sampleRate * dur));
  const buf = a.createBuffer(1, n, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 3;
  const src = a.createBufferSource();
  src.buffer = buf;
  const bp = a.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = q;
  const g = a.createGain();
  g.gain.value = gain;
  src.connect(bp).connect(g).connect(a.destination);
  src.start();
  if (thud) {
    const o = a.createOscillator();
    const og = a.createGain();
    const t = a.currentTime;
    o.frequency.setValueAtTime(thud, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.08);
    og.gain.setValueAtTime(0.3, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(og).connect(a.destination);
    o.start();
    o.stop(t + 0.12);
  }
}

/** Soft swish: for paper sliding, cloth tearing etc. */
export function swish(dur = 0.18, freq = 3200, gain = 0.12) {
  click(freq, dur, gain, 0, 0.6);
}

/** Shared AudioContext for designs that build their own ambience (null until the visitor interacts). */
export function audioCtx() {
  return ctx();
}
