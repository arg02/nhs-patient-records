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

_Add further items here as they come up (e.g. promoting a 3.2 variant to the main showcase, live data wiring)._

---

## Project documentation gaps

| Doc | Status |
|-----|--------|
| [README.md](README.md) | Exists — pages, concepts, maths, structure, deploy |
| [nhs-data-guide.html](nhs-data-guide.html) | Exists — NHS integration / data rules |
| This roadmap | Exists — open research & next steps |
| `AGENTS.md` / Cursor rules | **Missing** — no agent guidance for Cursor yet |
| Spec / design-decision log | **Missing** — decisions live in README “Key design decisions” only |
