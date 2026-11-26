/**
 * Use your hand: the webcam finds your hand (MediaPipe Hand Landmarker, running
 * entirely on this device; no video leaves the browser) and turns it into a
 * pointer that every design already understands.
 *
 *   move your hand        → the cursor moves (hover works)
 *   pinch thumb + index   → press (grab the cloth, a gummy, the globe, a card…)
 *   move while pinched    → drag; let go to throw
 *   quick pinch           → click (buttons, links, hotspots)
 *   shake your open hand  → a "hand:shake" event (the snow globe listens)
 *
 * It works by dispatching ordinary PointerEvents, so no design needed special
 * code for it, and the camera, model and loop only exist while it's switched on.
 */

const VERSION = '1.2.3'; // keep in step with @mediapipe/tasks-vision in package.json
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;
const MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

type Pt = { x: number; y: number; z?: number };
type Status = 'off' | 'loading' | 'on' | 'error';
// hand skeleton, for the little preview
const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]];

let status: Status = 'off';
let listeners: ((s: Status, msg?: string) => void)[] = [];
let stopFn: (() => void) | null = null;

export const handStatus = () => status;
export function onHandStatus(fn: (s: Status, msg?: string) => void) { listeners.push(fn); return () => (listeners = listeners.filter((f) => f !== fn)); }
const setStatus = (s: Status, msg?: string) => { status = s; listeners.forEach((f) => f(s, msg)); };

export async function toggleHands() {
  if (status === 'on' || status === 'loading') { stopFn?.(); stopFn = null; setStatus('off'); return; }
  setStatus('loading');
  try { stopFn = await start(); setStatus('on'); }
  catch (e) {
    stopFn?.(); stopFn = null;
    const name = (e as { name?: string })?.name;
    setStatus('error', name === 'NotAllowedError' ? 'Camera access was blocked. Allow the camera for this site and try again.' : name === 'NotFoundError' ? 'No camera found on this device.' : 'Hand tracking could not start on this browser.');
  }
}

async function start(): Promise<() => void> {
  // camera first, so the permission prompt appears straight away
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
  let stopped = false;
  const stopStream = () => stream.getTracks().forEach((t) => t.stop());
  try {
    const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
    const files = await FilesetResolver.forVisionTasks(WASM);
    const make = (delegate: 'GPU' | 'CPU') => HandLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: 'VIDEO', numHands: 1,
      minHandDetectionConfidence: 0.6, minHandPresenceConfidence: 0.6, minTrackingConfidence: 0.5,
    });
    const landmarker = await make('GPU').catch(() => make('CPU'));
    if (stopped) { landmarker.close(); stopStream(); return () => {}; }
    return run(stream, (video, t) => landmarker.detectForVideo(video, t).landmarks[0] ?? null, () => { landmarker.close(); stopStream(); });
  } catch (e) { stopStream(); stopped = true; throw e; }
}

/** test hook: drive the pointer layer with synthetic landmarks (no camera) */
export function _driveForTest(): { feed: (lm: Pt[] | null) => void; stop: () => void } {
  let next: Pt[] | null = null;
  const stop = run(null, () => next, () => {});
  setStatus('on');
  return { feed: (lm) => (next = lm), stop: () => { stop(); setStatus('off'); } };
}

