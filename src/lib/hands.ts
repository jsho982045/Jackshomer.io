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
    <canvas class="hands-glove"></canvas>
    <div class="hands-cur"><i></i></div>`;
  document.body.append(ui);
  const video = ui.querySelector('video')!, prev = ui.querySelector<HTMLCanvasElement>('.hands-prev canvas')!, pg = prev.getContext('2d')!;
  const cur = ui.querySelector<HTMLDivElement>('.hands-cur')!;
  if (stream) { video.srcObject = stream; void video.play(); } else ui.querySelector('.hands-prev')!.remove();
  prev.width = 160; prev.height = 120;
  const glove = ui.querySelector<HTMLCanvasElement>('.hands-glove')!, gg = glove.getContext('2d')!;
  const fitGlove = () => { const d = Math.min(2, devicePixelRatio); glove.width = innerWidth * d; glove.height = innerHeight * d; gg.setTransform(d, 0, 0, d, 0, 0); };
  fitGlove(); addEventListener('resize', fitGlove);
  let lastLm: Pt[] | null = null, grip = 0;

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
  // ---------- magnetic targets: buttons and links pull the pointer in, so they're easy to hit ----------
  const CLICKABLE = 'a[href], button, [role="button"], summary, label, input, select, textarea, [tabindex]:not([tabindex="-1"])';
  let snapPress = false, rawDX = 0, rawDY = 0, rawX = 0, rawY = 0;
  let targets: { el: Element; r: DOMRect }[] = [], targetsAt = 0, snapEl: Element | null = null;
  function refreshTargets(now: number) {
    if (now - targetsAt < 150) return; targetsAt = now;
    targets = [];
    for (const el of document.querySelectorAll(CLICKABLE)) {
      if (ui.contains(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || r.width * r.height > 360 * 140 || r.bottom < 0 || r.top > innerHeight) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.pointerEvents === 'none' || Number(cs.opacity) < 0.3) continue;
      if ((el as HTMLElement).closest('[hidden]')) continue;
      targets.push({ el, r });
    }
  }
  function snap(px: number, py: number): [number, number] {
    let best: { el: Element; r: DOMRect } | null = null, bd = 46;
    for (const t of targets) {
      const dx = Math.max(t.r.left - px, 0, px - t.r.right), dy = Math.max(t.r.top - py, 0, py - t.r.bottom);
      const d = Math.hypot(dx, dy);
      if (d < bd || (d === 0 && best && t.r.width * t.r.height < best.r.width * best.r.height)) { bd = d; best = t; }
    }
    if (best !== null) {
      const b: { el: Element; r: DOMRect } = best;
      if (snapEl !== b.el) { snapEl?.classList.remove('hand-target'); b.el.classList.add('hand-target'); snapEl = b.el; }
      // pull toward the centre: all the way when close, partly at the edge of the field
      const cx = b.r.left + b.r.width / 2, cy = b.r.top + b.r.height / 2, k = bd === 0 ? 0.65 : 0.45;
      return [px + (cx - px) * k, py + (cy - py) * k];
    }
    snapEl?.classList.remove('hand-target'); snapEl = null;
    return [px, py];
  }
  const under = () => { const el = document.elementFromPoint(sx, sy); return el && !ui.contains(el) ? el : null; };
  let hoverEl: Element | null = null;

  function press() {
    pinched = true;
    // pressing near a button or link presses that button, even if the finger drifted a little
    if (snapEl) { const r = snapEl.getBoundingClientRect(); sx = r.left + r.width / 2; sy = r.top + r.height / 2; }
    snapPress = !!snapEl; rawDX = rawX; rawDY = rawY;
    downTarget = snapEl ?? under(); downAt = performance.now(); downX = sx; downY = sy; moved = 0;
    fire('pointerdown', downTarget); fire('mousedown', downTarget);
    cur.classList.add('down');
  }
  function release(cancel = false) {
    const t = downTarget; pinched = false;
    fire(cancel ? 'pointercancel' : 'pointerup', t, { buttons: 0 }); fire('mouseup', t, { buttons: 0 });
    // a short, still pinch is a click on whatever is under the finger
    if (!cancel && moved < 34 && performance.now() - downAt < 750) { const el = t; if (el) { fire('click', el, { buttons: 0 }); (el as HTMLElement).focus?.({ preventScroll: true }); } }
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
      if (lostFor > 0.25) { if (pinched) release(true); cur.classList.add('lost'); seen = false; lastLm = null; snapEl?.classList.remove('hand-target'); snapEl = null; }
      drawPreview(null); smoothStep(dt); return;
    }
    lostFor = 0; cur.classList.remove('lost');
    // pointer = between thumb and index tips; mirrored, with a margin so the screen edges are easy to reach
    const th = lm[4], ix = lm[8];
    const px = 1 - (th.x + ix.x) / 2, py = (th.y + ix.y) / 2;
    const m = 0.14;
    x = Math.min(1, Math.max(0, (px - m) / (1 - 2 * m))) * innerWidth;
    y = Math.min(1, Math.max(0, (py - m) / (1 - 2 * m))) * innerHeight;
    lastLm = lm; rawX = x; rawY = y;
    if (!pinched) { refreshTargets(now); [x, y] = snap(x, y); }
    if (!seen) { sx = x; sy = y; seen = true; }
    // pinch with hysteresis, relative to hand size so distance from the camera doesn't matter
    const size = dist(lm[0], lm[9]) || 0.1;
    const ratio = dist(th, ix) / size;
    grip = Math.max(0, Math.min(1, (0.75 - ratio) / 0.45));
    if (!pinched && ratio < 0.38) press();
    else if (pinched && ratio > 0.56) release();
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
    // a press on a button holds the pointer on it until the hand clearly moves away
    if (pinched) {
      moved = Math.max(moved, Math.hypot(rawX - rawDX, rawY - rawDY));
      if (snapPress && moved < 34) { x = downX; y = downY; }
    }
    // follow the hand: snappy when moving fast, steady when nearly still (cuts jitter)
    const d = Math.hypot(x - sx, y - sy);
    const k = 1 - Math.pow(d > 40 ? 0.0005 : d > 8 ? 0.004 : 0.03, dt);
    const nx = sx + (x - sx) * k, ny = sy + (y - sy) * k;
    const mv = Math.hypot(nx - sx, ny - sy);
    sx = nx; sy = ny;
    cur.style.transform = `translate(${sx}px, ${sy}px)`;
    drawGlove();
    if (!seen || mv < 0.2) return;
    if (pinched) { fire('pointermove', downTarget); fire('mousemove', downTarget); }
    else {
      const el = under();
      if (el !== hoverEl) { fire('pointerout', hoverEl); fire('mouseout', hoverEl); fire('pointerover', el); fire('mouseover', el); hoverEl = el; }
      fire('pointermove', el); fire('mousemove', el);
    }
  }

  /** the hand itself, drawn around the pointer so you can see it open and close */
  function drawGlove() {
    gg.clearRect(0, 0, innerWidth, innerHeight);
    const lm = lastLm;
    if (!lm || !seen) return;
    const mx = 1 - (lm[4].x + lm[8].x) / 2, my = (lm[4].y + lm[8].y) / 2;
    const size = Math.hypot(lm[0].x - lm[9].x, lm[0].y - lm[9].y) || 0.1;
    const S = 120 / size; // the palm is ~120px tall on screen whatever your distance from the camera
    const P = (i: number): [number, number] => [sx + ((1 - lm[i].x) - mx) * S, sy + (lm[i].y - my) * S];
    const warm = pinched ? 1 : grip * 0.6;
    const fill = `rgba(${255}, ${Math.round(255 - 48 * warm)}, ${Math.round(255 - 150 * warm)}, ${0.45 + 0.3 * warm})`;
    const line = `rgba(255, ${Math.round(255 - 48 * warm)}, ${Math.round(255 - 150 * warm)}, 0.92)`;
    gg.save();
    gg.globalAlpha = snapEl && !pinched ? 0.5 : 0.88; // see through the hand to what you're about to press
    gg.shadowColor = 'rgba(0,0,0,.45)'; gg.shadowBlur = 14; gg.shadowOffsetY = 6;
    // palm
    gg.beginPath();
    for (const [k, i] of [0, 1, 5, 9, 13, 17].entries()) { const [px2, py2] = P(i); if (k) gg.lineTo(px2, py2); else gg.moveTo(px2, py2); }
    gg.closePath(); gg.fillStyle = fill; gg.fill();
    // fingers: thick rounded strokes that taper to the tip
    gg.lineCap = 'round'; gg.lineJoin = 'round'; gg.strokeStyle = line;
    const fingers = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]];
    for (const f of fingers) {
      for (let j = 0; j < f.length - 1; j++) {
        const [ax, ay] = P(f[j]), [bx, by] = P(f[j + 1]);
        gg.lineWidth = Math.max(7, (S * size) * (0.2 - j * 0.03));
        gg.beginPath(); gg.moveTo(ax, ay); gg.lineTo(bx, by); gg.stroke();
      }
    }
    gg.shadowBlur = 0;
    // knuckle line across the palm
    gg.lineWidth = 3; gg.strokeStyle = 'rgba(255,255,255,.35)';
    gg.beginPath(); for (const [k, i] of [5, 9, 13, 17].entries()) { const [px2, py2] = P(i); if (k) gg.lineTo(px2, py2); else gg.moveTo(px2, py2); } gg.stroke();
    // a spark where thumb meets finger
    if (pinched) { gg.fillStyle = 'rgba(255, 214, 120, .9)'; gg.beginPath(); gg.arc(sx, sy, 6, 0, 7); gg.fill(); }
    gg.restore();
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
    removeEventListener('resize', fitGlove); snapEl?.classList.remove('hand-target');
    ui.remove(); cleanup();
  };
}
