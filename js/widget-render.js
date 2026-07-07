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
} from './air-quality.js?v=5';

const LADDER_HEIGHT = 80;
const VERT_TRACK_PX = 72;

const DAQI_KEY = [
  { label: 'Low', colors: ['#A3CC7A', '#66A33E', '#2B8200'] },
  { label: 'Moderate', colors: ['#EEBF8F', '#FE994D', '#F46200'] },
  { label: 'High', colors: ['#D80000', '#A30000', '#7A0000'] },
  { label: 'V.High', colors: ['#000000'] },
];

/** Match .daqi-stack in aq-widget.css — gap between DAQI index segments */
const DAQI_LADDER_GAP = 3;
const DAQI_LADDER_SEGMENTS = 10;

/** Pixel geometry for a DAQI ladder — lines sit between segments 3|4, 6|7, 9|10 */
export function daqiLadderGeometry(height, { gap = DAQI_LADDER_GAP, segments = DAQI_LADDER_SEGMENTS } = {}) {
  const segH = (height - (segments - 1) * gap) / segments;
  const step = segH + gap;
  const boundaryPx = (afterSeg) => afterSeg * step;
  const toPct = (px) => (px / height) * 100;
  const line34 = boundaryPx(3);
  const line67 = boundaryPx(6);
  const line910 = boundaryPx(9);
  const lowTop = 3 * segH + 2 * gap;
  return {
    line34Pct: toPct(line34),
    line67Pct: toPct(line67),
    line910Pct: toPct(line910),
    lowCenterPct: toPct(lowTop / 2),
  };
}

/** CSS custom properties for band-axis lines + labels (shared values) */
export function daqiLadderBandStyle(height, opts) {
  const g = daqiLadderGeometry(height, opts);
  return `--ladder-h:${height}px;--line-34:${g.line34Pct}%;--line-67:${g.line67Pct}%;--line-910:${g.line910Pct}%;--low-center:${g.lowCenterPct}%`;
}

export function bandAxisLabelsHtml() {
  return `
    <span class="recent-band-label recent-band-label--on-line recent-band-label--vhigh" style="color:${DAQI_COLORS[9]}">V.High</span>
    <span class="recent-band-label recent-band-label--on-line recent-band-label--high" style="color:${DAQI_COLORS[8]}">High</span>
    <span class="recent-band-label recent-band-label--on-line recent-band-label--moderate" style="color:${DAQI_COLORS[5]}">Moderate</span>
    <span class="recent-band-label recent-band-label--on-line recent-band-label--low" style="color:${DAQI_COLORS[2]}">Low</span>
  `;
}

export function bandAxisLinesHtml() {
  return `
    <div class="recent-band-line recent-band-line--low"></div>
    <div class="recent-band-line recent-band-line--moderate"></div>
    <div class="recent-band-line recent-band-line--high"></div>
    <div class="recent-band-line recent-band-line--vhigh"></div>
  `;
}

function laddersSplitHeaderHtml({ pastLabel = 'Recent', todayLabel = 'Today' } = {}) {
  return `
    <div class="zone-label-split">
      <div class="ladders-header-split">
        <div class="ladders-header-past"><div class="zone-label">${pastLabel}</div></div>
        <div class="ladders-header-today-sep" aria-hidden="true"></div>
        <div class="ladders-header-today"><div class="zone-label">${todayLabel}</div></div>
      </div>
    </div>
  `;
}

function laddersTripleHeaderHtml() {
  return `
    <div class="zone-label-split">
      <div class="ladders-header-split ladders-header-split--triple">
        <div class="ladders-header-past"><div class="zone-label">Recent</div></div>
        <div class="ladders-header-today-sep" aria-hidden="true"></div>
        <div class="ladders-header-today"><div class="zone-label">Today</div></div>
        <div class="ladders-header-forecast-sep" aria-hidden="true"></div>
        <div class="ladders-header-forecast"><div class="zone-label">Forecast</div></div>
      </div>
    </div>
  `;
}

