import {
  POLLUTANTS,
  DAQI_COLORS,
  POLLUTANT_WHO_STYLES,
  WHO_ANNUAL,
  daqiLevel,
  daqiColor,
  whoAnnualComparison,
  forecastBandToDaqi,
  formatDateChip,
  sortedRecentDays,
} from './air-quality.js';

const LADDER_HEIGHT = 80;
const VERT_TRACK_PX = 72;

const DAQI_KEY = [
  { label: 'Low', colors: ['#A3CC7A', '#66A33E', '#2B8200'] },
  { label: 'Moderate', colors: ['#EEBF8F', '#FE994D', '#F46200'] },
  { label: 'High', colors: ['#D80000', '#A30000', '#7A0000'] },
  { label: 'V.High', colors: ['#000000'] },
];

function whoScaleMax(who, annual) {
  if (annual > who) return annual;
  return who * 1.15;
}

export function daqiLegendHtml() {
  const bands = DAQI_KEY.map((band) => `
    <div class="daqi-legend-band">
      <div class="daqi-legend-dots">
        ${band.colors.map((c) => `<span class="daqi-legend-dot" style="background:${c}"></span>`).join('')}
      </div>
      <span class="daqi-legend-label">${band.label}</span>
    </div>
  `).join('');
  return `<div class="daqi-legend">${bands}</div>`;
}

export function daqiIndexBlob(level, { large = false } = {}) {
  if (level == null) return `<div class="daqi-blob empty${large ? ' daqi-blob--lg' : ''}"></div>`;
  const w = Math.max(large ? 28 : 22, (level / 10) * (large ? 72 : 56));
  return `<div class="daqi-blob${large ? ' daqi-blob--lg' : ''}" style="width:${w}px;background:${daqiColor(level)}" title="DAQI ${level}"></div>`;
}

export function daqiStackedBar(level, { height = LADDER_HEIGHT, width = 28 } = {}) {
  const segments = DAQI_COLORS.map((c, i) => {
    const idx = i + 1;
    const on = level != null && idx <= level;
    return `<div class="daqi-seg" style="background:${on ? c : '#eceef2'}${on ? '' : ';opacity:0.45'}"></div>`;
  }).join('');
  return `<div class="daqi-stack" style="height:${height}px;width:${width}px" title="DAQI ${level ?? '—'}">${segments}</div>`;
}

function pollutantLabel(species) {
  return POLLUTANTS.find((p) => p.key === species)?.label ?? species;
}

function pollutantStyles(species) {
  return POLLUTANT_WHO_STYLES[species] ?? { above: '#6a7385', below: '#eceef2' };
}

