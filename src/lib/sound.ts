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

/* ---------- recorded samples (Kenney "Interface Sounds", CC0) ---------- */
// Files live in /public/sounds. Each one is fetched + decoded once, on first use.
const buffers = new Map<string, AudioBuffer | Promise<AudioBuffer | null> | null>();

function load(name: string) {
  const a = ctx();
  if (!a) return null;
  let b = buffers.get(name);
  if (b === undefined) {
    const p = fetch(`/sounds/${name}.mp3`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
      .then((ab) => a.decodeAudioData(ab))
      .then((buf) => (buffers.set(name, buf), buf))
      .catch(() => (buffers.set(name, null), null));
    buffers.set(name, p);
    b = p;
  }
  return b instanceof AudioBuffer ? b : null;
}

/** Warm the cache so the first real interaction plays instantly. */
export function preload(names: string[]) {
  const go = () => names.forEach(load);
  if (armed) go();
  else addEventListener('pointerdown', go, { capture: true, once: true });
}

/**
 * Play a recorded sample (a random pick if given several), with a little pitch
 * variation so repeats don't sound mechanical. Falls back to `fallback` while the
 * sample is still loading or if it failed.
 */
export function sample(names: string | string[], opts: { gain?: number; rate?: number; jitter?: number; pan?: number } = {}, fallback?: () => void) {
  const a = ctx();
  if (!a) return;
  const list = Array.isArray(names) ? names : [names];
  const name = list[(Math.random() * list.length) | 0];
  const buf = load(name);
  if (!buf) { fallback?.(); return; }
  const src = a.createBufferSource();
  src.buffer = buf;
  const j = opts.jitter ?? 0.06;
  src.playbackRate.value = (opts.rate ?? 1) * (1 + (Math.random() * 2 - 1) * j);
  const g = a.createGain();
  g.gain.value = opts.gain ?? 0.6;
  let node: AudioNode = src.connect(g);
  if (opts.pan) { const p = a.createStereoPanner(); p.pan.value = opts.pan; node = node.connect(p); }
  node.connect(a.destination);
  src.start();
}