/**
 * Position 3.2c band-axis labels and dotted lines from rendered .daqi-stack segments
 * (guarantees alignment with actual bar geometry, not CSS percentage estimates).
 */
export function syncV32cLaddersBandLayer(strip) {
  const span = strip?.querySelector('[data-ladders-span]');
  const layer = span?.querySelector('.ladders-band-layer');
  const ladderCard = span?.querySelector('.zone-recent, .zone-combined');
  const bar = ladderCard?.querySelector('.daqi-stack');
  if (!span || !layer || !ladderCard || !bar) return;

  const segs = [...bar.querySelectorAll('.daqi-seg')];
  if (segs.length !== 10) return;

  const LINE_OVERHANG = 8; /* matches --band-line-overhang */
  const spanRect = span.getBoundingClientRect();
  const recentRect = ladderCard.getBoundingClientRect();
  const barRect = bar.getBoundingClientRect();
  const allStacks = [...span.querySelectorAll('.daqi-stack')];
  const firstBar = allStacks[0] ?? bar;
  const lastBar = allStacks[allStacks.length - 1] ?? bar;
  const firstBarRect = firstBar.getBoundingClientRect();
  const lastBarRect = lastBar.getBoundingClientRect();

  const labelGap = firstBarRect.left - recentRect.left;
  const axisEl = layer.querySelector('.ladders-band-axis');
  if (axisEl) axisEl.style.width = `${labelGap}px`;

  layer.style.top = `${barRect.top - spanRect.top}px`;
  layer.style.height = `${barRect.height}px`;
  layer.style.left = '0';
  layer.style.right = '0';
  layer.style.width = '';

  const layerRect = layer.getBoundingClientRect();
  const relY = (y) => y - layerRect.top;

  const zoneSelectors = ['.zone-recent', '.zone-today', '.zone-forecast', '.zone-combined'];
  const segments = zoneSelectors
    .map((sel) => {
      const zone = span.querySelector(sel);
      if (!zone) return null;
      const stacks = [...zone.querySelectorAll('.daqi-stack')];
      if (!stacks.length) return null;
      const firstRect = stacks[0].getBoundingClientRect();
      const lastRect = stacks[stacks.length - 1].getBoundingClientRect();
      return {
        left: firstRect.left - LINE_OVERHANG,
        right: lastRect.right + LINE_OVERHANG,
      };
    })
    .filter(Boolean);

  const linesEl = layer.querySelector('.ladders-band-lines');
  if (linesEl) {
    linesEl.style.position = 'absolute';
    linesEl.style.top = '0';
    linesEl.style.height = '100%';
    linesEl.style.marginLeft = '0';
    linesEl.style.flex = 'none';
    linesEl.style.left = '0';
    linesEl.style.right = 'auto';
    linesEl.style.width = `${layerRect.width}px`;
    linesEl.style.clipPath = '';
    linesEl.style.webkitClipPath = '';
    linesEl.innerHTML = segments.length
      ? segments.map((seg) => {
        const left = Math.round(seg.left - layerRect.left);
        const width = Math.round(seg.right - seg.left);
        return `<div class="ladders-band-lines-segment" style="position:absolute;top:0;height:100%;left:${left}px;width:${width}px">${bandAxisLinesHtml()}</div>`;
      }).join('')
      : bandAxisLinesHtml();
  }

  const lineMap = [
    ['recent-band-line--low', 2],
    ['recent-band-line--moderate', 5],
    ['recent-band-line--high', 8],
    ['recent-band-line--vhigh', 9],
  ];
  lineMap.forEach(([cls, segIdx]) => {
    const y = segs[segIdx].getBoundingClientRect().top;
    layer.querySelectorAll(`.${cls}`).forEach((el) => {
      el.classList.add('recent-band-line--synced');
      el.style.bottom = '';
      el.style.top = `${relY(y)}px`;
      el.style.left = '0';
      el.style.right = 'auto';
      el.style.width = '100%';
    });
  });

  const labelOnLine = [
    ['low', 2],
    ['moderate', 5],
    ['high', 8],
    ['vhigh', 9],
  ];
  labelOnLine.forEach(([name, segIdx]) => {
    const el = layer.querySelector(`.recent-band-label--${name}`);
    if (!el) return;
    const y = segs[segIdx].getBoundingClientRect().top;
    el.classList.add('recent-band-label--synced');
    el.style.bottom = '';
    el.style.top = `${relY(y)}px`;
  });
}

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
    // Cumulative fill: segments 1..level ON, level+1..10 grey (DOM order; column-reverse flips display)
    const on = level != null && idx <= level;
    return `<div class="daqi-seg" style="background:${on ? c : '#eceef2'}${on ? '' : ';opacity:0.45'}"></div>`;
  }).join('');
  return `<div class="daqi-stack" style="height:${height}px;width:${width}px" title="DAQI ${level ?? '—'}">${segments}</div>`;
}