/** Vertical pill — AirBase colours: light below WHO, solid above WHO */
function whoVerticalPill(species, annualValue, trackPx = VERT_TRACK_PX) {
  const who = WHO_ANNUAL[species];
  const { above, below } = pollutantStyles(species);
  const scaleMax = whoScaleMax(who, annualValue);
  const totalH = (annualValue / scaleMax) * trackPx;
  const whoH = (who / scaleMax) * trackPx;
  const belowH = Math.min(totalH, whoH);
  const aboveH = Math.max(0, totalH - whoH);

  return `
    <div class="who-vert-cell">
      <div class="who-vert-row">
        <div class="who-guideline-col" style="height:${trackPx}px">
          <span class="who-guideline-tag" style="bottom:${whoH}px">${who}µg/m³</span>
        </div>
        <div class="who-vert-track-col">
          <span class="who-annual-val">${annualValue.toFixed(1)}</span>
          <div class="who-vert-track" style="height:${trackPx}px">
            <div class="who-line-h" style="bottom:${whoH}px"></div>
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

function whoMeta(species, annualValue) {
  const cmp = whoAnnualComparison(annualValue, species);
  return `
    <div class="who-bar-meta">
      <span class="who-bar-name">${pollutantLabel(species)}</span>
      <span class="who-bar-ratio">${cmp?.label ?? '—'}</span>
    </div>
  `;
}

export function whoAnnualSingleLarge(species, annualValue) {
  const cmp = whoAnnualComparison(annualValue, species);
  return `
    <div class="who-single-row">
      ${whoVerticalPill(species, annualValue, 88)}
      <div class="who-ratio-big">${cmp?.label ?? '—'}</div>
    </div>
  `;
}

export function whoAnnualChart(annual) {
  const bars = POLLUTANTS.map((p) => `
    <div class="who-bar-group">
      ${whoVerticalPill(p.key, annual[p.key])}
      ${whoMeta(p.key, annual[p.key])}
    </div>
  `).join('');
  return `<div class="who-chart">${bars}</div>`;
}

/** Shared WHO line height; above-WHO segment scales with (annual−WHO)/WHO across pollutants */
const WHO_LINE_RATIO = 0.52;

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

export function whoAnnualChart2x2(annual) {
  const grid = [
    ['no2', 'pm25'],
    ['pm10', 'o3'],
  ];
  const rows = grid.map((row) => `
    <div class="who-grid-row">
      ${row.map((key) => `
        <div class="who-grid-cell">
          ${whoVerticalPill(key, annual[key], 64)}
          ${whoMeta(key, annual[key])}
        </div>
      `).join('')}
    </div>
  `).join('');
  return `<div class="who-grid">${rows}</div>`;
}

function dayStackHtml(items, { ladders = false, dividerBeforeToday = false } = {}) {
  const ladderClass = ladders ? ' day-stack--ladders' : '';
  const showDivider = dividerBeforeToday && items.length >= 2;
  const slot = (content, row) => `<div class="day-slot day-slot--${row}">${content || ''}</div>`;

  if (showDivider) {
    const past = items.slice(0, -1);
    const today = items[items.length - 1];

    const splitRow = (pick, rowSuffix) => `
      <div class="day-${rowSuffix}-row day-row--split-today">
        <div class="day-past-group">
          ${past.map((i) => slot(pick(i), rowSuffix)).join('')}
        </div>
        <div class="day-today-separator" aria-hidden="true"></div>
        ${slot(pick(today), rowSuffix)}
      </div>
    `;

    return `
      <div class="day-stack${ladderClass} day-stack--with-divider">
        <div class="day-col-divider" aria-hidden="true"></div>
        ${splitRow((i) => i.visual, 'visual')}
        ${splitRow((i) => i.name, 'name')}
        ${splitRow((i) => i.date, 'date')}
      </div>
    `;
  }

  return `
    <div class="day-stack${ladderClass}">
      <div class="day-visual-row">
        ${items.map((i) => slot(i.visual, 'visual')).join('')}
      </div>
      <div class="day-name-row">
        ${items.map((i) => slot(i.name, 'name')).join('')}
      </div>
      <div class="day-date-row">
        ${items.map((i) => slot(i.date, 'date')).join('')}
      </div>
    </div>
  `;
}

function dayItemFromRecent(d, species, visualFn) {
  return {
    visual: visualFn(d),
    name: d.offset === 0 ? 'Today' : `−${d.offset}d`,
    date: formatDateChip(d.date),
  };
}

export function recentCardHtml(recentDays, species, { visual = 'blobs', ladderSize, legendOutside = false } = {}) {
  const days = sortedRecentDays(recentDays);
  let items;

  if (visual === 'dots') {
    items = days.map((d) => dayItemFromRecent(d, species, (day) => {
      const level = daqiLevel(day.daily[species], species);
      return `<div class="daqi-dot daqi-dot--lg" style="background:${daqiColor(level)}"></div>`;
    }));
  } else if (visual === 'ladders') {
    const h = ladderSize?.height ?? LADDER_HEIGHT;
    const w = ladderSize?.width ?? 28;
    items = days.map((d) => dayItemFromRecent(d, species, (day) => {
      const level = daqiLevel(day.daily[species], species);
      return daqiStackedBar(level, { height: h, width: w });
    }));
  } else {
    items = days.map((d) => dayItemFromRecent(d, species, (day) => {
      const level = daqiLevel(day.daily[species], species);
      return daqiIndexBlob(level, { large: true });
    }));
  }

  const legend = legendOutside
    ? ''
    : `<div class="daqi-legend-wrap">${daqiLegendHtml()}</div>`;

  return `
    <div class="zone-label">Recent</div>
    <div class="zone-main zone-main--days">
      <div class="day-panel">
        ${dayStackHtml(items, { ladders: visual === 'ladders', dividerBeforeToday: true })}
      </div>
    </div>
    ${legend}
  `;
}

export function forecastCardHtml(forecast, species, { type = 'blob', ladderSize, balanceLegend = false } = {}) {
  const level = forecastBandToDaqi(forecast.band);
  const lh = ladderSize?.height ?? LADDER_HEIGHT;
  const lw = ladderSize?.width ?? 28;

  let visual;
  if (type === 'ladder') visual = daqiStackedBar(level, { height: lh, width: lw });
  else if (type === 'dot') visual = `<div class="daqi-dot daqi-dot--xl" style="background:${daqiColor(level)}"></div>`;
  else visual = daqiIndexBlob(level, { large: true });

  const items = [{ visual, name: forecast.band, date: formatDateChip(forecast.date) }];

  const legendBalance = balanceLegend
    ? '<div class="daqi-legend-spacer" aria-hidden="true"></div>'
    : '';

  return `
    <div class="zone-label">Forecast</div>
    <div class="zone-main zone-main--days">
      <div class="day-panel">
        ${dayStackHtml(items, { ladders: type === 'ladder' })}
        ${legendBalance}
      </div>
    </div>
  `;
}
