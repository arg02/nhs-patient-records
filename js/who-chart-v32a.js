import {
  POLLUTANTS,
  POLLUTANT_WHO_STYLES,
  WHO_ANNUAL,
  whoAnnualComparison,
} from './air-quality.js?v=7';

const VERT_TRACK_PX = 72;
const WHO_LINE_RATIO = 0.52;

function whoRatioShort(annualMean, species) {
  const cmp = whoAnnualComparison(annualMean, species);
  if (!cmp) return '—';
  if (cmp.above) return `${cmp.ratio.toFixed(1)}×`;
  if (cmp.ratio >= 0.99 && cmp.ratio <= 1.01) return 'At guideline';
  return `${cmp.ratio.toFixed(1)}×`;
}

function pollutantStyles(species) {
  return POLLUTANT_WHO_STYLES[species] ?? { above: '#6a7385', below: '#eceef2' };
}

function whoExcessRatio(annual, who) {
  return annual > who ? (annual - who) / who : 0;
}

function maxWhoExcessRatio(annual) {
  return Math.max(
    ...POLLUTANTS.map((p) => whoExcessRatio(annual[p.key], WHO_ANNUAL[p.key])),
    0.001,
  );
}

function whoAlignedLayout(annual, trackPx = VERT_TRACK_PX) {
  const whoLinePx = trackPx * WHO_LINE_RATIO;
  return {
    trackPx,
    whoLinePx,
    excessZonePx: trackPx - whoLinePx,
    maxExcess: maxWhoExcessRatio(annual),
  };
}

function renderPlainPill(belowH, aboveH, belowColor, aboveColor) {
  const totalH = belowH + aboveH;
  return {
    totalH,
    html: `
      <div class="who-vert-pill" style="height:${totalH}px">
        ${aboveH > 0 ? `<div class="who-vert-above" style="height:${aboveH}px;background:${aboveColor}"></div>` : ''}
        ${belowH > 0 ? `<div class="who-vert-below" style="height:${belowH}px;background:${belowColor}"></div>` : ''}
      </div>
    `,
  };
}

/** 3.2a — coloured ratio above bar; WHO µg/m³ on bar; names in key strip below panel */
function whoVerticalPillV32A(species, annualValue, layout, showWhoLabel = false) {
  const who = WHO_ANNUAL[species];
  const { above, below } = pollutantStyles(species);
  const { trackPx, whoLinePx, excessZonePx, maxExcess } = layout;
  const excess = whoExcessRatio(annualValue, who);
  const belowH = annualValue >= who ? whoLinePx : (annualValue / who) * whoLinePx;
  const aboveH = excess > 0 ? (excess / maxExcess) * excessZonePx : 0;
  const { html: pillHtml } = renderPlainPill(belowH, aboveH, below, above);

  return `
    <div class="who-vert-cell">
      <div class="who-vert-labels">
        <span class="who-ratio-tag who-ratio-tag--coloured" style="color:${above}">${whoRatioShort(annualValue, species)}</span>
      </div>
      <div class="who-vert-row">
        ${showWhoLabel ? `<div class="who-side who-side--left" style="height:${trackPx}px">
          <span class="who-guideline-tag who-guideline-tag--multiline" style="bottom:${whoLinePx}px">WHO<br>guideline</span>
        </div>` : ''}
        <div class="who-vert-track who-vert-track--onbar-labels" style="height:${trackPx}px">
          <div class="who-line-h who-line-h--dotted" style="bottom:${whoLinePx}px"></div>
          ${pillHtml}
          <span class="who-onbar-val" style="bottom:${whoLinePx}px">${who}µg/m³</span>
        </div>
      </div>
      <div class="who-vert-labels who-vert-labels--under">
        <div class="who-val-header">
          <span class="who-annual-val">${Math.round(annualValue)}</span>
          <span class="who-annual-unit">µg/m³</span>
        </div>
      </div>
    </div>
  `;
}

export function whoAnnualChartV32A(annual, trackPx = VERT_TRACK_PX) {
  const layout = whoAlignedLayout(annual, trackPx);
  const bars = POLLUTANTS.map((p, i) => `
    <div class="who-bar-group">
      ${whoVerticalPillV32A(p.key, annual[p.key], layout, i === 0)}
    </div>
  `).join('');
  return `<div class="who-chart who-chart--aligned who-chart--v32 who-chart--v32a who-chart--bar-grid">${bars}</div>`;
}

/** 3.2b — coloured ratio; WHO µg/m³ in grey to the right of each bar (like 3.2) */
function whoVerticalPillV32B(species, annualValue, layout, showWhoLabel = false) {
  const who = WHO_ANNUAL[species];
  const { above, below } = pollutantStyles(species);
  const { trackPx, whoLinePx, excessZonePx, maxExcess } = layout;
  const excess = whoExcessRatio(annualValue, who);
  const belowH = annualValue >= who ? whoLinePx : (annualValue / who) * whoLinePx;
  const aboveH = excess > 0 ? (excess / maxExcess) * excessZonePx : 0;
  const { html: pillHtml } = renderPlainPill(belowH, aboveH, below, above);

  return `
    <div class="who-vert-cell">
      <div class="who-vert-labels">
        <span class="who-ratio-tag who-ratio-tag--coloured" style="color:${above}">${whoRatioShort(annualValue, species)}</span>
      </div>
      <div class="who-vert-row">
        ${showWhoLabel ? `<div class="who-side who-side--left" style="height:${trackPx}px">
          <span class="who-guideline-tag who-guideline-tag--multiline" style="bottom:${whoLinePx}px">WHO<br>guideline</span>
        </div>` : ''}
        <div class="who-vert-track" style="height:${trackPx}px">
          <div class="who-line-h who-line-h--dotted" style="bottom:${whoLinePx}px"></div>
          ${pillHtml}
        </div>
        <div class="who-side who-side--right" style="height:${trackPx}px">
          <span class="who-guideline-val" style="bottom:${whoLinePx}px">${who}µg/m³</span>
        </div>
      </div>
      <div class="who-vert-labels who-vert-labels--under">
        <div class="who-val-header">
          <span class="who-annual-val">${Math.round(annualValue)}</span>
          <span class="who-annual-unit">µg/m³</span>
        </div>
      </div>
    </div>
  `;
}