const DAQI_CIRCLE_BANDS = [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10]];

/** Natural pixel height for a banded circle stack (dot + gap sizes match aq-widget.css). */
export function circleStackHeight(bandSizes, { dot = 8, dotGap = 3, bandGap = 8 } = {}) {
  return bandSizes.reduce((h, n, i) => {
    const bandH = n * dot + Math.max(0, n - 1) * dotGap;
    return h + bandH + (i < bandSizes.length - 1 ? bandGap : 0);
  }, 0);
}

/** Vertical circle stack — 4 DAQI bands with gaps, legend-dot styling */
export function daqiCircleStack(level) {
  const bands = DAQI_CIRCLE_BANDS.map((levels) => {
    const dots = [...levels].reverse().map((idx) => {
      const on = level != null && idx <= level; // all circles at/below max level filled
      const c = DAQI_COLORS[idx - 1];
      return `<span class="daqi-circle-dot${on ? ' daqi-circle-dot--on' : ''}" data-level="${idx}" style="background:${on ? c : '#eceef2'}"></span>`;
    }).join('');
    return `<div class="daqi-circle-band">${dots}</div>`;
  }).join('');
  return `<div class="daqi-circle-stack" title="DAQI ${level ?? '—'}">${bands}</div>`;
}

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

/** Vertical pill — pollutant colours: light below WHO, solid above WHO */
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
      ${whoValueHeader(annualValue, species)}
      <div class="who-vert-row">
        <div class="who-guideline-col" style="height:${trackPx}px">
          <span class="who-guideline-tag" style="bottom:${whoH}px">${who}µg/m³</span>
        </div>
        <div class="who-vert-track" style="height:${trackPx}px">
          <div class="who-line-h" style="bottom:${whoH}px"></div>
          <div class="who-vert-pill" style="height:${totalH}px">
            ${aboveH > 0 ? `<div class="who-vert-above" style="height:${aboveH}px;background:${above}"></div>` : ''}
            ${belowH > 0 ? `<div class="who-vert-below" style="height:${belowH}px;background:${below}"></div>` : ''}
          </div>
        </div>
      </div>
      <span class="who-ratio-tag">${whoRatioShort(annualValue, species)}</span>
      <span class="who-bar-name who-bar-name--under">${pollutantLabel(species)}</span>
    </div>
  `;
}

function whoValueHeader(annualValue) {
  return `
    <div class="who-vert-labels">
      <div class="who-val-header">
        <span class="who-annual-val">${Math.round(annualValue)}</span>
        <span class="who-annual-unit">µg/m³</span>
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
    </div>
  `).join('');
  return `<div class="who-chart">${bars}</div>`;
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

function dayStackBandAxisHtml(items, { dividerBeforeToday = false, spanBand = false, todayLabelAbove = false, todayHeaderSplit = false } = {}) {
  const slot = (content, row) => `<div class="day-slot day-slot--${row}">${content || ''}</div>`;
  const linesHtml = bandAxisLinesHtml();
  const splitRow = (pick, rowSuffix, { todayOnly = false, pastOnly = false } = {}) => {
    if (dividerBeforeToday && items.length >= 2) {
      const past = items.slice(0, -1);
      const today = items[items.length - 1];
      const pastSlots = todayOnly
        ? past.map(() => slot('', rowSuffix)).join('')
        : past.map((i) => slot(pick(i), rowSuffix)).join('');
      const todayContent = todayOnly ? pick(today) : (pastOnly ? '' : pick(today));
      return `
        <div class="day-${rowSuffix}-row day-row--split-today">
          <div class="day-past-group">${pastSlots}</div>
          <div class="day-today-separator" aria-hidden="true"></div>
          ${slot(todayContent, rowSuffix)}
        </div>
      `;
    }
    return `
      <div class="day-${rowSuffix}-row">
        ${items.map((i) => slot(pick(i), rowSuffix)).join('')}
      </div>
    `;
  };

  const todayAboveRow = dividerBeforeToday && todayLabelAbove && items.length >= 2
    ? (() => {
      const past = items.slice(0, -1);
      return `
        <div class="day-today-above-row day-row--split-today">
          <div class="day-past-group">${past.map(() => slot('', 'today-above')).join('')}</div>
          <div class="day-today-separator" aria-hidden="true"></div>
          <div class="day-slot day-slot--today-above"><span class="zone-label">Today</span></div>
        </div>
      `;
    })()
    : '';

  const chartBody = dividerBeforeToday && items.length >= 2
    ? `
      ${todayAboveRow}
      <div class="recent-band-plot">
        ${spanBand ? '' : `<div class="recent-band-lines" aria-hidden="true">${linesHtml}</div>`}
        ${splitRow((i) => i.visual, 'visual')}
      </div>
      ${splitRow((i) => i.name, 'name', { pastOnly: todayLabelAbove || todayHeaderSplit })}
      ${splitRow((i) => i.date, 'date')}
    `
    : `
      <div class="recent-band-plot">
        ${spanBand ? '' : `<div class="recent-band-lines" aria-hidden="true">${linesHtml}</div>`}
        ${splitRow((i) => i.visual, 'visual')}
      </div>
      ${splitRow((i) => i.name, 'name')}
      ${splitRow((i) => i.date, 'date')}
    `;

  if (spanBand) {
    return `
      <div class="day-stack day-stack--ladders day-stack--span-band${dividerBeforeToday ? ' day-stack--with-divider' : ''}">
        <div class="day-stack-main">
          ${dividerBeforeToday ? '<div class="day-col-divider" aria-hidden="true"></div>' : ''}
          ${chartBody}
        </div>
      </div>
    `;
  }

  return `
    <div class="day-stack day-stack--ladders day-stack--band-axis${dividerBeforeToday ? ' day-stack--with-divider' : ''}">
      <div class="recent-band-axis ladders-band-axis" aria-hidden="true">${bandAxisLabelsHtml()}</div>
      <div class="day-stack-main">
        ${dividerBeforeToday ? '<div class="day-col-divider" aria-hidden="true"></div>' : ''}
        ${chartBody}
      </div>
    </div>
  `;
}

function dayStackTripleBandAxisHtml(items) {
  const slot = (content, row) => `<div class="day-slot day-slot--${row}">${content || ''}</div>`;
  const pastCount = items.length - 2;
  const past = items.slice(0, pastCount);
  const today = items[pastCount];
  const forecast = items[pastCount + 1];

  const tripleRow = (pick, rowSuffix) => `
    <div class="day-${rowSuffix}-row day-row--split-triple">
      <div class="day-past-group">${past.map((i) => slot(pick(i), rowSuffix)).join('')}</div>
      <div class="day-today-separator" aria-hidden="true"></div>
      ${slot(pick(today), rowSuffix)}
      <div class="day-forecast-separator" aria-hidden="true"></div>
      <div class="day-forecast-group">${slot(pick(forecast), rowSuffix)}</div>
    </div>
  `;

  const chartBody = `
    <div class="recent-band-plot">
      ${tripleRow((i) => i.visual, 'visual')}
    </div>
    ${tripleRow((i) => i.name, 'name')}
    ${tripleRow((i) => i.date, 'date')}
  `;

  return `
    <div class="day-stack day-stack--ladders day-stack--span-band day-stack--with-double-divider">
      <div class="day-stack-main">
        <div class="day-col-divider day-col-divider--past-today" aria-hidden="true"></div>
        <div class="day-col-divider day-col-divider--today-forecast" aria-hidden="true"></div>
        ${chartBody}
      </div>
    </div>
  `;
}

function dayStackHtml(items, { ladders = false, circles = false, dividerBeforeToday = false, bandAxis = false, spanBand = false, todayLabelAbove = false, todayHeaderSplit = false } = {}) {
  if ((bandAxis || spanBand) && ladders) {
    return dayStackBandAxisHtml(items, { dividerBeforeToday, spanBand, todayLabelAbove, todayHeaderSplit });
  }
  const visualClass = ladders ? ' day-stack--ladders' : circles ? ' day-stack--circles' : '';
  const showDivider = dividerBeforeToday && items.length >= 2;
  const slot = (content, row) => `<div class="day-slot day-slot--${row}">${content || ''}</div>`;

  if (showDivider) {
    const past = items.slice(0, -1);
    const today = items[items.length - 1];

    const splitRow = (pick, rowSuffix, { pastOnly = false } = {}) => {
      const todayContent = pastOnly ? '' : pick(today);
      return `
      <div class="day-${rowSuffix}-row day-row--split-today">
        <div class="day-past-group">
          ${past.map((i) => slot(pick(i), rowSuffix)).join('')}
        </div>
        <div class="day-today-separator" aria-hidden="true"></div>
        ${slot(todayContent, rowSuffix)}
      </div>
    `;
    };

    return `
      <div class="day-stack${visualClass} day-stack--with-divider">
        <div class="day-col-divider" aria-hidden="true"></div>
        ${splitRow((i) => i.visual, 'visual')}
        ${splitRow((i) => i.name, 'name', { pastOnly: todayHeaderSplit })}
        ${splitRow((i) => i.date, 'date')}
      </div>
    `;
  }

  return `
    <div class="day-stack${visualClass}">
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

