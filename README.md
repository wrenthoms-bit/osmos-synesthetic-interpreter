# OSMOS — the hidden visual language of smell

A synesthetic instrument that turns scent into light and sound, built on published research into how people match smells to colour, shape and pitch. Every mapping is labelled **Evidence**, **Physical** or **Artistic** in the in-app Science panel.

Live: https://osmos.delrogue.com (previously https://wrenthoms-bit.github.io/osmos-synesthetic-interpreter/)

## Files

| File | What it is |
|---|---|
| `index.html` | Markup + styles, service-worker registration, install prompt |
| `app.js` | Engine: WebGL2 renderer (Canvas 2D fallback), particle system, mapping, sound, adaptation, UI |
| `scents.js` | The scent library (131 entries), descriptor vocabulary, keyword lexicon, camera-object mapping |
| `service-worker.js` | Offline cache. **Bump `CACHE_NAME` on every deploy** (currently `osmos-cache-v5`) |
| `manifest.json`, `icons/` | PWA metadata |
| `CNAME` | GitHub Pages custom domain (`osmos.delrogue.com`) |
| `CLAUDE.md`, `HANDOVER.md` | Notes for Claude Code |

## How the mapping works

| Visual | Driven by | Basis |
|---|---|---|
| Hue | Association colour of the smell's source | Evidence — Gilbert et al. 1996; Stevenson et al. 2012; Levitan et al. 2014 |
| Darkness | Intensity (stronger → darker) | Evidence — Kemp & Gilbert 1997 |
| Round ↔ angular | Pleasantness, intensity, sweet vs sour | Evidence — Hanson-Vaux et al. 2013; Deroy et al. 2013 |
| Pitch | Fruity/sweet higher; smoky/musky/woody lower | Evidence — Belkin et al. 1997; Crisinel & Spence 2012 |
| Rise speed, trail persistence | Volatility (top / heart / base note) | Physical |
| Fading over time | Olfactory adaptation | Physical — Dalton 2000 |
| Max 3 blended, weaker together | Mixture perception | Evidence — Laing & Francis 1989; Thomas-Danguin et al. 2014 |
| Density, turbulence, timbre, field swirl | — | Artistic |

Descriptors are the 20 from Keller & Vosshall (2016) plus *earthy* and *metallic* from the Dravnieks (1985) atlas. Per-scent values are **editorial estimates** for a typical everyday encounter, not panel measurements. Typed words that aren't in the library get a clearly labelled descriptor-only reading in neutral grey, or no reading at all — never random numbers.

## Adding a scent

In `scents.js`, add one line in the right category block:

```js
add("id", "Name", "category", "emoji", "#hexcolour", I, P, V,
  "descriptor:value descriptor:value …",
  ["search", "synonyms"],
  "Plain-language description.",
  "key molecules",
  "optional extra fact");
```

`I` intensity 0–1 · `P` pleasantness −1…+1 · `V` volatility 0 (lingers) … 1 (fleeting). Then bump `CACHE_NAME`.