export function whoAnnualChartV32B(annual, trackPx = VERT_TRACK_PX) {
  const layout = whoAlignedLayout(annual, trackPx);
  const bars = POLLUTANTS.map((p, i) => `
    <div class="who-bar-group">
      ${whoVerticalPillV32B(p.key, annual[p.key], layout, i === 0)}
    </div>
  `).join('');
  return `<div class="who-chart who-chart--aligned who-chart--v32 who-chart--v32b who-chart--bar-grid">${bars}</div>`;
}

function pollutantLabel(species) {
  return POLLUTANTS.find((p) => p.key === species)?.label ?? species;
}

/** 3.2c — coloured ratio, side WHO values, pollutant names under bars (inside panel) */
function whoVerticalPillV32C(species, annualValue, layout, showWhoLabel = false) {
  const who = WHO_ANNUAL[species];
  const { above, below } = pollutantStyles(species);
  const { trackPx, whoLinePx, excessZonePx, maxExcess } = layout;
  const excess = whoExcessRatio(annualValue, who);
  const belowH = annualValue >= who ? whoLinePx : (annualValue / who) * whoLinePx;
  const aboveH = excess > 0 ? (excess / maxExcess) * excessZonePx : 0;
  const { html: pillHtml } = renderPlainPill(belowH, aboveH, below, above);

  return `
    <div class="who-vert-cell">
      <div class="who-vert-labels">
        <span class="who-ratio-tag who-ratio-tag--coloured" style="color:${above}">${whoRatioShort(annualValue, species)}</span>
      </div>
      <div class="who-vert-row">
        ${showWhoLabel ? `<div class="who-side who-side--left" style="height:${trackPx}px">
          <span class="who-guideline-tag who-guideline-tag--multiline" style="bottom:${whoLinePx}px">WHO<br>guideline</span>
        </div>` : ''}
        <div class="who-vert-track" style="height:${trackPx}px">
          <div class="who-line-h who-line-h--dotted" style="bottom:${whoLinePx}px"></div>
          ${pillHtml}
        </div>
        <div class="who-side who-side--right" style="height:${trackPx}px">
          <span class="who-guideline-val" style="bottom:${whoLinePx}px">${who}µg/m³</span>
        </div>
      </div>
      <div class="who-vert-labels who-vert-labels--under">
        <div class="who-val-header">
          <span class="who-annual-val">${Math.round(annualValue)}</span>
          <span class="who-annual-unit">µg/m³</span>
        </div>
      </div>
      <span class="who-bar-name who-bar-name--under">${pollutantLabel(species)}</span>
    </div>
  `;
}

export function whoAnnualChartV32C(annual, trackPx = VERT_TRACK_PX) {
  const layout = whoAlignedLayout(annual, trackPx);
  const bars = POLLUTANTS.map((p, i) => `
    <div class="who-bar-group">
      ${whoVerticalPillV32C(p.key, annual[p.key], layout, i === 0)}
    </div>
  `).join('');
  return `<div class="who-chart who-chart--aligned who-chart--v32 who-chart--v32c">${bars}</div>`;
}

function annualKeyLabelHtml(p, { labelStyle = 'descriptive' } = {}) {
  if (labelStyle === 'chemical') {
    return `<span class="pollutant-key-label">${p.label}</span>`;
  }
  const lines = p.annualKeyLines ?? [p.label];
  if (lines.length === 1) {
    return `<span class="pollutant-key-label">${lines[0]}</span>`;
  }
  return `<span class="pollutant-key-label pollutant-key-label--stacked">${lines.map((line) => `<span>${line}</span>`).join('')}</span>`;
}

/** Pollutant key below bars — dots aligned to bar columns, DAQI-style strip */
export function pollutantKeyStripAlignedHtml({ labelStyle = 'descriptive' } = {}) {
  const cols = POLLUTANTS.map((p) => {
    const { above } = pollutantStyles(p.key);
    return `
      <div class="pollutant-key-col">
        <span class="daqi-legend-dot" style="background:${above}"></span>
        ${annualKeyLabelHtml(p, { labelStyle })}
      </div>
    `;
  }).join('');
  return `<div class="pollutant-key pollutant-key--bar-grid" role="list" aria-label="Pollutant key">${cols}</div>`;
}

/** @deprecated use pollutantKeyStripAlignedHtml */
export function pollutantKeyStripHtml() {
  return pollutantKeyStripAlignedHtml();
}

/** @deprecated use pollutantKeyStripAlignedHtml */
export function pollutantKeyStripDaqiHtml() {
  return pollutantKeyStripAlignedHtml();
}