export function recentCardHtml(recentDays, species, { visual = 'blobs', ladderSize, legendOutside = false, bandAxis = false, spanBand = false, todayLabelAbove = false, todayHeaderSplit = false, dividerBeforeToday = true } = {}) {
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
  } else if (visual === 'circles') {
    items = days.map((d) => dayItemFromRecent(d, species, (day) => {
      const level = daqiLevel(day.daily[species], species);
      return daqiCircleStack(level);
    }));
  } else {
    items = days.map((d) => dayItemFromRecent(d, species, (day) => {
      const level = daqiLevel(day.daily[species], species);
      return daqiIndexBlob(level, { large: true });
    }));
  }

  const legend = legendOutside || bandAxis || spanBand
    ? ''
    : `<div class="daqi-legend-wrap">${daqiLegendHtml()}</div>`;

  const useTodayHeaderSplit = todayHeaderSplit && visual === 'ladders';
  const labelRow = useTodayHeaderSplit
    ? laddersSplitHeaderHtml()
    : '<div class="zone-label">Recent</div>';

  return `
    ${labelRow}
    <div class="zone-main zone-main--days${bandAxis ? ' zone-main--band-axis' : ''}">
      <div class="day-panel">
        ${dayStackHtml(items, {
          ladders: visual === 'ladders',
          circles: visual === 'circles',
          dividerBeforeToday,
          bandAxis: bandAxis && visual === 'ladders',
          spanBand: spanBand && visual === 'ladders',
          todayLabelAbove: todayLabelAbove && visual === 'ladders' && !useTodayHeaderSplit,
          todayHeaderSplit: useTodayHeaderSplit,
        })}
      </div>
    </div>
    ${legend}
  `;
}

