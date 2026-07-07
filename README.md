# Air Quality Patient Record Integration

Prototype widgets exploring how long-term WHO exposure, recent daily air quality, and short-term forecast information could appear in an NHS Cerner-style patient record. Built as static HTML/JS for rapid design iteration and hosted on GitHub Pages.

**Live site:** https://arg02.github.io/nhs-patient-records/

---

## Pages

| Page | URL | Purpose |
|------|-----|---------|
| **All concepts** | [index.html](index.html) | Concepts 1–3 side by side |
| **Design 3 workspace** | [concept3.html](concept3.html) | Iterations 3.0–3.5 on the DAQI-ladder design |
| **Design 3.2 workspace** | [concept32.html](concept32.html) | Fork of 3.2 — coloured ratios, pollutant key strip, ERG credit |
| **NHS data guide** | [nhs-data-guide.html](nhs-data-guide.html) | Integration guide — single exposure range call (`value` → Long-term, `nowcast_value` → Recent), lat/lng, pollutant-specific DAQI (PM daily mean, NO₂ max hourly, O₃ rolling 8h; UK-local/BST), integer rounding, forecast; today’s DAQI (Awair trigger rules) documented as placeholder |

---

## Concepts overview

### Concept 1 — Cerner-style switcher

- Pollutant switcher (PM₂.₅, PM₁₀, NO₂, O₃) in the header
- **Long-term:** single large WHO comparison bar + ratio for the selected pollutant
- **Recent:** DAQI colour blobs per day
- **Forecast:** DAQI blob + band label
- DAQI legend below Recent

### Concept 2 — Annual 2×2 grid

- No pollutant switcher — all four pollutants shown at once
- **Long-term:** 2×2 grid of WHO vertical pills
- **Recent:** DAQI circles (with demo moderate PM₂.₅ days on −3d/−2d)
- **Forecast:** DAQI circle

### Concept 3 — DAQI ladders (primary direction)

