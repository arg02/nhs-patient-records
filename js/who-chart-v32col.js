import {
  POLLUTANTS,
  POLLUTANT_WHO_STYLES,
  WHO_ANNUAL,
  whoAnnualComparison,
} from './air-quality.js?v=6';

const VERT_TRACK_PX = 72;
const WHO_LINE_RATIO = 0.52;

function pollutantLabel(species) {
  return POLLUTANTS.find((p) => p.key === species)?.label ?? species;
}

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

/** 3.2 coloured — ratio above bar in pollutant colour; concentration below */
function whoVerticalPillV32Col(species, annualValue, layout, showWhoLabel = false) {
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
          <span class="who-guideline-tag" style="bottom:${whoLinePx}px">WHO</span>
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

export function whoAnnualChartV32Col(annual, trackPx = VERT_TRACK_PX) {
  const layout = whoAlignedLayout(annual, trackPx);
  const bars = POLLUTANTS.map((p, i) => `
    <div class="who-bar-group">
      ${whoVerticalPillV32Col(p.key, annual[p.key], layout, i === 0)}
    </div>
  `).join('');
  return `<div class="who-chart who-chart--aligned who-chart--v32 who-chart--v32col">${bars}</div>`;
}
