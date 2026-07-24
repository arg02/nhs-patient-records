# Roadmap

Open work for the air quality patient-record prototypes. Not a commitment schedule — a reminder of direction and open questions.

---

## Research & clinical framing

### Relative risk (RR) / concentration–response functions

**Status:** Open — needs follow-up design decision.

Epidemiology and WHO/COMEAP health-risk methods express long-term mortality/morbidity associations as **relative risk (or CRF) per µg/m³** (typically per 10 µg/m³), not as multipliers of the WHO guideline. “× WHO” is a useful exceedance signal, but it is **not** the unit used in concentration–response evidence.

**Implications to explore:**

1. Whether the Long-term panel should **lead with µg/m³** (and/or absolute excess above WHO) rather than, or ahead of, “3.6×”-style multipliers.
2. How (if at all) population-level RR / CRF numbers can appear as **clinical guidance** in the footer without overstating individual risk.
3. Pollutant-specific differentials (e.g. WHO/COMEAP PM₂.₅ RR ≈ 1.08 per 10 µg/m³) and caveats: linearity, co-pollutant mixture, population vs individual absolute risk.

**Sources already reviewed (Jul 2026):**

- WHO Global Air Quality Guidelines (2021) — CRFs per unit concentration
- Chen & Hoek meta-analysis (PM₂.₅ mortality) underpinning AQG update
- COMEAP quantification recommendations / PM₂.₅ CRF statements
- GBD integrated exposure–response (µg/m³-based, often non-linear)
- NICE QS181 / DAQI — short-term clinical advice already aligns with Recent/Forecast bands

**Prototype hook:** `HEALTH_ADVICE.longTerm` in [`js/air-quality.js`](js/air-quality.js) is still a placeholder for long-term clinical copy.

---

## Product / design

| Item | Status |
|------|--------|
| Restructure [nhs-data-guide.html](nhs-data-guide.html) into Annual / Previous days / Today / Forecast with end-product mockups | **Done** (Jul 2026) — live on GitHub Pages |
| Promote a 3.2 variant to the main showcase | Open |
| Wire prototype to live exposure API (replace mock) | Open — rules are in the data guide |
| Prototype still simplifies some Today / pollutant-specific paths vs the guide | Open — keep guide normative; align JS when integrating |

---

## Project documentation

| Doc | Status |
|-----|--------|
| [README.md](README.md) | Exists — pages, concepts, maths, hosting, structure |
| [AGENTS.md](AGENTS.md) | Exists — agent workflow, invariants, “update docs after meaningful work” |
| [ROADMAP.md](ROADMAP.md) | This file |
| [nhs-data-guide.html](nhs-data-guide.html) | Exists — NHS integration (four-section layout) |
| Spec / design-decision log | Still thin — key decisions live in README; expand if decisions proliferate |
