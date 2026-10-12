/**
 * Long-term RR findings page — charts and widget mockups.
 * Every percentage is computed from the CRFs below (log-linear, counterfactual = WHO guideline).
 */
import { WHO_ANNUAL, POLLUTANT_WHO_STYLES } from './air-quality.js?v=7';

const LABEL = { o3: 'O₃', pm25: 'PM₂.₅', pm10: 'PM₁₀', no2: 'NO₂' };
const PAGE_ORDER = ['o3', 'pm25', 'pm10', 'no2'];
const COLOR = (sp) => POLLUTANT_WHO_STYLES[sp].above;
const LIGHT = (sp) => POLLUTANT_WHO_STYLES[sp].below;
const FINE_SHARE_COLOR = '#FF8CCB';

/**
 * Long-term mortality, RR per 10 µg/m³ (95% CI) — WHO Europe HRAPIE-2 (2025).
 * PM₂.₅, PM₁₀, NO₂: natural mortality (List A). O₃: respiratory mortality only (List B+),
 * derived on the annual mean of daily max 8-hour; applied here to the peak-season value.
 */
export const CRF = {
  pm25: { rr: 1.10, lo: 1.06, hi: 1.13, source: 'HRAPIE-2 Table 2 (Orellano et al. 2024)' },
  pm10: { rr: 1.08, lo: 1.05, hi: 1.11, source: 'HRAPIE-2 Table 4 (Orellano et al. 2024)' },
  no2: { rr: 1.05, lo: 1.03, hi: 1.07, source: 'HRAPIE-2 Table 5 (Kasdagli et al. 2024)' },
  o3: { rr: 1.05, lo: 1.02, hi: 1.08, source: 'HRAPIE-2 Table 7 (Kasdagli et al. 2024), respiratory' },
};

/** mockPatientExposure() annual values; ozone treated as a peak-season value */
const MOCK = { pm25: 18.2, pm10: 28.4, no2: 22.1, o3: 74.5 };

/** Honor Oak Park 2025 (HP1, urban background) — ozone µg/m³ */
const HP1_2025 = { map: 46.3, exposurePeak: 77.8, stationPeak: 85.0 };

const pctAt = (rr10, deltaC) => (Math.pow(rr10, Math.max(0, deltaC) / 10) - 1) * 100;

function risk(sp, value) {
  const c = CRF[sp];
  const d = value - WHO_ANNUAL[sp];
  return { mid: pctAt(c.rr, d), lo: pctAt(c.lo, d), hi: pctAt(c.hi, d) };
}

const fmt = (n, dp = 1) => n.toFixed(dp);
const pct = (n, dp = 1) => `+${fmt(n, dp)}%`;

/* ------------------------------------------------------------------ */
/* SVG chart helpers                                                   */
/* ------------------------------------------------------------------ */

const W = 640;
const DEFS = `<defs>
  <pattern id="rr-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <rect width="2.5" height="6" fill="rgba(255,255,255,0.6)"/>
  </pattern>
</defs>`;

function svgOpen(h, label) {
  return `<svg class="chart-svg" viewBox="0 0 ${W} ${h}" role="img" aria-label="${label}">${DEFS}`;
}

function rowLabel(x, yMid, label, sub) {
  if (!sub) return `<text x="${x}" y="${yMid + 4}" class="c-label">${label}</text>`;
  return `<text x="${x}" y="${yMid - 2}" class="c-label">${label}</text>
    <text x="${x}" y="${yMid + 11}" class="c-sub">${sub}</text>`;
}

