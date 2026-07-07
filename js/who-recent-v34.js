/**
 * 3.4 Recent & Forecast panels — vertical CAQI circle stacks + full 5-group legend.
 * Visual key adapted from daqi-vs-caqi ColorLegend (CAQI_KEY); circles mirror DAQI stack layout.
 */

import { formatDateChip, sortedRecentDays } from './air-quality.js?v=6';
import {
  CAQI_KEY,
  CAQI_INACTIVE,
  caqiLevel,
  caqiColor,
  caqiBandLabel,
  dailyWhoComparison,
} from './who-caqi-v34.js?v=2';

const CAQI_CIRCLE_BANDS = CAQI_KEY.map((band) => band.levels);

export function whoLegendHtml() {
  const bands = CAQI_KEY.map((band) => `
    <div class="who-legend-band">
      <div class="who-legend-dots">
        ${band.colors.map((c) => `<span class="who-legend-dot" style="background:${c}"></span>`).join('')}
      </div>
      <span class="who-legend-label">${band.label}</span>
    </div>
  `).join('');
  return `<div class="who-legend who-legend--caqi-full">${bands}</div>`;
}

/** Vertical circle stack — 5 CAQI band groups (3+3+3+3+1 dots), daqi-circle-stack spacing */
export function whoCircleStack(dailyMean, species) {
  const level = caqiLevel(dailyMean, species);
  const cmp = dailyWhoComparison(dailyMean, species);
  const title = cmp
    ? `${Math.round(dailyMean * 10) / 10} µg/m³ · CAQI ${level} · ${caqiBandLabel(level)}`
    : '—';

  const bands = CAQI_CIRCLE_BANDS.map((levels) => {
    const dots = [...levels].reverse().map((idx) => {
      // Cumulative fill across all 5 band groups (13 levels total)
      const on = level != null && idx <= level;
      const c = caqiColor(idx, species);
      return `<span class="who-circle-dot${on ? ' who-circle-dot--on' : ''}" data-level="${idx}" style="background:${on ? c : CAQI_INACTIVE}"></span>`;
    }).join('');
    return `<div class="who-circle-band">${dots}</div>`;
  }).join('');

  return `<div class="who-circle-stack" title="${title}">${bands}</div>`;
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
      <div class="day-stack day-stack--circles day-stack--who-circles day-stack--with-divider">
        <div class="day-col-divider" aria-hidden="true"></div>
        ${splitRow((i) => i.visual, 'visual')}
        ${splitRow((i) => i.name, 'name')}
        ${splitRow((i) => i.date, 'date')}
      </div>
    `;
  }

  return `
    <div class="day-stack day-stack--circles day-stack--who-circles">
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
  const level = caqiLevel(dailyMean, species);
  return {
    visual: whoCircleStack(dailyMean, species),
    name: d.offset === 0 ? 'Today' : `−${d.offset}d`,
    date: formatDateChip(d.date),
    bandLabel: caqiBandLabel(level),
  };
}

export function whoRecentCardHtml(recentDays, species) {
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

export function whoForecastCardHtml(forecast, species) {
  const dailyMean = forecast.daily?.[species];
  const level = caqiLevel(dailyMean, species);
  const visual = whoCircleStack(dailyMean, species);
  const items = [{
    visual,
    name: '',
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
