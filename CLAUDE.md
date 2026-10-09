# CLAUDE.md — OSMOS

OSMOS is a static PWA (no build step, no framework, no npm dependencies). It turns scents into a WebGL2 visualisation and an optional Web Audio drone. It's built on published research into how people match smells to colour, shape and pitch. The owner is Wren (artist name Delrogue).

## The mission
OSMOS should be **as scientifically objective as possible**. Every change has to respect this:
- There are two views. **Consensus** (default) is research-based. **Mine** shows a synaesthete's own painting of a scent. Personal paintings are always labelled **Personal**, never "evidence" or "data", and never feed back into the consensus numbers.
- Each visual or audio mapping is labelled **Evidence** (a published study), **Physical** (follows from the chemistry) or **Artistic** (a design choice). If you add or change a mapping, update the table in the Science panel (`index.html`, `#sciencePanel .maptable`) and the matching table in `README.md`. Never label an artistic choice as evidence.
- Never invent data. If typed text isn't in the library, it gets either a *descriptor-only reading* in neutral grey, built from keywords and labelled as such, or a "not in library" toast with suggestions. Random or hash-seeded readings were removed on purpose. Don't bring them back.
- Per-scent numbers are *editorial estimates*, not measurements, and the UI says so. Keep that wording.
- New facts in `literal`, `mol` or `note` must be verifiable. If unsure, leave the field empty (`""`). Don't guess.
- Citations live in the Science panel's References list. Only link DOIs or URLs you have verified.

## Files
- `index.html`: all markup and CSS, the service-worker registration and the install prompt. Design tokens are in `:root`. Fonts are Fraunces (serif italic), IBM Plex Mono and Inter.
- `app.js`: the engine, one IIFE. Sections are marked with `/* ==== NAME ==== */` banners:
  - `PERSONAL SYNAESTHESIA` (near the top): `sanitizeProfile`, `mine` (persisted as `osmos.mine`), `shared` (from share links, session only), `profileFor`, `personalActive`. Always pass untrusted profiles (localStorage, share links) through `sanitizeProfile`.
  - `THE MAPPING`: `derive(scent)`, the single source of truth for consensus scent → visual and audio parameters, cached in `VCACHE`. `derivePersonal(scent, profile)` builds the same shape from a painting. `alphaNorm()` normalises on-screen energy so lingering, dense scents don't blow out to white.
  - `SEARCH`: `scoreScent`, `searchScents` (fuzzy matching only when there's no strong hit) and `descriptorReading`.
  - `PARTICLES`: a struct-of-arrays `Float32Array` (`PF` = 14 core floats, `EX` = 15 extras per particle: rise, jitter, alpha, seed, volatility, swirl, swirl centre x/y, pulse, form, texture id/amount/scale, mist, flow multiplier). `Emitter.applyView()` switches an emitter between consensus and personal parameters.
  - `WEBGL2`: `GLRenderer`. Each frame runs these passes:
    1. field shader into ⅓-res
    2. personal "sheet" forms (`FS_SHEET`, up to 3 billowing cloth surfaces), then particles as instanced SDF quads (16 floats per instance; textures via the shared `PATTERN` GLSL) into the sharp layer `S`
    3. feedback (`B = advect(A)·decay + S·mix`) for smoke trails
    4. bloom (½ → ¼ → ⅛ with separable blur)
    5. composite with hue-preserving tonemap, vignette and dither

    Float targets need `EXT_color_buffer_float`. Without it, it falls back to RGBA8 with a decay floor.
  - `CANVAS 2D FALLBACK`, used when WebGL2 isn't available.
  - `SOUND`, the Web Audio voices.
  - `STATE / LOOP`: the frame loop, the adaptation model (`Emitter.adaptMul`), mixture hypo-additivity (`mixMul`) and adaptive render quality.
  - `UI`, `MY SYNAESTHESIA (UI)` (editor panel, Consensus/Mine toggle, share links via `#p=`), `OBJECT DETECTION` (TF.js COCO-SSD, lazy-loaded from CDN) and `LANDING + DEMO`.
- `scents.js`: `window.OSMOS_DATA`. It holds the library (143 scents via `add(...)`, including the `molecule` category of single aroma chemicals), the 22 descriptors (Keller & Vosshall 2016 plus earthy and metallic from Dravnieks 1985), the keyword lexicon and the COCO-class → scent map.
- `service-worker.js`: serves the app shell stale-while-revalidate and caches CDN assets (fonts, TF.js, model weights) cache-first.
- `CNAME`: the custom domain, `osmos.delrogue.com`.

## Rules
- **Bump `CACHE_NAME` in `service-worker.js` on every deploy that changes any shipped file.** It's currently `osmos-cache-v6`. Otherwise returning visitors get stale files. The page shows an "updated — reload" toast when a new worker takes over.
- Keep all asset paths relative (`./`, no leading `/`) so the app works on both the custom domain and `github.io`.
- If you add a new shipped file, add it to `APP_SHELL` in the service worker.
- Keep it dependency-free and build-free. CDN scripts should only be TF.js and COCO-SSD, both lazy-loaded.
- Respect `prefers-reduced-motion`, which the app already checks. Wrap every `localStorage` access in try/catch (use the `store` helper).
- `window.OSMOS_UI._debug` exposes `toggleScent(id)`, `derive(id)`, `search(q)`, `emitters`, `particles` and `renderer()` for testing. Keep it.

## Testing
Serve locally: `python3 -m http.server 8765`, then open http://localhost:8765. There are no automated tests. Check:
- the browser console is clean
- the landing demo runs
- Begin adds a scent
- search "pine" gives Pine Forest, "pineapple" gives Pineapple, "lemmon" gives Lemon, and "smoky sweet" gives a descriptor-only reading
- gibberish shows the not-in-library toast
- adding a 4th scent is blocked with a hint
- the Science, Describe and Library panels (Grid and Odour map) work
- the sound toggle works
- ✎ Paint my synaesthesia: changing form/texture/motion/colour updates the stage live; Sheet form renders a billowing surface; Share link round-trips (open it in a new tab → View it / Save to mine)
- the Consensus/Mine toggle switches active scents
- the adaptation % shows on pills after about 30 s

Test on a real phone too, both Android Chrome and iOS Safari.