function forecastLadderAlignHtml(items) {
  const slot = (content, row) => `<div class="day-slot day-slot--${row}">${content || ''}</div>`;
  return `
    <div class="day-stack day-stack--ladders day-stack--span-band">
      <div class="day-stack-main">
        <div class="recent-band-plot">
          <div class="day-visual-row">
            ${items.map((i) => slot(i.visual, 'visual')).join('')}
          </div>
        </div>
        <div class="day-name-row">
          ${items.map((i) => slot(i.name, 'name')).join('')}
        </div>
        <div class="day-date-row">
          ${items.map((i) => slot(i.date, 'date')).join('')}
        </div>
      </div>
    </div>
  `;
}

export function todayCardHtml(recentDays, species, { ladderSize } = {}) {
  const day = sortedRecentDays(recentDays).find((d) => d.offset === 0);
  const lh = ladderSize?.height ?? LADDER_HEIGHT;
  const lw = ladderSize?.width ?? 28;

  if (!day) {
    return `
      <div class="zone-label zone-label--center">Today</div>
      <div class="zone-main zone-main--days zone-main--compact">
        <div class="day-panel day-panel--compact"></div>
      </div>
    `;
  }

  const level = daqiLevel(day.daily[species], species);
  const items = [{
    visual: daqiStackedBar(level, { height: lh, width: lw }),
    name: '',
    date: formatDateChip(day.date),
  }];

  return `
    <div class="zone-label zone-label--center">Today</div>
    <div class="zone-main zone-main--days zone-main--compact">
      <div class="day-panel day-panel--compact">
        ${forecastLadderAlignHtml(items)}
      </div>
    </div>
  `;
}

