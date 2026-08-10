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

### Short-term hourly NO₂ / asthma admissions (Birmingham–Solihull)

**Source (Aug 2026):** Shukla et al., BMJ Open 16:e110612 — [doi:10.1136/bmjopen-2025-110612](https://doi.org/10.1136/bmjopen-2025-110612). Full PDF reviewed locally (CC BY).

**Headline findings:** time-series of **18 943** adult (≥16) acute asthma admissions at four Birmingham–Solihull hospitals (Jun 2016–May 2022); Poisson GAM + DLNM on **hourly NO₂** vs hourly admissions; mean NO₂ **18 µg/m³** over lag **0–24 h** → **RR 1.13** (95% CI 1.01–1.26) for **daytime** admissions vs **no exposure**; **RR 1.11** (1.01–1.23) **per +10 µg/m³**; significant association at lag **3–6 h**; stronger in most deprived areas. Authors’ framing: high-temporal resolution for **healthcare preparedness / resource allocation**, not individual prediction.

**Product design takeaways (not locked):**

1. **3.2f hourly Today** is justified as an **optional NO₂ context strip**, not a replacement for the single Today ladder (latest-hour NO₂ / PM·O₃ triggers stay normative).
2. Lag tint is **NO₂-specific**; overall-max DAQI hours can misattribute PM/O₃ peaks.
3. Paper contrast is absolute mean vs **zero**, not “rising” — avoid rise-implies-admissions messaging; 18 µg/m³ is still **DAQI Low** (NO₂ Moderate ≥68) so this paper does **not** redefine DEFRA Moderate+ action bands.
4. Footer: population association / preparedness language; no personal admission risk %; keep DAQI advice as DEFRA bands.
5. No change implied for Recent (−3/−2/−1) or Forecast from this paper alone.

**Next prototype experiments:** compact Today + expandable hourly NO₂; tint only when lag-window hours exceed a stated absolute µg/m³ (not any uptick); µg/m³ tooltips beside DAQI; Low-band (~40–60) commute peak mock alongside Moderate peak.

---

## Product / design

| Item | Status |
|------|--------|
| Restructure [nhs-data-guide.html](nhs-data-guide.html) into Annual / Previous days / Today / Forecast with end-product mockups | **Done** (Jul 2026) — deploy via Vercel only |
| Keep GitHub Pages unpublished (proprietary trigger table) | **Policy** — Vercel password gate is the public host; remind if asked to push to Pages |
| Promote a 3.2 variant to the main showcase | Open |
| Wire prototype to live exposure API (replace mock) | Open — rules are in the data guide |
| Prototype still simplifies some Today / pollutant-specific paths vs the guide | Open — keep guide normative; align JS when integrating |
| Explore hourly Today panel (3.2f) — lag-sensitive short-term view | **Prototype** (Aug 2026) — mock NO₂ morning peak; 3–6h lag tint; layout experiment: hourly Today **full-width row above** Long-term \| Recent \| Forecast (not squeezed in ladders span); decide whether this supplements or replaces the single Today ladder; framing caveats from Shukla et al. (see research note above) |

---

## Project documentation

| Doc | Status |
|-----|--------|
| [README.md](README.md) | Exists — pages, concepts, maths, hosting, structure |
| [AGENTS.md](AGENTS.md) | Exists — agent workflow, invariants, “update docs after meaningful work” |
| [ROADMAP.md](ROADMAP.md) | This file |
| [nhs-data-guide.html](nhs-data-guide.html) | Exists — NHS integration (four-section layout) |
| Spec / design-decision log | Still thin — key decisions live in README; expand if decisions proliferate |
