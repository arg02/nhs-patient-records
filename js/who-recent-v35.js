/**
 * 3.5 Recent & Forecast — WHO-line CAQI pill bars per column + full CAQI legend.
 */

import { formatDateChip, sortedRecentDays } from './air-quality.js?v=6';
import {
  CAQI_KEY,
  CAQI_MEETS_COUNT,
  CAQI_INACTIVE,
  caqiLevel,
  caqiColor,
  dailyWhoComparison,
  getCaqiScale,
  whoLineRatio,
} from './who-caqi-v35.js?v=4';

const TRACK_HEIGHT = 96;
const PILL_WIDTH = 28;

export function whoCaqiLegendHtml() {
  const bands = CAQI_KEY.map((band) => `
    <div class="caqi-legend-v35-band">
      <div class="caqi-legend-v35-dots">
        ${band.colors.map((c) => `<span class="caqi-legend-v35-dot" style="background:${c}"></span>`).join('')}
      </div>
      <span class="caqi-legend-v35-label">${band.label}</span>
    </div>
  `).join('');
  return `<div class="caqi-legend-v35">${bands}</div>`;
}

/**
 * Vertical pill bar — 13 horizontal colour strips split at WHO line.
 * At/below max level: coloured (faded below WHO, solid above). Above max: grey.
 */
export function caqiWhoPillBar(dailyMean, species, { height = TRACK_HEIGHT, width = PILL_WIDTH } = {}) {
  const maxLevel = caqiLevel(dailyMean, species);
  const cmp = dailyWhoComparison(dailyMean, species);
  const { colors } = getCaqiScale(species);
  const totalLevels = colors.length;
  const whoLinePx = whoLineRatio(species) * height;
  const belowSegH = whoLinePx / CAQI_MEETS_COUNT;
  const aboveCount = totalLevels - CAQI_MEETS_COUNT;
  const aboveSegH = (height - whoLinePx) / aboveCount;

  const seg = (level, segH, zone) => {
    const on = maxLevel != null && level <= maxLevel; // strips 1..maxLevel coloured, rest grey
    const bg = on ? caqiColor(level, species) : CAQI_INACTIVE;
    const faded = zone === 'below' && on;
    return `<div class="who-caqi-seg who-caqi-seg--${zone}${faded ? ' who-caqi-seg--faded' : ''}${on ? ' who-caqi-seg--on' : ''}" style="height:${segH}px;background:${bg}"></div>`;
  };

  const belowSegs = [];
  for (let lv = 1; lv <= CAQI_MEETS_COUNT; lv++) {
    belowSegs.push(seg(lv, belowSegH, 'below'));
  }

  const aboveSegs = [];
  for (let lv = CAQI_MEETS_COUNT + 1; lv <= totalLevels; lv++) {
    aboveSegs.push(seg(lv, aboveSegH, 'above'));
  }

  const title = cmp
    ? `${Math.round(dailyMean * 10) / 10} µg/m³ · CAQI ${maxLevel} · ${cmp.label}`
    : '—';

  return `
    <div class="who-caqi-pill-wrap" style="height:${height}px;width:${width}px" title="${title}">
      <div class="who-line-h who-line-h--dotted who-line-h--caqi" style="bottom:${whoLinePx}px"></div>
      <div class="who-caqi-pill" style="height:${height}px;width:${width - 4}px">
        <div class="who-caqi-zone who-caqi-zone--above">${aboveSegs.reverse().join('')}</div>
        <!-- above zone reversed so level 13 sits at top; below zone DOM 1..3 + CSS column-reverse = bottom-up -->
        <div class="who-caqi-zone who-caqi-zone--below">${belowSegs.join('')}</div>
      </div>
    </div>
  `;
}

function dayStackHtml(items, { dividerBeforeToday = false } = {}) {
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
      <div class="day-stack day-stack--caqi-pills day-stack--with-divider">
        <div class="day-col-divider" aria-hidden="true"></div>
        ${splitRow((i) => i.visual, 'visual')}
        ${splitRow((i) => i.name, 'name')}
        ${splitRow((i) => i.date, 'date')}
      </div>
    `;
  }

  return `
    <div class="day-stack day-stack--caqi-pills">
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

function dayItemFromRecent(d, species) {
  const dailyMean = d.daily[species];
  return {
    visual: caqiWhoPillBar(dailyMean, species),
    name: d.offset === 0 ? 'Today' : `−${d.offset}d`,
    date: formatDateChip(d.date),
  };
}

export function whoRecentCardHtmlV35(recentDays, species) {
  const days = sortedRecentDays(recentDays);
  const items = days.map((d) => dayItemFromRecent(d, species));

  return `
    <div class="zone-label">Recent</div>
    <div class="zone-main zone-main--days">
      <div class="day-panel">
        ${dayStackHtml(items, { dividerBeforeToday: true })}
      </div>
    </div>
  `;
}

export function whoForecastCardHtmlV35(forecast, species) {
  const dailyMean = forecast.daily?.[species];
  const items = [{
    visual: caqiWhoPillBar(dailyMean, species),
    name: '+1d',
    date: formatDateChip(forecast.date),
  }];

  return `
    <div class="zone-label">Forecast</div>
    <div class="zone-main zone-main--days">
      <div class="day-panel">
        ${dayStackHtml(items)}
      </div>
    </div>
  `;
}