function run(stream: MediaStream | null, detect: (v: HTMLVideoElement, t: number) => Pt[] | null, cleanup: () => void) {
  // ---------- UI: preview + cursor ----------
  const ui = document.createElement('div');
  ui.className = 'hands';
  ui.innerHTML = `
    <div class="hands-prev"><video playsinline muted></video><canvas></canvas><span>Pinch to grab · shake to shake</span></div>
    <div class="hands-cur"><i></i></div>`;
  document.body.append(ui);
  const video = ui.querySelector('video')!, prev = ui.querySelector<HTMLCanvasElement>('.hands-prev canvas')!, pg = prev.getContext('2d')!;
  const cur = ui.querySelector<HTMLDivElement>('.hands-cur')!;
  if (stream) { video.srcObject = stream; void video.play(); } else ui.querySelector('.hands-prev')!.remove();
  prev.width = 160; prev.height = 120;

  // pointer capture would throw for our synthetic pointer: swallow it while we're on
  const origCap = Element.prototype.setPointerCapture, origRel = Element.prototype.releasePointerCapture;
  Element.prototype.setPointerCapture = function (id: number) { try { origCap.call(this, id); } catch { /* synthetic */ } };
  Element.prototype.releasePointerCapture = function (id: number) { try { origRel.call(this, id); } catch { /* synthetic */ } };

  // ---------- pointer synthesis ----------
  let x = innerWidth / 2, y = innerHeight / 2, sx = x, sy = y, seen = false;
  let pinched = false, downTarget: Element | null = null, downAt = 0, downX = 0, downY = 0, moved = 0, lostFor = 0;
  const hist: { x: number; y: number; t: number }[] = [];
  let lastShake = 0;
  const fire = (type: string, target: Element | null, extra: PointerEventInit = {}) => {
    if (!target) return;
    const init: PointerEventInit = { bubbles: true, cancelable: true, composed: true, clientX: sx, clientY: sy, screenX: sx, screenY: sy, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: pinched ? 1 : 0, view: window, ...extra };
    target.dispatchEvent(type.startsWith('pointer') ? new PointerEvent(type, init) : new MouseEvent(type, init));
  };
  const under = () => { const el = document.elementFromPoint(sx, sy); return el && !ui.contains(el) ? el : null; };
  let hoverEl: Element | null = null;

  function press() {
    pinched = true; downTarget = under(); downAt = performance.now(); downX = sx; downY = sy; moved = 0;
    fire('pointerdown', downTarget); fire('mousedown', downTarget);
    cur.classList.add('down');
  }
  function release(cancel = false) {
    const t = downTarget; pinched = false;
    fire(cancel ? 'pointercancel' : 'pointerup', t, { buttons: 0 }); fire('mouseup', t, { buttons: 0 });
    // a short, still pinch is a click on whatever is under the finger
    if (!cancel && moved < 18 && performance.now() - downAt < 600) { const el = under(); if (el && (el === t || t?.contains(el) || el.contains(t!))) { fire('click', el, { buttons: 0 }); (el as HTMLElement).focus?.({ preventScroll: true }); } }
    downTarget = null; cur.classList.remove('down');
  }

  const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
  let raf = 0, lastVideoTime = -1, last = performance.now();
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    let lm: Pt[] | null = null, fresh = false;
    if (!stream) { lm = detect(video, now); fresh = true; }
    else if (video.readyState >= 2 && video.currentTime !== lastVideoTime) { lastVideoTime = video.currentTime; lm = detect(video, now); fresh = true; }
    if (!fresh) { smoothStep(dt); return; }

    if (!lm) {
      // hand left the frame: drop anything held after a moment
      lostFor += dt;
      if (lostFor > 0.25) { if (pinched) release(true); cur.classList.add('lost'); seen = false; }
      drawPreview(null); smoothStep(dt); return;
    }
    lostFor = 0; cur.classList.remove('lost');
    // pointer = between thumb and index tips; mirrored, with a margin so the screen edges are easy to reach
    const th = lm[4], ix = lm[8];
    const px = 1 - (th.x + ix.x) / 2, py = (th.y + ix.y) / 2;
    const m = 0.14;
    x = Math.min(1, Math.max(0, (px - m) / (1 - 2 * m))) * innerWidth;
    y = Math.min(1, Math.max(0, (py - m) / (1 - 2 * m))) * innerHeight;
    if (!seen) { sx = x; sy = y; seen = true; }
    // pinch with hysteresis, relative to hand size so distance from the camera doesn't matter
    const size = dist(lm[0], lm[9]) || 0.1;
    const ratio = dist(th, ix) / size;
    if (!pinched && ratio < 0.32) press();
    else if (pinched && ratio > 0.5) release();
    // open-hand shake: fast back-and-forth while not pinched
    const t = now / 1000;
    const lastH = hist[hist.length - 1];
    if (!lastH || Math.abs(lastH.x - lm[9].x) + Math.abs(lastH.y - lm[9].y) > 0.004) hist.push({ x: lm[9].x, y: lm[9].y, t });
    while (hist.length && t - hist[0].t > 0.7) hist.shift();
    if (!pinched && hist.length > 4 && now - lastShake > 900) {
      // count direction reversals of meaningful sideways (or up-down) moves
      let flips = 0, travel = 0, dirX = 0, dirY = 0;
      for (let i = 1; i < hist.length; i++) {
        const dx = hist[i].x - hist[i - 1].x, dy = hist[i].y - hist[i - 1].y;
        travel += Math.hypot(dx, dy);
        if (Math.abs(dx) > 0.015) { const d = Math.sign(dx); if (dirX && d !== dirX) flips++; dirX = d; }
        if (Math.abs(dy) > 0.015) { const d = Math.sign(dy); if (dirY && d !== dirY) flips++; dirY = d; }
      }
      if (flips >= 3 && travel > 0.35) { lastShake = now; hist.length = 0; dispatchEvent(new CustomEvent('hand:shake', { detail: { power: Math.min(1.5, travel) } })); cur.classList.add('shook'); setTimeout(() => cur.classList.remove('shook'), 300); }
    }
    drawPreview(lm);
    smoothStep(dt);
  };

  function smoothStep(dt: number) {
    // follow the hand: snappy when moving fast, steady when nearly still (cuts jitter)
    const d = Math.hypot(x - sx, y - sy);
    const k = 1 - Math.pow(d > 40 ? 0.0005 : d > 8 ? 0.004 : 0.03, dt);
    const nx = sx + (x - sx) * k, ny = sy + (y - sy) * k;
    const mv = Math.hypot(nx - sx, ny - sy);
    sx = nx; sy = ny;
    cur.style.transform = `translate(${sx}px, ${sy}px)`;
    if (!seen || mv < 0.2) return;
    if (pinched) { moved += Math.hypot(sx - downX, sy - downY) > 18 ? mv : 0; fire('pointermove', downTarget); fire('mousemove', downTarget); }
    else {
      const el = under();
      if (el !== hoverEl) { fire('pointerout', hoverEl); fire('mouseout', hoverEl); fire('pointerover', el); fire('mouseover', el); hoverEl = el; }
      fire('pointermove', el); fire('mousemove', el);
    }
  }

  function drawPreview(lm: Pt[] | null) {
    if (!stream) return;
    const W = prev.width, H = prev.height;
    pg.clearRect(0, 0, W, H);
    if (!lm) return;
    pg.strokeStyle = pinched ? '#ffcf6a' : 'rgba(255,255,255,.9)'; pg.lineWidth = 2;
    pg.beginPath();
    for (const [a, b] of BONES) { pg.moveTo((1 - lm[a].x) * W, lm[a].y * H); pg.lineTo((1 - lm[b].x) * W, lm[b].y * H); }
    pg.stroke();
    pg.fillStyle = pinched ? '#ffcf6a' : '#fff';
    for (const i of [4, 8]) { pg.beginPath(); pg.arc((1 - lm[i].x) * W, lm[i].y * H, 3.5, 0, 7); pg.fill(); }
  }

  raf = requestAnimationFrame(frame);
  const onVis = () => { if (document.hidden && pinched) release(true); };
  document.addEventListener('visibilitychange', onVis);
  return () => {
    cancelAnimationFrame(raf);
    if (pinched) release(true);
    document.removeEventListener('visibilitychange', onVis);
    Element.prototype.setPointerCapture = origCap; Element.prototype.releasePointerCapture = origRel;
    ui.remove(); cleanup();
  };
}