export function forecastCardHtml(forecast, species, { type = 'blob', ladderSize, balanceLegend = false, ladderChartAlign = false, compact = false } = {}) {
  const level = forecastBandToDaqi(forecast.band);
  const lh = ladderSize?.height ?? LADDER_HEIGHT;
  const lw = ladderSize?.width ?? 28;

  let visual;
  if (type === 'ladder') visual = daqiStackedBar(level, { height: lh, width: lw });
  else if (type === 'circles') visual = daqiCircleStack(level);
  else if (type === 'dot') visual = `<div class="daqi-dot daqi-dot--xl" style="background:${daqiColor(level)}"></div>`;
  else visual = daqiIndexBlob(level, { large: true });

  const items = [{ visual, name: '', date: formatDateChip(forecast.date) }];

  const legendBalance = balanceLegend
    ? '<div class="daqi-legend-spacer" aria-hidden="true"></div>'
    : '';

  const stackHtml = type === 'ladder' && ladderChartAlign
    ? forecastLadderAlignHtml(items)
    : dayStackHtml(items, {
      ladders: type === 'ladder',
      circles: type === 'circles',
    });

  return `
    <div class="zone-label${compact ? ' zone-label--center' : ''}">Forecast</div>
    <div class="zone-main zone-main--days${compact ? ' zone-main--compact' : ''}">
      <div class="day-panel${compact ? ' day-panel--compact' : ''}">
        ${stackHtml}
        ${legendBalance}
      </div>
    </div>
  `;
}

/** 3.2c — Recent card with band-axis labels and Today header */
export function recentCardBandAxisHtml(recentDays, species, { ladderSize } = {}) {
  const days = sortedRecentDays(recentDays);
  const h = ladderSize?.height ?? LADDER_HEIGHT;
  const w = ladderSize?.width ?? 28;

  const recentItems = days.map((d) => {
    const item = dayItemFromRecent(d, species, (day) => {
      const level = daqiLevel(day.daily[species], species);
      return daqiStackedBar(level, { height: h, width: w });
    });
    if (d.offset === 0) item.name = '';
    return item;
  });

  return `
    <div class="recent-band-header">
      <div class="ladders-header-split">
        <div class="ladders-header-past"><div class="zone-label">Recent</div></div>
        <div class="ladders-header-today-sep" aria-hidden="true"></div>
        <div class="ladders-header-today"><div class="zone-label">Today</div></div>
      </div>
    </div>
    <div class="recent-band-body">
      <div class="ladders-band-axis" aria-hidden="true">${bandAxisLabelsHtml()}</div>
      <div class="zone-main zone-main--days">
        <div class="day-panel">
          ${dayStackHtml(recentItems, { ladders: true, dividerBeforeToday: true })}
        </div>
      </div>
    </div>
  `;
}