function whisker(x1, x2, y, cap = 5) {
  return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" class="c-ci"/>
    <line x1="${x1}" y1="${y - cap}" x2="${x1}" y2="${y + cap}" class="c-ci"/>
    <line x1="${x2}" y1="${y - cap}" x2="${x2}" y2="${y + cap}" class="c-ci"/>`;
}

/**
 * Horizontal bar chart.
 * rows: [{ label, sub, value, color, lo, hi, hatch, text }]
 */
function hBarChart({ title, rows, max, ticks, axisLabel, labelW = 210, rowH = 38, tickFmt = (v) => v }) {
  const padT = 6;
  const padR = 92;
  const plotH = rows.length * rowH;
  const h = padT + plotH + 40;
  const plotW = W - labelW - padR;
  const x = (v) => labelW + (Math.min(v, max) / max) * plotW;

  let s = svgOpen(h, title);
  ticks.forEach((tv) => {
    s += `<line x1="${x(tv)}" y1="${padT}" x2="${x(tv)}" y2="${padT + plotH}" class="c-grid"/>`;
    s += `<text x="${x(tv)}" y="${padT + plotH + 15}" text-anchor="middle" class="c-tick">${tickFmt(tv)}</text>`;
  });
  s += `<text x="${labelW + plotW / 2}" y="${h - 6}" text-anchor="middle" class="c-axis">${axisLabel}</text>`;

  rows.forEach((r, i) => {
    const y = padT + i * rowH;
    const bh = rowH * 0.46;
    const by = y + (rowH - bh) / 2;
    const yMid = y + rowH / 2;
    s += rowLabel(8, yMid, r.label, r.sub);
    const bw = Math.max(0, x(r.value) - labelW);
    s += `<rect x="${labelW}" y="${by}" width="${bw}" height="${bh}" fill="${r.color}" rx="2"/>`;
    if (r.hatch) s += `<rect x="${labelW}" y="${by}" width="${bw}" height="${bh}" fill="url(#rr-hatch)" rx="2"/>`;
    let end = x(r.value);
    if (r.lo != null && r.hi != null) {
      s += whisker(x(r.lo), x(r.hi), yMid);
      end = Math.max(end, x(r.hi));
    }
    s += `<text x="${end + 7}" y="${yMid + 4}" class="c-value">${r.text ?? fmt(r.value)}</text>`;
  });
  return `${s}</svg>`;
}

/**
 * Forest plot: RR per 10 µg/m³ with 95% CI, reference line at 1.
 * rows: [{ label, sub, rr, lo, hi, color, emphasis }]
 */
function forestPlot({ title, rows, min, max, ticks, labelW = 300, rowH = 40 }) {
  const padT = 18;
  const padR = 120;
  const plotH = rows.length * rowH;
  const h = padT + plotH + 40;
  const plotW = W - labelW - padR;
  const x = (v) => labelW + ((v - min) / (max - min)) * plotW;

  let s = svgOpen(h, title);
  ticks.forEach((tv) => {
    s += `<line x1="${x(tv)}" y1="${padT}" x2="${x(tv)}" y2="${padT + plotH}" class="c-grid"/>`;
    s += `<text x="${x(tv)}" y="${padT + plotH + 15}" text-anchor="middle" class="c-tick">${tv.toFixed(2)}</text>`;
  });
  s += `<line x1="${x(1)}" y1="${padT - 4}" x2="${x(1)}" y2="${padT + plotH}" class="c-ref"/>`;
  s += `<text x="${x(1)}" y="${padT - 7}" text-anchor="middle" class="c-sub">no association</text>`;
  s += `<text x="${labelW + plotW / 2}" y="${h - 6}" text-anchor="middle" class="c-axis">Relative risk per 10 µg/m³ (95% CI)</text>`;

  rows.forEach((r, i) => {
    const yMid = padT + i * rowH + rowH / 2;
    s += rowLabel(8, yMid, r.label, r.sub);
    s += whisker(x(r.lo), x(r.hi), yMid, 4);
    const sz = r.emphasis ? 11 : 8;
    s += `<rect x="${x(r.rr) - sz / 2}" y="${yMid - sz / 2}" width="${sz}" height="${sz}" fill="${r.color}"/>`;
    s += `<text x="${W - padR + 10}" y="${yMid + 4}" class="c-value${r.emphasis ? ' c-value--strong' : ''}">${r.rr.toFixed(r.rr < 1.1 && String(r.rr).length > 4 ? 3 : 2)} (${r.lo.toFixed(2)}–${r.hi.toFixed(2)})</text>`;
  });
  return `${s}</svg>`;
}

/** Vertical grouped bars with a horizontal reference line. */
function groupedBars({ title, groups, series, max, ticks, ref, yLabel }) {
  const padL = 54;
  const padR = 70;
  const padT = 14;
  const plotH = 220;
  const h = padT + plotH + 52;
  const plotW = W - padL - padR;
  const y = (v) => padT + plotH - (v / max) * plotH;
  const groupW = plotW / groups.length;
  const barW = Math.min(26, (groupW - 24) / series.length);

  let s = svgOpen(h, title);
  ticks.forEach((tv) => {
    s += `<line x1="${padL}" y1="${y(tv)}" x2="${W - padR}" y2="${y(tv)}" class="c-grid"/>`;
    s += `<text x="${padL - 8}" y="${y(tv) + 4}" text-anchor="end" class="c-tick">${tv}</text>`;
  });
  s += `<text transform="translate(14 ${padT + plotH / 2}) rotate(-90)" text-anchor="middle" class="c-axis">${yLabel}</text>`;

  groups.forEach((g, gi) => {
    const gx = padL + gi * groupW + (groupW - barW * series.length) / 2;
    g.values.forEach((v, si) => {
      const bx = gx + si * barW;
      s += `<rect x="${bx + 1}" y="${y(v)}" width="${barW - 2}" height="${padT + plotH - y(v)}" fill="${series[si].color}" rx="1.5"/>`;
      s += `<text x="${bx + barW / 2}" y="${y(v) - 4}" text-anchor="middle" class="c-bar-val">${Math.round(v)}</text>`;
    });
    s += `<text x="${padL + gi * groupW + groupW / 2}" y="${padT + plotH + 18}" text-anchor="middle" class="c-label">${g.label}</text>`;
    s += `<text x="${padL + gi * groupW + groupW / 2}" y="${padT + plotH + 32}" text-anchor="middle" class="c-sub">${g.sub}</text>`;
  });

  s += `<line x1="${padL}" y1="${y(ref.value)}" x2="${W - padR}" y2="${y(ref.value)}" class="c-ref-line"/>`;
  ref.label.forEach((line, i) => {
    s += `<text x="${W - padR + 6}" y="${y(ref.value) + 4 + i * 13}" class="c-ref-label">${line}</text>`;
  });
  return `${s}</svg>`;
}

function legendHtml(items) {
  return `<div class="chart-legend">${items.map((it) => `
    <span class="chart-legend__item"><i style="background:${it.color}${it.dashed ? ';height:0;border-top:2px dashed ' + it.color + ';background:none' : ''}${it.hatch ? ';background-image:repeating-linear-gradient(45deg,rgba(255,255,255,.6) 0 2px,transparent 2px 5px)' : ''}"></i>${it.name}</span>`).join('')}</div>`;
}

/* ------------------------------------------------------------------ */
/* Charts                                                              */
/* ------------------------------------------------------------------ */

function chartRiskAt13() {
  const rows = PAGE_ORDER.map((sp) => {
    const d = WHO_ANNUAL[sp] * 0.3;
    const c = CRF[sp];
    return {
      label: LABEL[sp],
      sub: `RR ${fmt(c.rr, 2)} per 10 µg/m³${sp === 'o3' ? ' · respiratory deaths, List B+' : sp === 'pm10' ? ' · includes PM₂.₅' : sp === 'no2' ? ' · overlaps traffic mix' : ' · List A'}`,
      value: pctAt(c.rr, d),
      lo: pctAt(c.lo, d),
      hi: pctAt(c.hi, d),
      color: COLOR(sp),
      hatch: sp === 'o3' || sp === 'pm10',
      text: pct(pctAt(c.rr, d)),
    };
  });
  return hBarChart({
    title: 'Higher long-term mortality risk at 1.3× WHO',
    rows, max: 16, ticks: [0, 4, 8, 12, 16], tickFmt: (v) => `${v}%`,
    axisLabel: 'Higher long-term mortality vs air at the WHO guideline (%)',
  }) + legendHtml([
    { color: '#6b7385', name: 'Solid: natural (all-cause) deaths' },
    { color: '#6b7385', hatch: true, name: 'Hatched: overlapping (PM₁₀) or respiratory-only (O₃)' },
    { color: '#1a2030', name: 'Whisker: 95% confidence interval' },
  ]);
}

function chartSlope() {
  const rows = PAGE_ORDER.map((sp) => {
    const v = pctAt(CRF[sp].rr, 1);
    return {
      label: LABEL[sp],
      sub: `RR ${fmt(CRF[sp].rr, 2)} per 10 µg/m³${sp === 'o3' ? ' · respiratory deaths' : ''}`,
      value: v,
      color: COLOR(sp),
      hatch: sp === 'o3',
      text: `${fmt(v, 2)}% per µg/m³`,
    };
  });
  return hBarChart({
    title: 'Concentration–response: higher risk per 1 µg/m³',
    rows, max: 1.0, ticks: [0, 0.25, 0.5, 0.75, 1.0], tickFmt: (v) => `${v}%`,
    axisLabel: 'Higher long-term mortality per extra 1 µg/m³ (%)',
  });
}

function chartOzoneSites() {
  const series = [
    { name: 'Annual map value (what we use now)', color: '#a8b0bd' },
    { name: 'Station annual mean of all hours', color: '#b9dcf5' },
    { name: 'Station annual mean of daily max 8-hour (HRAPIE-2 metric)', color: '#6fb6ea' },
    { name: 'Exposure-service peak season (Apr–Sep)', color: '#0387E2' },
    { name: 'Station peak season (Apr–Sep, WHO metric)', color: '#0b3f73' },
  ];
  const groups = [
    { label: 'Honor Oak Park', sub: '2025 · background', values: [46.3, 56.6, 74.0, 77.8, 85.0] },
    { label: 'Marylebone Road', sub: '2025 · roadside', values: [34.4, 34.3, 46.4, 65.9, 53.5] },
    { label: 'Honor Oak Park', sub: '2022 · background', values: [46.3, 51.6, 68.3, 70.7, 81.3] },
    { label: 'Marylebone Road', sub: '2022 · roadside', values: [34.4, 28.5, 40.3, 58.8, 49.3] },
  ];
  return groupedBars({
    title: 'Ozone: three metrics at two London sites',
    groups, series, max: 100, ticks: [0, 20, 40, 60, 80, 100],
    ref: { value: 60, label: ['WHO 60', 'peak season'] },
    yLabel: 'Ozone, µg/m³',
  }) + legendHtml(series);
}

function chartOzoneForest() {
  const c = COLOR('o3');
  const grey = '#a8b0bd';
  return forestPlot({
    title: 'Long-term ozone and mortality: what WHO 2021 and HRAPIE-2 assessed',
    min: 0.94, max: 1.1, ticks: [0.95, 1.0, 1.05, 1.1],
    rows: [
      { label: 'WHO 2021 · all-cause', sub: 'peak season · Huangfu & Atkinson 2020', rr: 1.01, lo: 1.0, hi: 1.02, color: grey },
      { label: 'HRAPIE-2 · all-cause', sub: 'annual · List B−, not proposed', rr: 1.01, lo: 0.96, hi: 1.06, color: grey },
      { label: 'HRAPIE-2 · all-cause', sub: 'peak/warm season · List B−, not proposed', rr: 1.01, lo: 0.97, hi: 1.04, color: grey },
      { label: 'HRAPIE-2 · respiratory', sub: 'peak/warm season · List B−, not proposed', rr: 1.01, lo: 0.98, hi: 1.03, color: grey },
      { label: 'HRAPIE-2 · respiratory, US only', sub: 'peak/warm season · noted, not proposed', rr: 1.03, lo: 1.01, hi: 1.04, color: '#6fb6ea' },
      { label: 'HRAPIE-2 · respiratory', sub: 'annual daily max 8-hour · List B+, proposed', rr: 1.05, lo: 1.02, hi: 1.08, color: c, emphasis: true },
    ],
  });
}

function chartOzoneCohorts() {
  const c = COLOR('o3');
  const light = '#6fb6ea';
  return forestPlot({
    title: 'Respiratory mortality in the two largest cohorts behind 1.05: annual vs warm season',
    min: 0.98, max: 1.1, ticks: [1.0, 1.05, 1.1],
    rows: [
      { label: 'Turner 2016 · ACS CPS-II', sub: 'annual daily max 8-hour · 36% of 1.05', rr: 1.068, lo: 1.049, hi: 1.086, color: c },
      { label: 'Turner 2016 · ACS CPS-II', sub: 'warm season (Apr–Sep)', rr: 1.049, lo: 1.034, hi: 1.058, color: light },
      { label: 'Lim 2019 · NIH-AARP', sub: 'annual daily max 8-hour · 34% of 1.05', rr: 1.020, lo: 1.0, hi: 1.044, color: c },
      { label: 'Lim 2019 · NIH-AARP', sub: 'warm season (Apr–Sep)', rr: 1.020, lo: 1.010, hi: 1.030, color: light },
    ],
  }) + legendHtml([
    { color: c, name: 'Annual metric (in HRAPIE-2’s 1.05)' },
    { color: light, name: 'Warm-season metric, same cohort' },
  ]);
}

function chartPm25Curve() {
  const padL = 54;
  const padR = 16;
  const padT = 14;
  const plotH = 230;
  const h = padT + plotH + 46;
  const plotW = W - padL - padR;
  const xMin = 5;
  const xMax = 25;
  const yMax = 30;
  const x = (c) => padL + ((c - xMin) / (xMax - xMin)) * plotW;
  const y = (p) => padT + plotH - (p / yMax) * plotH;
  const who = WHO_ANNUAL.pm25;
  const { rr, lo, hi } = CRF.pm25;

  const linearAt25 = pctAt(rr, xMax - who);
  const k = 6;
  const A = linearAt25 / Math.log(1 + (xMax - who) / k);
  const supra = (c) => A * Math.log(1 + (c - who) / k);

  const pts = [];
  for (let c = xMin; c <= xMax + 1e-9; c += 0.25) pts.push(c);
  const path = (fn) => pts.map((c, i) => `${i ? 'L' : 'M'}${x(c).toFixed(1)},${y(fn(c)).toFixed(1)}`).join(' ');
  const band = `${pts.map((c, i) => `${i ? 'L' : 'M'}${x(c).toFixed(1)},${y(pctAt(hi, c - who)).toFixed(1)}`).join(' ')} ${pts.slice().reverse().map((c) => `L${x(c).toFixed(1)},${y(pctAt(lo, c - who)).toFixed(1)}`).join(' ')} Z`;

  let s = svgOpen(h, 'PM2.5 long-term concentration–response function');
  [0, 10, 20, 30].forEach((p) => {
    s += `<line x1="${padL}" y1="${y(p)}" x2="${W - padR}" y2="${y(p)}" class="c-grid"/>`;
    s += `<text x="${padL - 8}" y="${y(p) + 4}" text-anchor="end" class="c-tick">${p}%</text>`;
  });
  [5, 10, 15, 20, 25].forEach((c) => {
    s += `<text x="${x(c)}" y="${padT + plotH + 16}" text-anchor="middle" class="c-tick">${c}</text>`;
  });
  s += `<text x="${padL + plotW / 2}" y="${h - 6}" text-anchor="middle" class="c-axis">Annual mean PM₂.₅, µg/m³ (WHO guideline = 5)</text>`;
  s += `<text transform="translate(14 ${padT + plotH / 2}) rotate(-90)" text-anchor="middle" class="c-axis">Higher mortality vs guideline (%)</text>`;

  s += `<path d="${band}" fill="${LIGHT('pm25')}" stroke="none"/>`;
  s += `<path d="${path(supra)}" fill="none" stroke="#8a929e" stroke-width="1.6" stroke-dasharray="5 4"/>`;
  s += `<path d="${path((c) => pctAt(rr, c - who))}" fill="none" stroke="${COLOR('pm25')}" stroke-width="2.4"/>`;

  const markers = [
    { c: who * 1.3, label: '1.3× WHO' },
    { c: MOCK.pm25, label: 'Mock patient 3.6× WHO' },
  ];
  markers.forEach((m) => {
    const p = pctAt(rr, m.c - who);
    s += `<line x1="${x(m.c)}" y1="${y(p)}" x2="${x(m.c)}" y2="${padT + plotH}" class="c-drop"/>`;
    s += `<circle cx="${x(m.c)}" cy="${y(p)}" r="4.5" fill="#fff" stroke="${COLOR('pm25')}" stroke-width="2"/>`;
    s += `<text x="${x(m.c) + 8}" y="${y(p) - 8}" class="c-value c-value--strong">${pct(p)}</text>`;
    s += `<text x="${x(m.c) + 8}" y="${y(p) + 6}" class="c-sub">${m.label} (${fmt(m.c)} µg/m³)</text>`;
  });
  s += '</svg>';

  return s + legendHtml([
    { color: COLOR('pm25'), name: `Log-linear CRF, RR ${fmt(rr, 2)} per 10 µg/m³ (HRAPIE-2)` },
    { color: LIGHT('pm25'), name: `95% CI (${fmt(lo, 2)}–${fmt(hi, 2)})` },
    { color: '#8a929e', dashed: true, name: 'Illustrative supralinear shape (not a published function)' },
  ]);
}

function chartPm10Split() {
  const padL = 150;
  const padR = 60;
  const plotW = W - padL - padR;
  const max = 35;
  const x = (v) => padL + (v / max) * plotW;
  const h = 128;
  const by = 30;
  const bh = 30;
  const fine = MOCK.pm25;
  const coarse = MOCK.pm10 - MOCK.pm25;

  let s = svgOpen(h, 'Mock patient PM10 split into fine and coarse share');
  [0, 5, 10, 15, 20, 25, 30, 35].forEach((v) => {
    s += `<line x1="${x(v)}" y1="${by - 8}" x2="${x(v)}" y2="${by + bh + 8}" class="c-grid"/>`;
    s += `<text x="${x(v)}" y="${by + bh + 24}" text-anchor="middle" class="c-tick">${v}</text>`;
  });
  s += rowLabel(8, by + bh / 2, 'PM₁₀ 28.4 µg/m³', 'mock patient, 1.9× WHO');
  s += `<rect x="${x(0)}" y="${by}" width="${x(fine) - x(0)}" height="${bh}" fill="${FINE_SHARE_COLOR}"/>`;
  s += `<rect x="${x(fine)}" y="${by}" width="${x(fine + coarse) - x(fine)}" height="${bh}" fill="${COLOR('pm10')}"/>`;
  s += `<text x="${(x(0) + x(fine)) / 2}" y="${by + bh / 2 + 4}" text-anchor="middle" class="c-in-bar">PM₂.₅ ${fine}</text>`;
  s += `<text x="${(x(fine) + x(fine + coarse)) / 2}" y="${by + bh / 2 + 4}" text-anchor="middle" class="c-in-bar">coarse ${fmt(coarse)}</text>`;
  s += `<line x1="${x(WHO_ANNUAL.pm10)}" y1="${by - 14}" x2="${x(WHO_ANNUAL.pm10)}" y2="${by + bh + 6}" class="c-ref-line"/>`;
  s += `<text x="${x(WHO_ANNUAL.pm10)}" y="${by - 17}" text-anchor="middle" class="c-ref-label">WHO PM₁₀ 15</text>`;
  s += `<text x="${padL + plotW / 2}" y="${h - 6}" text-anchor="middle" class="c-axis">Annual mean, µg/m³</text>`;
  s += '</svg>';
  return s + legendHtml([
    { color: FINE_SHARE_COLOR, name: 'Fine share: risk already counted under PM₂.₅' },
    { color: COLOR('pm10'), name: 'Coarse share (PM₁₀ − PM₂.₅): no agreed long-term RR' },
  ]);
}

function chartPm10Forest() {
  const implied = (r) => Math.pow(r, 0.65);
  const { rr, lo, hi } = CRF.pm25;
  return forestPlot({
    title: 'PM10 RR compared with the PM2.5 it contains',
    min: 1.0, max: 1.12, ticks: [1.0, 1.04, 1.08, 1.12],
    rows: [
      { label: 'PM₁₀, HRAPIE-2', sub: 'Orellano et al. 2024 · List A', rr: CRF.pm10.rr, lo: CRF.pm10.lo, hi: CRF.pm10.hi, color: COLOR('pm10'), emphasis: true },
      { label: 'PM₁₀, WHO 2021', sub: 'Chen & Hoek 2020', rr: 1.04, lo: 1.03, hi: 1.06, color: '#c9a6f5' },
      { label: 'PM₂.₅ inside 10 µg/m³ of UK PM₁₀', sub: `≈6.5 µg/m³ × PM₂.₅ CRF (${fmt(rr, 2)}^0.65)`, rr: +implied(rr).toFixed(3), lo: implied(lo), hi: implied(hi), color: FINE_SHARE_COLOR },
    ],
  });
}

function chartNo2Options() {
  const d = MOCK.no2 - WHO_ANNUAL.no2;
  const c = COLOR('no2');
  const opts = [
    { label: 'COMEAP 2018, NO₂ alone (low)', sub: '25% of unadjusted · 1.006', rr: 1.006 },
    { label: 'COMEAP 2018, NO₂ alone (high)', sub: '55% of unadjusted · 1.013', rr: 1.013 },
    { label: 'WHO 2021 (Huangfu & Atkinson)', sub: '1.02 (1.01–1.04)', rr: 1.02, lo: 1.01, hi: 1.04 },
    { label: 'COMEAP 2018, unadjusted', sub: '1.023 (1.008–1.037)', rr: 1.023, lo: 1.008, hi: 1.037 },
    { label: 'HRAPIE-2, adjusted for PM₂.₅', sub: '1.0374 · Chen et al. 2024 method', rr: 1.0374 },
    { label: 'HRAPIE-2 (Kasdagli et al. 2024)', sub: '1.05 (1.03–1.07) · used here', rr: 1.05, lo: 1.03, hi: 1.07, strong: true },
  ];
  const rows = opts.map((o) => ({
    label: o.label,
    sub: o.sub,
    value: pctAt(o.rr, d),
    lo: o.lo ? pctAt(o.lo, d) : null,
    hi: o.hi ? pctAt(o.hi, d) : null,
    color: o.strong ? c : '#f3d27f',
    text: pct(pctAt(o.rr, d)),
  }));
  return hBarChart({
    title: 'Mock patient NO2 22.1 µg/m³: higher risk under each published coefficient',
    rows, max: 10, ticks: [0, 2, 4, 6, 8, 10], tickFmt: (v) => `${v}%`, labelW: 230,
    axisLabel: 'Higher long-term natural mortality vs air at the WHO guideline (%)',
  });
}

/* ------------------------------------------------------------------ */
/* Widget mockups (Design 3.2b visual language)                        */
/* ------------------------------------------------------------------ */

const TRACK = 96;
const WHO_PX = TRACK * 0.52;
const EXCESS_PX = TRACK - WHO_PX;
const RISK_MAX = 20;

const excessRatio = (sp, v) => (v > WHO_ANNUAL[sp] ? (v - WHO_ANNUAL[sp]) / WHO_ANNUAL[sp] : 0);
const MOCK_MAX_EXCESS = Math.max(...Object.keys(MOCK).map((sp) => excessRatio(sp, MOCK[sp])));

function whoHeights(sp, v, maxExcess = MOCK_MAX_EXCESS) {
  const who = WHO_ANNUAL[sp];
  return {
    below: v >= who ? WHO_PX : (v / who) * WHO_PX,
    above: (excessRatio(sp, v) / maxExcess) * EXCESS_PX,
  };
}

function pill(segments, { hatch = false, flat = false } = {}) {
  const total = segments.reduce((a, s) => a + s.h, 0);
  const segs = segments
    .filter((s) => s.h > 0.2)
    .map((s) => `<div class="mw-seg${hatch ? ' mw-seg--hatch' : ''}" style="height:${s.h.toFixed(1)}px;background-color:${s.color}"></div>`)
    .join('');
  return `<div class="mw-pill${flat ? ' mw-pill--flat' : ''}" style="height:${total.toFixed(1)}px">${segs}</div>`;
}

function whoTrack(segments, opts) {
  return `<div class="mw-track"><div class="mw-who"></div>${pill(segments, opts)}</div>`;
}

function whoSegments(sp, v) {
  const { below, above } = whoHeights(sp, v);
  return [{ h: below, color: LIGHT(sp) }, { h: above, color: COLOR(sp) }];
}

function splitSegments(v10, v25) {
  const { below, above } = whoHeights('pm10', v10);
  const total = below + above;
  const fineH = total * (v25 / v10);
  return [{ h: fineH, color: FINE_SHARE_COLOR }, { h: total - fineH, color: COLOR('pm10') }];
}

function riskTrack(sp, r, { hatch = false } = {}) {
  const hgt = (p) => (Math.min(p, RISK_MAX) / RISK_MAX) * TRACK;
  return `<div class="mw-track mw-track--risk">
    <div class="mw-grid" style="bottom:${hgt(10)}px"></div>
    <div class="mw-grid" style="bottom:${hgt(20)}px"></div>
    ${pill([{ h: hgt(r.mid), color: COLOR(sp) }], { hatch, flat: true })}
    <div class="mw-ci" style="bottom:${hgt(r.lo).toFixed(1)}px;height:${(hgt(r.hi) - hgt(r.lo)).toFixed(1)}px"></div>
  </div>`;
}

function column({ top = '', topColor = '#1a2030', chip = '', track, value, name, note = '' }) {
  return `<div class="mw-col">
    <div class="mw-top" style="color:${topColor}">${top}</div>
    <div class="mw-chip">${chip}</div>
    ${track}
    <div class="mw-val">${value}</div>
    <div class="mw-name">${name}</div>
    <div class="mw-note">${note}</div>
  </div>`;
}

const ugm = (v) => `${Math.round(v)}<span class="mw-unit">µg/m³</span>`;
const ratio = (sp, v, dp = 1) => `${fmt(v / WHO_ANNUAL[sp], dp)}×`;

function whoAxis() {
  return `<div class="mw-axis"><span class="mw-axis__who" style="bottom:${WHO_PX}px">WHO<br>guideline</span></div>`;
}

function riskAxis() {
  const at = (p) => (p / RISK_MAX) * TRACK;
  return `<div class="mw-axis mw-axis--risk">
    ${[0, 10, 20].map((p) => `<span class="mw-axis__tick" style="bottom:${at(p)}px">${p ? `+${p}%` : 'WHO'}</span>`).join('')}
  </div>`;
}

function panel({ title, sub, body, legend = '', wide = false }) {
  return `<div class="mw-panel${wide ? ' mw-panel--wide' : ''}">
    <div class="mw-panel__title">${title}</div>
    <div class="mw-panel__sub">${sub}</div>
    ${body}
    ${legend}
  </div>`;
}

function miniLegend(items) {
  return `<div class="mw-legend">${items.map((it) => `<span><i style="background:${it.color}${it.hatch ? ';background-image:repeating-linear-gradient(45deg,rgba(255,255,255,.65) 0 2px,transparent 2px 5px)' : ''}"></i>${it.name}</span>`).join('')}</div>`;
}

const WIDGET_ORDER = ['pm25', 'pm10', 'no2', 'o3'];

function panelCurrent({ wide = false } = {}) {
  const cols = WIDGET_ORDER.map((sp) => column({
    top: ratio(sp, MOCK[sp]),
    topColor: COLOR(sp),
    track: whoTrack(whoSegments(sp, MOCK[sp])),
    value: ugm(MOCK[sp]),
    name: LABEL[sp],
    note: sp === 'o3' ? 'annual mean' : '',
  })).join('');
  return panel({
    title: 'Long-term',
    sub: 'Annual mean · 2022 · × WHO guideline',
    body: `<div class="mw-cols">${whoAxis()}${cols}</div>`,
    wide,
  });
}

function panelOptionA() {
  const riskCols = ['pm25', 'no2', 'o3'].map((sp) => {
    const r = risk(sp, MOCK[sp]);
    return column({
      top: pct(r.mid),
      topColor: COLOR(sp),
      chip: sp === 'o3' ? 'respiratory · B+' : '',
      track: riskTrack(sp, r, { hatch: sp === 'o3' }),
      value: ugm(MOCK[sp]),
      name: LABEL[sp],
      note: sp === 'o3' ? `peak season · ${ratio(sp, MOCK[sp])} WHO` : `${ratio(sp, MOCK[sp])} WHO`,
    });
  }).join('');
  const pm10Col = column({
    top: ratio('pm10', MOCK.pm10),
    topColor: COLOR('pm10'),
    chip: 'includes PM₂.₅',
    track: whoTrack(splitSegments(MOCK.pm10, MOCK.pm25)),
    value: ugm(MOCK.pm10),
    name: LABEL.pm10,
    note: 'vs WHO, no %',
  });
  return panel({
    title: 'Long-term',
    sub: 'Higher long-term risk than at the WHO guideline · each on its own',
    body: `<div class="mw-cols">${riskAxis()}${riskCols}<div class="mw-divider"></div>${whoAxis()}${pm10Col}</div>`,
    legend: miniLegend([
      { color: FINE_SHARE_COLOR, name: 'PM₂.₅ share' },
      { color: COLOR('pm10'), name: 'Coarse share' },
      { color: COLOR('o3'), hatch: true, name: 'Respiratory deaths, weaker evidence' },
    ]),
  });
}

function panelOptionB() {
  const cols = WIDGET_ORDER.map((sp) => {
    const v = MOCK[sp];
    if (sp === 'pm10') {
      return column({
        top: ratio(sp, v), topColor: COLOR(sp), chip: 'incl. PM₂.₅',
        track: whoTrack(splitSegments(MOCK.pm10, MOCK.pm25)),
        value: ugm(v), name: LABEL[sp],
      });
    }
    const r = risk(sp, v);
    return column({
      top: ratio(sp, v),
      topColor: COLOR(sp),
      chip: `<span class="mw-risk-chip" style="border-color:${COLOR(sp)}">${pct(r.mid)}</span>`,
      track: whoTrack(whoSegments(sp, v), { hatch: sp === 'o3' }),
      value: ugm(v),
      name: LABEL[sp],
      note: sp === 'o3' ? 'peak season' : '',
    });
  }).join('');
  return panel({
    title: 'Long-term',
    sub: 'Annual mean · 2022 · × WHO with higher-risk label',
    body: `<div class="mw-cols">${whoAxis()}${cols}</div>`,
    legend: miniLegend([
      { color: FINE_SHARE_COLOR, name: 'PM₂.₅ share of PM₁₀' },
      { color: COLOR('o3'), hatch: true, name: 'Respiratory deaths, weaker evidence' },
    ]),
  });
}

function mini(label, inner, caption) {
  return `<figure class="mini">
    <div class="mini__label">${label}</div>
    <div class="mini__body">${inner}</div>
    <figcaption>${caption}</figcaption>
  </figure>`;
}

function soloCols(...cols) {
  return `<div class="mw-cols mw-cols--solo">${cols.join('')}</div>`;
}

function miniOzone() {
  const sp = 'o3';
  const ozMax = Math.max(excessRatio(sp, HP1_2025.exposurePeak), excessRatio(sp, HP1_2025.stationPeak));
  const track = (v, opts) => {
    const who = WHO_ANNUAL[sp];
    const below = v >= who ? WHO_PX : (v / who) * WHO_PX;
    const above = (excessRatio(sp, v) / ozMax) * EXCESS_PX;
    return whoTrack([{ h: below, color: LIGHT(sp) }, { h: above, color: COLOR(sp) }], opts);
  };
  const r = risk(sp, HP1_2025.exposurePeak);
  const rs = risk(sp, HP1_2025.stationPeak);
  const now = mini('Now',
    soloCols(whoAxis(), column({ top: ratio(sp, HP1_2025.map, 2), topColor: COLOR(sp), track: track(HP1_2025.map), value: ugm(HP1_2025.map), name: LABEL[sp], note: 'annual map ÷ 60' })),
    'Annual map value against a peak-season guideline. Reads as under WHO.');
  const option = mini('Proposed',
    soloCols(whoAxis(),
      column({ top: ratio(sp, HP1_2025.exposurePeak, 2), topColor: COLOR(sp), chip: `<span class="mw-risk-chip" style="border-color:${COLOR(sp)}">${pct(r.mid)}</span>`, track: track(HP1_2025.exposurePeak, { hatch: true }), value: ugm(HP1_2025.exposurePeak), name: LABEL[sp], note: 'peak season, exposure service' })),
    `Peak-season value (Apr–Sep) against WHO’s 60. ${pct(r.mid)} higher respiratory mortality (95% CI ${fmt(r.lo)}–${fmt(r.hi)}%), HRAPIE-2 RR, hatched.`);
  const ref = mini('Reference',
    soloCols(whoAxis(),
      column({ top: ratio(sp, HP1_2025.stationPeak, 2), topColor: COLOR(sp), chip: `<span class="mw-risk-chip" style="border-color:${COLOR(sp)}">${pct(rs.mid)}</span>`, track: track(HP1_2025.stationPeak, { hatch: true }), value: ugm(HP1_2025.stationPeak), name: LABEL[sp], note: 'peak season, station' })),
    `Station peak season at the same site, for comparison: ${pct(rs.mid)} respiratory.`);
  return `<div class="mini-row">${now}${option}${ref}</div>`;
}

function miniRiskPair(sp, { noteNow = '', noteNew = '', captionNow, captionNew, hatch = false }) {
  const v = MOCK[sp];
  const r = risk(sp, v);
  const now = mini('Now',
    soloCols(whoAxis(), column({ top: ratio(sp, v), topColor: COLOR(sp), track: whoTrack(whoSegments(sp, v)), value: ugm(v), name: LABEL[sp], note: noteNow })),
    captionNow);
  const a = mini('Option A · risk scale',
    soloCols(riskAxis(), column({ top: pct(r.mid), topColor: COLOR(sp), track: riskTrack(sp, r, { hatch }), value: ugm(v), name: LABEL[sp], note: noteNew || `${ratio(sp, v)} WHO` })),
    captionNew);
  const b = mini('Option B · × WHO + risk',
    soloCols(whoAxis(), column({ top: ratio(sp, v), topColor: COLOR(sp), chip: `<span class="mw-risk-chip" style="border-color:${COLOR(sp)}">${pct(r.mid)}</span>`, track: whoTrack(whoSegments(sp, v), { hatch }), value: ugm(v), name: LABEL[sp] })),
    'Bar unchanged; percentage added as a label.');
  return `<div class="mini-row">${now}${a}${b}</div>`;
}

function miniPm10() {
  const v = MOCK.pm10;
  const now = mini('Now',
    soloCols(whoAxis(), column({ top: ratio('pm10', v), topColor: COLOR('pm10'), track: whoTrack(whoSegments('pm10', v)), value: ugm(v), name: LABEL.pm10 })),
    'Reads as a separate risk alongside PM₂.₅.');
  const next = mini('Proposed · both options',
    soloCols(whoAxis(), column({ top: ratio('pm10', v), topColor: COLOR('pm10'), chip: 'includes PM₂.₅', track: whoTrack(splitSegments(v, MOCK.pm25)), value: ugm(v), name: LABEL.pm10, note: 'no %' })) +
      miniLegend([{ color: FINE_SHARE_COLOR, name: 'PM₂.₅ share' }, { color: COLOR('pm10'), name: 'Coarse' }]),
    'Same height against WHO; the lower part is the PM₂.₅ already counted. No percentage.');
  return `<div class="mini-row mini-row--two">${now}${next}</div>`;
}

/* ------------------------------------------------------------------ */

const RENDERERS = {
  'chart-risk-13': chartRiskAt13,
  'chart-slope': chartSlope,
  'chart-o3-sites': chartOzoneSites,
  'chart-o3-forest': chartOzoneForest,
  'chart-o3-cohorts': chartOzoneCohorts,
  'chart-pm25-curve': chartPm25Curve,
  'chart-pm10-split': chartPm10Split,
  'chart-pm10-forest': chartPm10Forest,
  'chart-no2-options': chartNo2Options,
  'panel-current': () => panelCurrent(),
  'panel-current-wide': () => panelCurrent({ wide: true }),
  'panel-option-a': panelOptionA,
  'panel-option-b': panelOptionB,
  'mini-o3': miniOzone,
  'mini-pm25': () => miniRiskPair('pm25', {
    captionNow: '3.6× looks like the biggest bar, but the size of the ratio does not carry the risk.',
    captionNew: `${pct(risk('pm25', MOCK.pm25).mid)} (95% CI ${fmt(risk('pm25', MOCK.pm25).lo)}–${fmt(risk('pm25', MOCK.pm25).hi)}%). Lead long-term figure.`,
  }),
  'mini-pm10': miniPm10,
  'mini-no2': () => miniRiskPair('no2', {
    captionNow: '2.2× sits above PM₁₀ and reads as worse than it is per µg/m³.',
    captionNew: `${pct(risk('no2', MOCK.no2).mid)} (95% CI ${fmt(risk('no2', MOCK.no2).lo)}–${fmt(risk('no2', MOCK.no2).hi)}%). Overlaps the traffic mixture behind PM₂.₅; read on its own.`,
  }),
};

document.querySelectorAll('[data-render]').forEach((el) => {
  const fn = RENDERERS[el.dataset.render];
  if (fn) el.innerHTML = fn();
});

function numberFigures() {
  const count = { fig: 0, table: 0 };
  document.querySelectorAll('figure.chart, .outcome, table').forEach((el) => {
    const kind = el.tagName === 'TABLE' ? 'table' : 'fig';
    const title = kind === 'table' ? el.querySelector(':scope > caption') : el.querySelector(':scope > .chart__title, :scope > .outcome__label');
    if (!title) return;
    const n = ++count[kind];
    el.id = `${kind}-${n}`;
    title.insertAdjacentHTML('afterbegin', `<a class="fig-num" href="#${el.id}">${kind === 'table' ? 'Table' : 'Figure'} ${n}</a>`);
  });
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
}

numberFigures();
