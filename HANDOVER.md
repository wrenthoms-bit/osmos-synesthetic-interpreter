# Handover → Claude Code: ship OSMOS v2 to osmos.delrogue.com

Read `CLAUDE.md` first. It covers the architecture, the objectivity rules and the cache-bump rule.

## Where things stand
OSMOS v2 was built in a Claude chat session and delivered as a zip. Compared with v1 on `main`, it:
- rebuilt the science model on published odour descriptors, with mappings tagged Evidence / Physical / Artistic and a 14-item reference list in the Science panel
- grew the library from 37 to 131 scents, each with key molecules
- replaced the Canvas 2D renderer with a WebGL2 one, keeping a 2D fallback
- added a Library panel (grid view plus "Odour map" scatter), a sound layer, an olfactory adaptation model, hold-to-sniff, fuzzy search with suggestions, and an honest not-in-library flow
- fixed a search bug where "pineapple" loaded Pine Forest
- fixed a factual error: sea air now credits dimethyl sulfide, not salt
- split the code into `index.html` + `app.js` + `scents.js`
- bumped `CACHE_NAME` to `osmos-cache-v5`

v2.1 adds the personal mode and molecules described below. It was tested in headless Chromium with software WebGL. It has **not** been tested on a real phone or GPU, and camera object detection was not exercised.

## Update — v2.1 (after a Basenotes synaesthete's feedback)
- **✎ Paint my synaesthesia** (personal mode). A synaesthete sets two colours, form (orbs / shards / threads / mist / **sheet** / rain), texture (smooth / grain / stripes / ripples / cells / fibres), motion (drift / rise / fall / swirl / pulse / still), where it sits in their visual field, size, density and a note. It's saved on the device and shareable as a `#p=` link. A Consensus/Mine toggle sits above the scent pills. It's always labelled **Personal**.
- **Renderer:** per-particle textures, thread/mist/rain forms, a billowing "sheet" shader layer, and brightness normalisation (`alphaNorm`) so heavy base notes like vanilla no longer blow out to white.
- **Consensus textures** are labelled Artistic, loosely based on Demattè et al. 2006, which is added to the references (now 15).
- **New "Aroma molecules" category** (12 entries: ethyl vanillin, vanillin, Iso E Super, Ambroxan, Hedione, Galaxolide, Calone, aldehydes, linalool, coumarin, indole, dihydromyrcenol). Total is now 143.
- **Cache** bumped to `osmos-cache-v6`.

If you already synced v2 into the repo, overwrite with these files. All changes are in `index.html`, `app.js`, `scents.js`, `service-worker.js`, `README.md`, `CLAUDE.md` and `HANDOVER.md`.

Extra real-device checks for v2.1:
- the editor bottom sheet on phones (64vh)
- the colour picker on iOS
- the share link via the native share sheet
- frame rate with 3 sheets plus textured particles

## Your tasks

### 1. Sync into the repo
Repo: `wrenthoms-bit/osmos-synesthetic-interpreter`. Live now at `https://wrenthoms-bit.github.io/osmos-synesthetic-interpreter/`.
- Create a branch, e.g. `v2`.
- Replace the repo contents with the v2 files: `index.html`, `app.js`, `scents.js`, `service-worker.js`, `manifest.json`, `icons/`, `README.md`, `CLAUDE.md`, `HANDOVER.md` and `CNAME`.
- Check `git diff --stat` against `main`. If `main` has commits that aren't in v2, such as edits made after the zip was downloaded, flag them to Wren before overwriting.
- Run the local checks in `CLAUDE.md → Testing`. The console should have no errors apart from offline font loads.

### 2. Point the subdomain at GitHub Pages
- `CNAME` (repo root) contains exactly `osmos.delrogue.com`.
- In repo **Settings → Pages**, set the source to deploy from branch `main`, folder `/ (root)`, and set the custom domain to `osmos.delrogue.com`. Setting it in the UI also commits/keeps the CNAME file.
- **DNS, done by Wren at the delrogue.com registrar or DNS host.** Claude can't do this step:
  - Type `CNAME`, host `osmos`, value `wrenthoms-bit.github.io` (no repo path, no https://).
  - Remove any existing A or AAAA records on `osmos` that conflict.
  - Strongly recommended: verify `delrogue.com` under GitHub account **Settings → Pages → Verified domains**, which prevents subdomain takeover.
- After DNS resolves (minutes to hours; check with `dig osmos.delrogue.com +short`), tick **Enforce HTTPS**. The tickbox stays greyed out until GitHub issues the certificate. HTTPS matters here because camera, service worker and PWA install all need a secure context.
- The old `github.io` URL will redirect to the custom domain automatically.

### 3. Merge and verify live
- Open a PR from `v2` to `main`, then merge.
- On `https://osmos.delrogue.com` check:
  - the service worker registers (DevTools → Application) and the cache is `osmos-cache-v6`
  - the manifest has no errors and the install prompt appears
  - the camera turns on and COCO-SSD loads from the CDN, with boxes labelled like "cup → Coffee?"
  - the sound plays after a tap
- PWA note: an install from the old `github.io` origin is a separate app. Wren should uninstall it and reinstall from the new domain.

### 4. Real-device checks (ask Wren to test, then fix)
- **Android Chrome and iOS Safari:** frame rate. Adaptive quality lowers `renderScale` if frames are slow. Tune `lowEnd`, the particle caps in `allocParticles(...)` and the `cap` in `resize()` if needed.
- **iOS Safari:** WebGL2 half-float render targets. If they're unsupported, the renderer falls back to RGBA8 automatically. Watch for trail "ghosting"; if it appears, raise `uFloor`.
- **Bottom sheet:** on short phones, check that it doesn't cover too much of the stage.

## Nice-to-haves (only if Wren asks)
- Social preview: Open Graph tags plus a 1200×630 image for the new domain.
- A "share this blend" URL hash, e.g. `#s=coffee+rose`, read on load.
- More scents. Follow the `add(...)` format in `README.md`, keep facts verifiable, and bump the cache.

## Don't
- Don't change mapping formulas in `derive()` without updating the Science panel table and its Evidence/Artistic labels.
- Don't add a build step, framework or analytics.
- Don't use absolute paths. Everything stays relative.
