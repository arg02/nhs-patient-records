# AGENTS.md

Guidance for AI agents (and humans) working in this repository.

## What this project is

Static HTML/CSS/JS prototypes for an NHS Cerner-style air quality widget (Long-term WHO · Recent DAQI · Forecast). Design iteration first; live clinical integration is documented separately for NHS implementers.

**Primary integration doc:** [nhs-data-guide.html](nhs-data-guide.html) — four sections (Annual · Previous days · Today · Forecast) with end-product mockups.

**Human overview:** [README.md](README.md)  
**Open work:** [ROADMAP.md](ROADMAP.md)

## Hosting

- **Primary shareable site:** Vercel (password gate via `middleware.js`, `SITE_PASSWORD` env, inactivity logout).
- GitHub Pages may be unpublished; prefer the Vercel URL as the live site.
- Local preview: `python3 serve.py 8765` or `python3 -m http.server 8765`.

## After meaningful work — update docs in the same task

Do **not** wait to be asked. When you finish a new feature, lock a product/data decision, or change deploy/auth behaviour, update the relevant docs **in the same turn**:

| Change type | Update |
|-------------|--------|
| Pages, concepts, data sources, deploy | [README.md](README.md) |
| Open research, next steps, doc gaps | [ROADMAP.md](ROADMAP.md) |
| Agent workflow, invariants, “where is X” | This file (`AGENTS.md`) |
| NHS calculation / API rules | [nhs-data-guide.html](nhs-data-guide.html) |

Keep README factual; put unresolved research on the roadmap; keep AGENTS short and actionable.

## Hard invariants

1. **WHO annual ≠ DAQI daily** — keep long-term WHO maths and DAQI index levels on separate scales.
2. **Past days (−3/−2/−1)** — completed UK-local day stats only; triggers are for Today.
3. **Today** — current situation: NO₂ = latest hour; PM/O₃ = ERG index-point triggers (persist until superseded / cleared). Band anchors = DEFRA 2013; per-index table = ERG proprietary. In NHS-facing docs, omit any Awair reference (separate project).
4. **Tone (NHS-facing copy)** — prefer positive / descriptive phrasing over “do not” / “never” imperatives (reads as aggressive in UK English).
5. **Rounding** — once, last step before DAQI compare; project convention `.5` → up (`Math.floor(value + 0.5)`).
6. **UK calendar days** — group with `Europe/London` (BST-aware); timestamps are GMT hour-start.
7. **Commits / push** — only when the user asks. Prefer local preview before Vercel push when they say so.

## Where to look

| Need | Location |
|------|----------|
| DAQI thresholds, colours, mock patient | `js/air-quality.js` |
| Ladder / widget factories | `js/widget-render.js`, `js/stack-widget.js` |
| Styles | `css/aq-widget.css`, `css/site-nav.css` |
| Password / logout / activity | `middleware.js`, `js/inactivity-logout.js` |
| Fill / threshold tests | `scripts/verify-fill-logic.mjs` |

## Design preference

When editing prototypes, preserve the established Cerner-adjacent widget language (panels, DAQI ladders, WHO bars). Prefer Design **3.2a/3.2b** as the current visual direction unless the user specifies otherwise.