/** 3.2e — single panel: Recent (−3d…−1d) | Today | Forecast with two dividers */
export function combinedLaddersCardHtml(recentDays, forecast, species, { ladderSize } = {}) {
  const days = sortedRecentDays(recentDays);
  const h = ladderSize?.height ?? LADDER_HEIGHT;
  const w = ladderSize?.width ?? 28;

  const pastItems = days.filter((d) => d.offset > 0).map((d) => dayItemFromRecent(d, species, (day) => {
    const level = daqiLevel(day.daily[species], species);
    return daqiStackedBar(level, { height: h, width: w });
  }));

  const todayDay = days.find((d) => d.offset === 0);
  const todayItem = todayDay
    ? { ...dayItemFromRecent(todayDay, species, (day) => {
      const level = daqiLevel(day.daily[species], species);
      return daqiStackedBar(level, { height: h, width: w });
    }), name: '' }
    : { visual: '', name: '', date: '' };

  const fcLevel = forecastBandToDaqi(forecast.band);
  const forecastItem = {
    visual: daqiStackedBar(fcLevel, { height: h, width: w }),
    name: '',
    date: formatDateChip(forecast.date),
  };

  const items = [...pastItems, todayItem, forecastItem];

  return `
    ${laddersTripleHeaderHtml()}
    <div class="zone-main zone-main--days">
      <div class="day-panel">
        ${dayStackTripleBandAxisHtml(items)}
      </div>
    </div>
  `;
}

/** @deprecated split into recentCardBandAxisHtml + separate forecast card */
export function laddersCombinedCardHtml(recentDays, forecast, species, { ladderSize } = {}) {
  const days = sortedRecentDays(recentDays);
  const h = ladderSize?.height ?? LADDER_HEIGHT;
  const w = ladderSize?.width ?? 28;

  const recentItems = days.map((d) => {
    const item = dayItemFromRecent(d, species, (day) => {
      const level = daqiLevel(day.daily[species], species);
      return daqiStackedBar(level, { height: h, width: w });
    });
    if (d.offset === 0) item.name = '';
    return item;
  });

  const fcLevel = forecastBandToDaqi(forecast.band);
  const forecastItems = [{
    visual: daqiStackedBar(fcLevel, { height: h, width: w }),
    name: '',
    date: formatDateChip(forecast.date),
  }];

  return `
    <div class="ladders-combined-header">
      <div class="ladders-header-recent ladders-header-split">
        <div class="ladders-header-past">
          <div class="zone-label">Recent</div>
        </div>
        <div class="ladders-header-today-sep" aria-hidden="true"></div>
        <div class="ladders-header-today">
          <div class="zone-label">Today</div>
        </div>
      </div>
      <div class="ladders-forecast-bar ladders-forecast-bar--header" aria-hidden="true"></div>
      <div class="zone-label ladders-header-forecast">Forecast</div>
    </div>
    <div class="ladders-combined-body">
      <div class="ladders-band-axis" aria-hidden="true">${bandAxisLabelsHtml()}</div>
      <div class="ladders-band-lines" aria-hidden="true">${bandAxisLinesHtml()}</div>
      <div class="ladders-col ladders-col--recent">
        <div class="zone-main zone-main--days">
          <div class="day-panel">
            ${dayStackHtml(recentItems, { ladders: true, dividerBeforeToday: true })}
          </div>
        </div>
      </div>
      <div class="ladders-forecast-bar" aria-hidden="true"></div>
      <div class="ladders-col ladders-col--forecast">
        <div class="zone-main zone-main--days">
          <div class="day-panel">
            ${dayStackHtml(forecastItems, { ladders: true })}
          </div>
        </div>
      </div>
    </div>
  `;
}
