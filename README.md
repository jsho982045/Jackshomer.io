# jackshomer.io

Six versions of one portfolio, each one physical in a different way. Switch between them from the dock (top right) or with `[` and `]`.

| Path | Design | What it is |
| --- | --- | --- |
| `/linen` | Linen | Cross-stitched linen banner, 3D Verlet cloth rendered in WebGL. Pull, cut, tear it down to read the wall. |
| `/desk` | Desk | Walnut desk; paper objects with a small rigid-body model. |
| `/machine` | Machine | Hardware instrument: detented dial, mechanical keys, a cartridge shelf of projects. |
| `/gel` | Gel | Pressure soft bodies with a refraction shader. Throw and squash them. |
| `/cabin` | Cabin | three.js log cabin: fire, rain, a bookcase of projects, and an old man who'd rather you left. |
| `/ask` | Ask | An assistant that only answers questions about Jack (Gemini via `server/ask.ts`, offline fallback built in). |

Pages: `/story`, `/resume` (fast facts + PDF), `/built` (live numbers on how the site is built). Anything else gets the 404 tag.

## Run it

```bash
npm install
npm run textures # downloads CC0 photo textures from Poly Haven into public/textures (skips ones you have)
npm run dev      # http://localhost:5173  (proxies /api to the Ask server on :8787)
npm run build    # type-check + production build into dist/
npm run preview  # serve the production build
```

### The Ask server

```bash
cp .env.example .env    # then put your GEMINI_API_KEY (free, from aistudio.google.com) in .env (never commit it)
npm run ask             # builds server/ask.ts and serves it on :8787
```

Without the server (or the key) the Ask page quietly uses its offline engine.

On Railway, the Ask server is its own service from this repo:

- Build command: `npm ci && npm run build:ask`
- Start command: `npm run start:ask`
- Variables: `GEMINI_API_KEY` (required), optional `ASK_MODEL`, `DAILY_CAP`
- Then on the **web** service set `VITE_ASK_URL=https://<ask-service-domain>/ask` and redeploy.

Limits: 15 questions per 10 minutes and 60 per day per visitor, plus a daily global cap. Message content is never logged.

## How it's built (and why it's fast)

- **Vite + TypeScript, no UI framework.** The shell is a few KB gzipped.
- **Every design is its own chunk** (code, CSS and fonts) and loads on first visit, prefetched on hover/touch.
- **Linen and Gel paint in 2D immediately**, then load a WebGL renderer in the background and cross-fade to it.
- **Physics runs on a fixed 60 Hz timestep** (`src/lib/loop.ts`) and pauses when the tab is hidden.
- **No per-frame garbage:** simulations use flat typed arrays and preallocated buffers.
- **Adaptive quality:** Linen drops constraint passes and the Cabin lowers its render resolution if a device can't keep up. Depth of field is desktop-only.
- **Self-hosted fonts** (Fontsource).
- **Sounds** are CC0 recordings from Kenney's Interface Sounds (`public/sounds`), with synthesized fallbacks.
- `vite.config.ts` writes `build-stats.json`, which `/built` reads to show real bundle sizes.

## Textures

`npm run textures` fetches 1K photo-scanned textures from [Poly Haven](https://polyhaven.com) (CC0) and converts them to WebP in `public/textures/`. Everything that uses them falls back to a procedural texture if a file is missing.

## Editing content

Everything the site says about Jack lives in `src/content/jack.ts` (jobs, story, projects shelf, résumé bullets). Every design, the résumé page and the Ask server's system prompt read from it. Regenerate `public/Jack_Shomer_Resume.pdf` by printing `/resume` to PDF (Letter, no margins) if the résumé changes.

## Structure

```
index.html           meta, link previews (og.jpg), www → apex redirect
server/ask.ts        Ask API: streaming, rate limits, guardrails (no dependencies)
src/
  main.ts            router, dock, transitions, prefetching
  hub.ts             home page (/)
  content/jack.ts    single source of truth
  lib/loop.ts        fixed-step loop, canvas sizing
  lib/sound.ts       recorded samples + synthesized fallbacks
  designs/
    registry.ts      designs and pages (lazy imports)
    linen/ desk/ machine/ gel/ cabin/ ask/
    story/ resume/ built/ notfound/
```

Each design exports `mount(root) => cleanup`. Its CSS is scoped under `.d-<id>`.
