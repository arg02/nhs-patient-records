import {
  POLLUTANTS,
  POLLUTANT_WHO_STYLES,
  WHO_ANNUAL,
  whoAnnualComparison,
} from './air-quality.js';

const VERT_TRACK_PX = 72;
const WHO_LINE_RATIO = 0.52;

function pollutantLabel(species) {
  return POLLUTANTS.find((p) => p.key === species)?.label ?? species;
}

function pollutantStyles(species) {
  return POLLUTANT_WHO_STYLES[species] ?? { above: '#6a7385', below: '#eceef2' };
}

function whoMeta(species, annualValue) {
  const cmp = whoAnnualComparison(annualValue, species);
  return `
    <div class="who-bar-meta">
      <span class="who-bar-name">${pollutantLabel(species)}</span>
      <span class="who-bar-ratio">${cmp?.label ?? '—'}</span>
    </div>
  `;
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

function whoVerticalPillAligned(species, annualValue, layout) {
  const who = WHO_ANNUAL[species];
  const { above, below } = pollutantStyles(species);
  const { trackPx, whoLinePx, excessZonePx, maxExcess } = layout;
  const excess = whoExcessRatio(annualValue, who);
  const belowH = annualValue >= who ? whoLinePx : (annualValue / who) * whoLinePx;
  const aboveH = excess > 0 ? (excess / maxExcess) * excessZonePx : 0;
  const totalH = belowH + aboveH;

  return `
    <div class="who-vert-cell">
      <div class="who-vert-row">
        <div class="who-guideline-col" style="height:${trackPx}px">
          <span class="who-guideline-tag" style="bottom:${whoLinePx}px">${who}µg/m³</span>
        </div>
        <div class="who-vert-track-col">
          <span class="who-annual-val">${annualValue.toFixed(1)}</span>
          <div class="who-vert-track" style="height:${trackPx}px">
            <div class="who-line-h who-line-h--dotted" style="bottom:${whoLinePx}px"></div>
            <div class="who-vert-pill" style="height:${totalH}px">
              ${aboveH > 0 ? `<div class="who-vert-above" style="height:${aboveH}px;background:${above}"></div>` : ''}
              ${belowH > 0 ? `<div class="who-vert-below" style="height:${belowH}px;background:${below}"></div>` : ''}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/** 3.1 — shared WHO dotted line; above-WHO height proportional to × WHO */
export function whoAnnualChartAligned(annual, trackPx = VERT_TRACK_PX) {
  const layout = whoAlignedLayout(annual, trackPx);
  const bars = POLLUTANTS.map((p) => `
    <div class="who-bar-group">
      ${whoVerticalPillAligned(p.key, annual[p.key], layout)}
      ${whoMeta(p.key, annual[p.key])}
    </div>
  `).join('');
  return `<div class="who-chart who-chart--aligned">${bars}</div>`;
}
