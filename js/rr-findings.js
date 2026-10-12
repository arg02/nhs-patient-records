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

/**
 * Ozone µg/m³ by metric: [annual average, annual mean of daily max 8-hour, Apr–Sep peak season].
 * Exposure-service annual average = LAEI 2022 map value; station annual average = mean of all hours.
 */
const O3_SITES = [
  { section: '2022 · LAEI map year', label: 'Honor Oak Park', sub: 'background', exposure: [46.3, 61.2, 70.7], station: [51.6, 68.2, 81.3] },
  { section: '2022 · LAEI map year', label: 'Marylebone Road', sub: 'roadside', exposure: [34.4, 49.3, 58.8], station: [28.5, 40.3, 49.3] },
  { section: '2025 · latest full year, for comparison', label: 'Honor Oak Park', sub: 'background', exposure: [46.3, 66.5, 77.8], station: [56.6, 74.0, 85.0] },
  { section: '2025 · latest full year, for comparison', label: 'Marylebone Road', sub: 'roadside', exposure: [34.4, 54.6, 65.9], station: [34.3, 46.4, 53.5] },
];

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

/**
 * Horizontal bars, one block per group, one row per metric, one bar per series within a row.
 * groups: [{ section, label, sub, rows: [{ label, values: [..one per series] }] }]
 * A change of `section` starts a shaded heading band across the chart.
 */