- Three-panel layout: **Long-term · Recent · Forecast**
- Header: [“Air quality at patient's home”](js/stack-widget.js#L55) · {name} · SE1
- DAQI **ladder** visual for Recent/Forecast (10-segment UK index)
- DAQI legend pinned below the Recent card
- No pollutant switcher; PM₂.₅ drives Recent/Forecast by default

Detailed iteration history lives in [concept3.html](concept3.html) and [concept32.html](concept32.html).

---

## Design 3 iterations

| ID | Long-term panel | Recent / Forecast |
|----|-----------------|-------------------|
| **3.0** | Variable WHO line height per bar; concentration above bar | DAQI ladders |
| **3.1** | Shared WHO dotted line; above-WHO height ∝ (annual − WHO) / WHO | DAQI ladders |
| **3.2** | Ratio **above** bar, concentration **below**; WHO label left, µg/m³ right | DAQI ladders |
| **3.2a** | Coloured × ratios; pollutant key strip; WHO µg/m³ on bars; year label; ERG credit (dark logo) | DAQI ladders — see [concept32.html](concept32.html) |
| **3.2b** | Same as 3.2a | Same; light-blue ERG logo under Forecast |
| **3.3** | Alternative annual profile; coloured × ratios | DAQI **circle stacks** (varied demo levels) |
| **3.4** | Reuses 3.3 long-term chart | Full **13-level CAQI** circle stacks + five-group legend |
| **3.5** | Reuses 3.2 aligned chart | Full CAQI **WHO-line pill bars** (horizontal colour strips) + legend |

### Long-term bar mathematics (3.1 / 3.2 aligned)

WHO dotted line is fixed at **52%** of track height.

**Below the line** (up to WHO guideline):

```
if annual ≥ WHO:  belowHeight = 52% of track
else:             belowHeight = (annual / WHO) × 52%
```

**Above the line** (excess over WHO):

```
excessRatio = (annual − WHO) / WHO
aboveHeight = (excessRatio / maxExcessAcrossPollutants) × 48% of track
```

The pollutant with the largest excess ratio fills the zone above the line; others scale proportionally.

**3.0 baseline** uses a per-bar scale: `scaleMax = max(annual, WHO × 1.15)` so each bar tops out at full track height independently.

### Fill logic (Recent / Forecast level visuals)

For ladder, circle, and pill-bar level displays:

> **All segments/circles/strips at or below the reached level are coloured; everything above is grey.**

Long-term concentration pills are intentionally different — height is proportional to concentration, not discrete index level.

---

## Data sources

All patient data is **mocked** in [`js/air-quality.js`](js/air-quality.js) via `mockPatientExposure()`. See [nhs-data-guide.html](nhs-data-guide.html) for how NHS implementers should integrate live data — including a single geocoded lat/lng range call to the exposure service (`value` → Long-term annual, `nowcast_value` → Recent), grouping hourly GMT timestamps into UK-local calendar days (BST-aware), pollutant-specific DAQI rules (PM daily mean; NO₂ max hourly; O₃ rolling 8h), and rounding concentrations to integers before band comparison.

| Data | Source / basis |
|------|----------------|
| **Exposure service (Long-term + Recent)** | Single `/coords` range call — `value` (LAEI 2022 annual at lat/lng) and `nowcast_value` (hourly nowcast); see [nhs-data-guide.html](nhs-data-guide.html) |
| **UK DAQI colours & daily thresholds** | [daqi-vs-caqi](https://github.com/arg02/daqi-vs-caqi) — `colorScales.ts` (DEFRA/DAQI ladder, indices 1–10) |
| **WHO annual guidelines** | WHO air quality guidelines (µg/m³): PM₂.₅ 5, PM₁₀ 15, NO₂ 10, O₃ 60 |
| **Long-term bar colours** | Pollutant-specific palette — solid above WHO guideline, light fill below |
| **CAQI scale (3.4 / 3.5)** | [daqi-vs-caqi](https://github.com/arg02/daqi-vs-caqi) CAQI(false)I — 13 levels in five groups: Meets WHO, Above WHO, Moderate, High, V.High |
| **Forecast band** | [London Air forecast](https://londonair.org.uk/data/londonair/LondonAirForecast.asp) (ERG) — band → representative DAQI level via `FORECAST_BAND_DAQI` |
| **Patient** | Fictional: Eleanor Marsh, SE1 |

Demo overrides (not “real” readings) are applied per variant for visual variety — e.g. `recentDaysForLadder()`, `recentDaysForV33()`, `who-data-v34.js`, `who-data-v35.js`.

---

## Project structure

```
├── index.html              # Concepts 1–3 showcase
├── concept3.html           # Design 3 iteration workspace (3.0–3.5)
├── concept32.html          # Design 3.2 coloured-ratio fork (3.2a / 3.2b)
├── nhs-data-guide.html     # NHS implementer integration guide
├── images/                 # ERG logos for forecast credit
├── css/aq-widget.css       # Shared widget styles
├── js/
│   ├── air-quality.js      # DAQI/WHO constants, mock data, helpers
│   ├── widget-render.js    # DAQI ladders, circles, baseline WHO charts
│   ├── stack-widget.js     # createStackWidget* factory functions
│   ├── who-chart-v31.js    # 3.1 aligned WHO long-term chart
│   ├── who-chart-v32.js    # 3.2 long-term layout
│   ├── who-chart-v32a.js   # 3.2a coloured ratios, on-bar WHO labels
│   ├── erg-credit.js       # ERG forecast data source credit
│   ├── who-chart-v33.js    # 3.3 alternative profile
│   ├── who-caqi-v34.js     # CAQI scale (re-exports v35)
│   ├── who-recent-v34.js   # 3.4 circle stacks + legend
│   ├── who-caqi-v35.js     # Full 13-level CAQI constants
│   └── who-recent-v35.js   # 3.5 pill bars + legend
├── scripts/
│   └── verify-fill-logic.mjs  # Automated fill-rule checks
└── serve.py                # Local dev server (no-cache headers)
```

---

## Local development

```bash
python3 serve.py 8765
```

Then open:

- http://localhost:8765/index.html
- http://localhost:8765/concept3.html
- http://localhost:8765/concept32.html
- http://localhost:8765/nhs-data-guide.html

`serve.py` sends `Cache-Control: no-store` so CSS/JS changes show on a normal refresh. Use hard refresh (`Cmd+Shift+R`) if switching between deployed and local copies.

### Verify fill logic

```bash
node scripts/verify-fill-logic.mjs
```

---

## Key design decisions

1. **Separate long-term vs daily indexing** — WHO annual guidelines drive the long-term panel; UK DAQI (or CAQI) drives Recent/Forecast. They are not mixed on the same scale.

2. **Aligned WHO line (3.1+)** — A shared horizontal dotted line lets clinicians compare *relative* exceedance across pollutants on one row, rather than each bar having its own WHO line position (3.0).

3. **Label placement (3.2)** — Ratio above the bar, concentration below, keeps the two numbers visually separated. “WHO” appears once on the left; per-pollutant guideline µg/m³ sits to the right of each bar (3.2) or on the bar (3.2a).

4. **Coloured × ratios (3.3 / 3.2a)** — The multiplier uses each pollutant’s “above WHO” bar colour to tie the headline stat to the bar.

5. **Circle stacks vs pill bars** — 3.4 uses discrete dots (like the DAQI legend) for Recent/Forecast; 3.5 extends the long-term “striped pill” metaphor to daily columns with a full CAQI scale and WHO line at the Meets-WHO boundary.

6. **Legend placement** — DAQI/CAQI keys sit **outside** the Recent card (below it) so the three panels stay equal height and the key reads as shared scale reference. Design 3.2a adds a pollutant key below Long-term and ERG credit below Forecast.

7. **No backend** — Pure static site for GitHub Pages; easy to share and iterate in design reviews.

---

## Deployment

The repo is configured for **GitHub Pages** from the `main` branch (project site at `/nhs-patient-records/`).

```bash
git push origin main
```

Changes are usually live within one to two minutes.

---

## Related repositories

- [arg02/daqi-vs-caqi](https://github.com/arg02/daqi-vs-caqi) — DAQI vs CAQI colour scales and legend components (source of truth for thresholds and CAQI colours)
- [arg02/nhs-patient-records](https://github.com/arg02/nhs-patient-records) — this project

---

## Status

Active design exploration. Mock data only — not for clinical use. Iteration workspaces (`concept3.html`, `concept32.html`) are the intended place to add and review new variants before promoting them to the main showcase.
