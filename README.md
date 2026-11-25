# jackshomer.io

Six versions of one portfolio, each one physical in a different way. Switch between them from the dock (top right) or with `[` and `]`.

| Path | Design | What it is |
| --- | --- | --- |
| `/linen` | Linen | Cross-stitched banner, 3D Verlet cloth. Pull, cut, tear it down to read the wall. |
| `/desk` | Desk | Walnut desk; paper objects with a small rigid-body model. |
| `/machine` | Machine | Hardware instrument: detented dial, mechanical keys, toggles, VU needle. |
| `/gel` | Gel | Pressure soft bodies you can throw and squash. |
| `/cabin` | Cabin | three.js log cabin at dusk: fire, rain, lightning, clickable objects. |
| `/ask` | Ask | A small local assistant that only answers questions about Jack. |

## Run it

```bash
npm install
npm run textures # once: downloads CC0 photo textures from Poly Haven into public/textures
npm run dev      # http://localhost:5173
npm run build    # type-check + production build into dist/
npm run preview  # serve the production build
```

## How it's built (and why it's fast)

- **Vite + TypeScript, no UI framework.** The shell is ~3 KB gzipped.
- **Every design is its own chunk** (code, CSS and fonts) and loads on first visit. Designs are prefetched when you hover or touch their link, and the light ones are warmed up when the browser is idle. three.js (~128 KB gzipped) only loads for the Cabin.
- **Physics runs on a fixed 60 Hz timestep** (`src/lib/loop.ts`), so it behaves the same on 60/90/120 Hz screens, and pauses when the tab is hidden.
- **No per-frame garbage:** simulations use flat typed arrays and preallocated buffers.
- **Adaptive quality:** Linen drops constraint passes and the Cabin lowers its render resolution if a device can't keep up.
- **Self-hosted fonts** (Fontsource), so nothing waits on a third-party font CDN.
- **Sounds are synthesized** with Web Audio; there are no audio files.

## Textures

`npm run textures` fetches 1K photo-scanned textures from [Poly Haven](https://polyhaven.com) (CC0, no attribution required) and converts them to WebP in `public/textures/`. The Cabin and Desk load them progressively; if a file is missing, the procedurally generated texture is used instead, so the site always works.

## Editing content

Everything the site says about Jack lives in `src/content/jack.ts`. Every design and the Ask assistant read from it. Empty fields (`email`, `phone`) are hidden everywhere until filled in.

## Structure

```
src/
  main.ts            router, dock, transitions, prefetching
  hub.ts             home page (/)
  shell.css
  content/jack.ts    single source of truth
  lib/loop.ts        fixed-step loop, canvas sizing
  lib/sound.ts       synthesized clicks and swishes
  designs/
    registry.ts      list of designs (lazy imports)
    linen/ desk/ machine/ gel/ cabin/ ask/
```

Each design exports `mount(root) => cleanup`. Its CSS is scoped under `.d-<id>`.

## Deploying

`vercel.json` rewrites every path to `index.html` (so `/cabin` etc. work on refresh) and caches hashed assets for a year.