function pairedHBars({ title, groups, series, max, ticks, ref, axisLabel, labelW = 250, barH = 9, rowGap = 9 }) {
  const padT = 22;
  const padR = 40;
  const secH = 30;
  const headH = 22;
  const blockGap = 10;
  const rowH = series.length * (barH + 2) + rowGap;
  const newSection = (g, gi) => g.section && g.section !== groups[gi - 1]?.section;
  const plotH = groups.reduce((a, g, gi) => a + (newSection(g, gi) ? secH : 0) + headH + g.rows.length * rowH + blockGap, 0);
  const h = padT + plotH + 34;
  const plotW = W - labelW - padR;
  const x = (v) => labelW + (Math.min(v, max) / max) * plotW;

  let s = svgOpen(h, title);
  ticks.forEach((tv) => {
    s += `<line x1="${x(tv)}" y1="${padT}" x2="${x(tv)}" y2="${padT + plotH}" class="c-grid"/>`;
    s += `<text x="${x(tv)}" y="${padT + plotH + 15}" text-anchor="middle" class="c-tick">${tv}</text>`;
  });
  s += `<text x="${labelW + plotW / 2}" y="${h - 4}" text-anchor="middle" class="c-axis">${axisLabel}</text>`;
  s += `<line x1="${x(ref.value)}" y1="${padT - 6}" x2="${x(ref.value)}" y2="${padT + plotH}" class="c-ref-line"/>`;
  s += `<text x="${x(ref.value)}" y="${padT - 10}" text-anchor="middle" class="c-ref-label">${ref.label}</text>`;

  let y = padT;
  groups.forEach((g, gi) => {
    if (newSection(g, gi)) {
      s += `<rect x="0" y="${y}" width="${W - padR + 8}" height="${secH - 6}" rx="4" class="c-section"/>`;
      s += `<text x="8" y="${y + 16}" class="c-section-label">${g.section}</text>`;
      y += secH;
    } else if (gi) {
      s += `<line x1="8" y1="${y - blockGap / 2}" x2="${W - padR}" y2="${y - blockGap / 2}" class="c-grid"/>`;
    }
    s += `<text x="8" y="${y + 14}" class="c-label">${g.label} <tspan class="c-sub">${g.sub}</tspan></text>`;
    y += headH;
    g.rows.forEach((r) => {
      const barsH = series.length * (barH + 2) - 2;
      s += `<text x="20" y="${y + barsH / 2 + 4}" class="c-sub">${r.label}</text>`;
      r.values.forEach((v, si) => {
        const by = y + si * (barH + 2);
        if (v == null) {
          s += `<text x="${labelW + 4}" y="${by + barH - 1}" class="c-bar-val">no data</text>`;
          return;
        }
        s += `<rect x="${labelW}" y="${by}" width="${x(v) - labelW}" height="${barH}" fill="${series[si].color}" rx="1.5"/>`;
        s += `<rect x="${x(v) + 2}" y="${by}" width="${fmt(v).length * 5.8 + 4}" height="${barH + 1}" fill="#fff"/>`;
        s += `<text x="${x(v) + 4}" y="${by + barH - 1}" class="c-bar-val">${fmt(v)}</text>`;
      });
      y += rowH;
    });
    y += blockGap;
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

function chartSlope() {
  const rows = PAGE_ORDER.map((sp) => {
    const v = pctAt(CRF[sp].rr, 1);
    return {
      label: LABEL[sp],
      sub: `RR ${fmt(CRF[sp].rr, 2)} per 10 µg/m³${sp === 'o3' ? ' · respiratory deaths' : ''}`,
      value: v,
      color: COLOR(sp),
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
    { name: 'Exposure service', color: '#0387E2' },
    { name: 'Station', color: '#0b3f73' },
  ];
  const metrics = ['Annual average', 'Annual mean of daily max 8-hour (HRAPIE-2)', 'Peak season, Apr–Sep (WHO)'];
  const groups = O3_SITES.map((g) => ({
    section: g.section,
    label: g.label,
    sub: g.sub,
    rows: metrics.map((label, i) => ({ label, values: [g.exposure[i], g.station[i]] })),
  }));
  return pairedHBars({
    title: 'Ozone: three metrics at two London sites',
    groups, series, max: 100, ticks: [0, 20, 40, 60, 80, 100],
    ref: { value: 60, label: 'WHO 60 (peak season)' },
    axisLabel: 'Ozone, µg/m³',
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

function pill(segments) {
  const total = segments.reduce((a, s) => a + s.h, 0);
  const segs = segments
    .filter((s) => s.h > 0.2)
    .map((s) => `<div class="mw-seg" style="height:${s.h.toFixed(1)}px;background-color:${s.color}"></div>`)
    .join('');
  return `<div class="mw-pill" style="height:${total.toFixed(1)}px">${segs}</div>`;
}

function whoTrack(segments) {
  return `<div class="mw-track"><div class="mw-who"></div>${pill(segments)}</div>`;
}

function whoSegments(sp, v) {
  const { below, above } = whoHeights(sp, v);
  return [{ h: below, color: LIGHT(sp) }, { h: above, color: COLOR(sp) }];
}

/** Risk scale: below the WHO line = concentration as a share of the guideline; above it = % higher risk. */
const RISK_WHO_PX = TRACK * 0.4;
const riskPx = (p) => RISK_WHO_PX + (Math.min(p, RISK_MAX) / RISK_MAX) * (TRACK - RISK_WHO_PX);

function riskTrack(sp, v) {
  const r = risk(sp, v);
  const below = Math.min(v / WHO_ANNUAL[sp], 1) * RISK_WHO_PX;
  const ci = v > WHO_ANNUAL[sp]
    ? `<div class="mw-ci" style="bottom:${riskPx(r.lo).toFixed(1)}px;height:${(riskPx(r.hi) - riskPx(r.lo)).toFixed(1)}px"></div>`
    : '';
  return `<div class="mw-track">
    ${[10, 20].map((p) => `<div class="mw-grid" style="bottom:${riskPx(p).toFixed(1)}px"></div>`).join('')}
    <div class="mw-who" style="bottom:${RISK_WHO_PX}px"></div>
    ${pill([{ h: below, color: LIGHT(sp) }, { h: riskPx(r.mid) - RISK_WHO_PX, color: COLOR(sp) }])}
    ${ci}
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
  return `<div class="mw-axis mw-axis--risk">
    <span class="mw-axis__who" style="bottom:${RISK_WHO_PX}px">WHO<br>guideline</span>
    ${[10, 20].map((p) => `<span class="mw-axis__tick" style="bottom:${riskPx(p).toFixed(1)}px">+${p}%</span>`).join('')}
  </div>`;
}

function riskColumn(sp, v, note = '') {
  const above = v > WHO_ANNUAL[sp];
  return column({
    top: above ? pct(risk(sp, v).mid) : 'Below WHO',
    topColor: above ? COLOR(sp) : '#6b7385',
    track: riskTrack(sp, v),
    value: ugm(v),
    name: LABEL[sp],
    note,
  });
}

function panel({ title, sub, body, foot = '' }) {
  return `<div class="mw-panel">
    <div class="mw-panel__title">${title}</div>
    <div class="mw-panel__sub">${sub}</div>
    ${body}
    ${foot}
  </div>`;
}

const RISK_FOOT = '<div class="mw-foot">PM₂.₅ and NO₂ = all-cause mortality. O₃ = respiratory deaths only.</div>';

const WIDGET_ORDER = ['pm25', 'pm10', 'no2', 'o3'];
const RISK_ORDER = ['pm25', 'no2', 'o3'];

function panelCurrent() {
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
  });
}

/** Peak-season ozone at Marylebone Road 2025 (MY1, roadside station): an example below WHO's 60 */
const MY1_2025_O3_PEAK = 53.5;

function panelRisk(values = MOCK) {
  const cols = RISK_ORDER.map((sp) => riskColumn(sp, values[sp], sp === 'o3' ? 'peak season' : '')).join('');
  return panel({
    title: 'Long-term',
    sub: 'Annual mean · 2022 · % higher risk than at the WHO guideline',
    body: `<div class="mw-cols">${riskAxis()}${cols}</div>`,
    foot: RISK_FOOT,
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
  const r = risk(sp, HP1_2025.exposurePeak);
  const rs = risk(sp, HP1_2025.stationPeak);
  const now = mini('Now',
    soloCols(whoAxis(), column({ top: ratio(sp, HP1_2025.map, 2), topColor: COLOR(sp), track: whoTrack(whoSegments(sp, HP1_2025.map)), value: ugm(HP1_2025.map), name: LABEL[sp], note: 'exposure-service annual average' })),
    'Exposure-service annual average against a peak-season guideline. Reads as under WHO.');
  const proposed = mini('Proposed',
    soloCols(riskAxis(), riskColumn(sp, HP1_2025.exposurePeak, 'peak season, exposure service')),
    `Peak-season value (Apr–Sep) against WHO’s 60. ${pct(r.mid)} higher respiratory mortality (95% CI ${fmt(r.lo)}–${fmt(r.hi)}%), HRAPIE-2 RR.`);
  const ref = mini('Reference',
    soloCols(riskAxis(), riskColumn(sp, HP1_2025.stationPeak, 'peak season, station')),
    `Station peak season at the same site, for comparison: ${pct(rs.mid)} respiratory.`);
  return `<div class="mini-row">${now}${proposed}${ref}</div>`;
}

function miniRiskPair(sp, { captionNow, captionNew }) {
  const v = MOCK[sp];
  const now = mini('Now',
    soloCols(whoAxis(), column({ top: ratio(sp, v), topColor: COLOR(sp), track: whoTrack(whoSegments(sp, v)), value: ugm(v), name: LABEL[sp] })),
    captionNow);
  const next = mini('Relative risk scale',
    soloCols(riskAxis(), riskColumn(sp, v)),
    captionNew);
  return `<div class="mini-row mini-row--two">${now}${next}</div>`;
}

/* ------------------------------------------------------------------ */

const RENDERERS = {
  'chart-slope': chartSlope,
  'chart-o3-sites': chartOzoneSites,
  'chart-o3-forest': chartOzoneForest,
  'chart-o3-cohorts': chartOzoneCohorts,
  'chart-pm25-curve': chartPm25Curve,
  'chart-pm10-split': chartPm10Split,
  'chart-pm10-forest': chartPm10Forest,
  'chart-no2-options': chartNo2Options,
  'panel-current': panelCurrent,
  'panel-risk': () => panelRisk(),
  'panel-risk-below': () => panelRisk({ ...MOCK, o3: MY1_2025_O3_PEAK }),
  'mini-o3': miniOzone,
  'mini-pm25': () => miniRiskPair('pm25', {
    captionNow: '3.6× looks like the biggest bar, but the size of the ratio does not carry the risk.',
    captionNew: `${pct(risk('pm25', MOCK.pm25).mid)} (95% CI ${fmt(risk('pm25', MOCK.pm25).lo)}–${fmt(risk('pm25', MOCK.pm25).hi)}%). Lead long-term figure.`,
  }),
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
