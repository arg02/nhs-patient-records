/**
 * Demo / live payload builders for the Today calculation showcase.
 * Reads per-day files from data/live/ (via a store bundle passed from live.html).
 */

import {
  mockPatientExposure,
  daqiLevel,
  daqiLevelForDay,
  daqiColor,
  formatDateChip,
  dailyMeanFromHourly,
  DAQI_THRESHOLDS,
  DAQI_COLORS,
  roundDaqiConcentration,
} from './air-quality.js?v=14';
import {
  replayDay,
  ukLocalParts,
  ERG_TRIGGERS,
} from './today-calc.js?v=5';
import {
  DEFAULT_LAT,
  DEFAULT_LNG,
  DEFAULT_PATIENT,
  latestDataHour,
  DATA_LAG_HOURS,
  lastFilledHour,
} from './live-store.js?v=4';
import { forecastForWidget } from './london-air-forecast.js?v=1';

/** Plain ASCII unit — CSS uppercase was turning µg into “MG”. */
export const UG_M3 = 'ug/m3';

/** Rounded integer µg/m³ for display (project DAQI rounding). */
export function formatUgDisplay(v) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return String(roundDaqiConcentration(Number(v)));
}

function formatUgInteger(v) {
  if (v == null || Number.isNaN(Number(v))) return null;
  return roundDaqiConcentration(Number(v));
}

export function formatGmtHour(isoOrDate) {
  if (isoOrDate == null) return null;
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getUTCHours()).padStart(2, '0')}:00`;
}

export function formatGmtStamp(isoOrDate) {
  if (isoOrDate == null) return null;
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.toISOString().slice(0, 19).replace('T', ' ')} GMT`;
}

/** Deterministic commute-peak day used when no ingested state is present. */
export function demoHourlySeries() {
  return {
    no2: [32, 28, 26, 24, 30, 48, 72, 98, 142, 188, 165, 118, 88, 76, 70, 64, 58, 52, 48, 44, 40, 38, 36, 34],
    pm25: [9, 8, 8, 7, 8, 10, 12, 14, 22, 51, 54, 49, 40, 28, 20, 16, 14, 12, 11, 10, 10, 9, 9, 8],
    pm10: [16, 15, 14, 13, 15, 18, 22, 28, 40, 70, 75, 70, 55, 40, 30, 24, 20, 18, 16, 15, 15, 14, 14, 14],
    o3: [48, 46, 44, 42, 45, 50, 55, 70, 100, 108, 112, 110, 95, 80, 70, 62, 58, 55, 52, 50, 48, 46, 45, 44],
  };
}

/**
 * @param {object} opts
 * @param {object|null} opts.index — data/live/index.json
 * @param {object|null} opts.todayDay — today's day file
 * @param {object[]} opts.pastDays — −1/−2/−3 day files (any order)
 */
export function buildLiveDemoBundle({ index = null, todayDay = null, pastDays = [] } = {}) {
  const base = mockPatientExposure();
  const uk = ukLocalParts();
  const patient = index?.patient || DEFAULT_PATIENT;
  const dataTarget = index?.lastData?.gmtTimestamp
    ? {
      dateKey: index.lastData.ukDateKey,
      hour: index.lastData.hour,
      gmtTimestamp: index.lastData.gmtTimestamp,
    }
    : latestDataHour(new Date(), ukLocalParts);

  const series = todayDay?.hourly || demoHourlySeries();
  const ukDateKey = todayDay?.ukDateKey || index?.wallClockUk?.dateKey || uk.dateKey;
  const filled = lastFilledHour(series);
  const asOfHour = filled >= 0
    ? filled + 1
    : ((dataTarget.ukDateKey || dataTarget.dateKey) === ukDateKey ? dataTarget.hour + 1 : 0);

  const { state, timeline } = replayDay(series, {
    asOfHour,
    ukDateKey,
    hourMeta: todayDay?.hourMeta || null,
  });

  const byOffset = {};
  for (const day of pastDays) {
    if (!day?.ukDateKey) continue;
    const offset = Math.round(
      (Date.parse(`${ukDateKey}T12:00:00Z`) - Date.parse(`${day.ukDateKey}T12:00:00Z`)) / 86400000,
    );
    if (offset >= 1 && offset <= 3) byOffset[offset] = day;
  }

  const ladderDays = [3, 2, 1, 0].map((offset) => {
    const date = new Date(`${ukDateKey}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - offset);

    if (offset === 0) {
      const level = state.todayLevel;
      const daily = {
        pm25: dailyMeanFromHourly(series.pm25 || []),
        pm10: dailyMeanFromHourly(series.pm10 || []),
        no2: dailyMeanFromHourly(series.no2 || []),
        o3: dailyMeanFromHourly(series.o3 || []),
      };
      return {
        offset: 0,
        date,
        daily,
        todayMeta: {
          level,
          indexes: state.indexes,
          asOfHour,
          dataHour: filled >= 0 ? filled : null,
        },
      };
    }

    const stored = byOffset[offset];
    const daily = stored?.dailyMeans || {
      pm25: dailyMeanFromHourly(stored?.hourly?.pm25 || []),
      pm10: dailyMeanFromHourly(stored?.hourly?.pm10 || []),
      no2: dailyMeanFromHourly(stored?.hourly?.no2 || []),
      o3: dailyMeanFromHourly(stored?.hourly?.o3 || []),
    };
    const hasLive = daily.pm25 != null || daily.no2 != null;
    const fallback = base.recentDays.find((d) => d.offset === offset);
    const useDaily = hasLive ? daily : fallback?.daily;
    return {
      offset,
      date,
      daily: useDaily,
      dayMaxDaqi: stored?.dayMaxDaqi ?? null,
      // Overall day DAQI from daily means (guide) — drives ladder when live
      overallLevel: hasLive && useDaily ? daqiLevelForDay({ daily: useDaily }) : null,
    };
  });

  const pollutantPanels = ['pm25', 'pm10', 'no2', 'o3'].map((key) =>
    buildPollutantPanel(key, series, state, timeline, asOfHour, todayDay, index),
  );

  const annual = index?.annual || base.annual;
  const annualYear = index?.annualYear ?? base.annualYear;
  const forecast = forecastForWidget(index?.forecast) || base.forecast;

  return {
    widgetData: {
      ...base,
      patient,
      annual,
      annualYear,
      recentDays: ladderDays,
      forecast,
      fetchedAt: index?.lastFetchedAt ? new Date(index.lastFetchedAt) : new Date(),
      live: {
        source: index?.source || 'demo',
        asOfHour,
        ukDateKey,
        lat: index?.lat ?? DEFAULT_LAT,
        lng: index?.lng ?? DEFAULT_LNG,
        todayLevel: state.todayLevel,
        indexes: state.indexes,
        previousHour: state.previousHour,
        triggers: state.triggers,
        lastData: dataTarget,
        dataLagHours: index?.dataLagHours ?? DATA_LAG_HOURS,
      },
    },
    pollutantPanels,
    summary: {
      todayLevel: state.todayLevel,
      asOfHour,
      ukDateKey,
      dataHour: filled >= 0 ? filled : null,
      dataDateKey: dataTarget.ukDateKey || dataTarget.dateKey,
      lastSteps: timeline[timeline.length - 1]?.steps || [],
      source: index?.source || 'demo',
      fetchedAt: index?.lastFetchedAt || null,
      note: index?.note || null,
      annual,
      annualYear,
      forecast: index?.forecast || null,
    },
  };
}

function triggerRowsFor(key) {
  if (key === 'no2') {
    // NO₂ has no ERG trigger table — show DAQI bands for comparison
    const lows = DAQI_THRESHOLDS.no2;
    return lows.map((low, i) => {
      const next = lows[i + 1];
      return {
        index: i + 1,
        ug: low,
        range: next != null ? `${low}\u2013${next - 1}` : `\u2265${low}`,
        color: DAQI_COLORS[i],
        kind: 'daqi',
      };
    });
  }
  const table = ERG_TRIGGERS[key] || {};
  return Object.keys(table)
    .map(Number)
    .sort((a, b) => a - b)
    .map((index) => ({
      index,
      ug: table[index],
      range: `${table[index]}`,
      color: DAQI_COLORS[index - 1],
      kind: 'erg',
    }));
}

function stepMatchesPollutant(key, kind) {
  if (!kind) return false;
  if (key === 'o3') return kind.startsWith('o3');
  return kind.startsWith(key);
}

function formatUgPairBracket(prev, curr) {
  const p = formatUgInteger(prev);
  const c = formatUgInteger(curr);
  if (p != null && c != null) return `(prev ${p} ${UG_M3} → curr ${c} ${UG_M3})`;
  if (c != null) return `(curr ${c} ${UG_M3})`;
  if (p != null) return `(prev ${p} ${UG_M3})`;
  return '';
}

function ugPairForHour(key, h, steps, series) {
  let prev = h > 0 ? (series[key]?.[h - 1] ?? null) : null;
  let curr = series[key]?.[h] ?? null;
  const relevant = (steps || []).filter((s) => stepMatchesPollutant(key, s.kind));
  const fired = relevant.find((s) => s.kind === `${key}-trigger`);
  if (fired) {
    if (fired.previous != null) prev = fired.previous;
    if (fired.current != null) curr = fired.current;
  }
  if (key === 'no2') {
    const no2 = relevant.find((s) => s.kind === 'no2');
    if (no2?.ug != null) curr = no2.ug;
  }
  return { prev, curr };
}

/** Summarise trigger / index events for one hour on a pollutant panel. */
function hourEventText(key, steps) {
  const relevant = (steps || []).filter((s) => stepMatchesPollutant(key, s.kind));
  if (!relevant.length) return '—';
  if (key === 'no2') {
    const s = relevant.find((r) => r.kind === 'no2');
    return s?.index != null ? `latest hour → ${s.index}` : '—';
  }
  const fired = relevant.find((s) => s.kind === `${key}-trigger`);
  if (fired) return `trigger set → ${fired.index}`;
  const daymean = relevant.find((s) => s.kind === `${key}-daymean`);
  if (daymean) return `day mean → ${daymean.index}`;
  const roll = relevant.find((s) => s.kind === 'o3-roll');
  if (roll) return `8h mean → ${roll.index}`;
  const clear = relevant.find((s) => s.kind === 'o3-clear');
  if (clear) return 'trigger cleared';
  const falling = relevant.find((s) => s.kind === `${key}-falling`);
  if (falling) return falling.index != null ? `falling · hold ${falling.index}` : 'falling';
  const quiet = relevant.find((s) => s.kind === 'o3-quiet');
  if (quiet) return quiet.index != null ? `quiet · hold ${quiet.index}` : 'quiet';
  const keep = relevant.find((s) => s.kind === `${key}-daymean-keep` || s.kind === 'o3-roll-keep');
  if (keep) return keep.index != null ? `hold ${keep.index}` : 'hold';
  const none = relevant.find((s) => s.kind === `${key}-none`);
  if (none?.index != null) return `hold ${none.index}`;
  return '—';
}

/** Per-hour history since UK midnight for explainer tables and chart colours. */
function buildHourHistory(key, timeline, series, todayDay) {
  return timeline.map((entry) => {
    const h = entry.hour;
    const meta = todayDay?.hourMeta?.[h] || null;
    const gmtTimestamp = meta?.gmtTimestamp || null;
    const ug = series[key]?.[h] ?? null;
    const hourIndex = daqiLevel(ug, key);
    const activeIndex = entry.indexes?.[key] ?? null;
    const triggerIndex = entry.state?.triggers?.[key]?.index ?? null;
    const baseEvent = hourEventText(key, entry.steps);
    const { prev, curr } = ugPairForHour(key, h, entry.steps, series);
    const bracket = formatUgPairBracket(prev, curr);
    const eventText = bracket ? `${bracket} ${baseEvent}` : baseEvent;
    const changed = key !== 'no2' && /→|cleared/.test(baseEvent);
    return {
      hour: h,
      ukHour: h,
      gmtLabel: formatGmtHour(gmtTimestamp) || formatHourLabel(h),
      gmtTimestamp,
      ug,
      hourIndex,
      activeIndex,
      triggerIndex,
      eventText,
      changed,
      color: daqiColor(activeIndex ?? hourIndex),
    };
  });
}

/** Scrollable table of hourly concentrations and trigger history. */
export function hourHistoryTableHtml(hourHistory, { key } = {}) {
  if (!hourHistory?.length) {
    return '<p class="calc-card__empty">No hourly data yet today.</p>';
  }
  const title = key === 'no2'
    ? 'Hourly history (GMT) — latest hour rule'
    : 'Hourly history (GMT) — concentration and active index';
  const rows = hourHistory.map((row) => {
    const idx = row.activeIndex ?? '—';
    const swatch = row.activeIndex != null
      ? `<span class="hour-hist__swatch" style="background:${daqiColor(row.activeIndex)}"></span>`
      : '';
    return `<tr class="${row.changed ? 'is-event' : ''}">
      <td>${row.gmtLabel}</td>
      <td>${formatUgDisplay(row.ug)}</td>
      <td>${row.hourIndex ?? '—'}</td>
      <td class="hour-hist__active">${swatch}${idx}</td>
      <td class="hour-hist__event">${row.eventText}</td>
    </tr>`;
  }).join('');
  return `
    <div class="calc-card__hour-hist">
      <h4 class="calc-card__band-hd">${title}</h4>
      <div class="hour-hist-scroll">
        <table class="hour-hist" aria-label="${title}">
          <thead>
            <tr>
              <th>GMT</th>
              <th>${UG_M3}</th>
              <th>Hour</th>
              <th>Active</th>
              <th>Event</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function buildPollutantPanel(key, series, state, timeline, asOfHour, todayDay, index) {
  const labels = { pm25: 'PM\u2082.\u2085', pm10: 'PM\u2081\u2080', no2: 'NO\u2082', o3: 'O\u2083' };
  const hourHistory = buildHourHistory(key, timeline, series, todayDay);
  const hours = hourHistory.map((row) => ({
    hour: row.hour,
    ukHour: row.ukHour,
    gmtHour: row.gmtTimestamp ? new Date(row.gmtTimestamp).getUTCHours() : null,
    gmtLabel: row.gmtLabel,
    ug: row.ug,
    level: row.hourIndex,
    activeIndex: row.activeIndex,
    gmtTimestamp: row.gmtTimestamp,
    fetchedAt: todayDay?.hourMeta?.[row.hour]?.fetchedAt || null,
  }));
  const latest = hours[hours.length - 1];
  const idx = state.indexes?.[key] ?? null;
  const trigger = state.triggers?.[key] ?? null;
  let method;
  if (key === 'no2') {
    method = 'Latest complete data hour only (no ERG trigger table). Nowcast = GMT hour floor − 2h. Times in GMT.';
  } else if (key === 'o3') {
    method = 'ERG index-point triggers (persist; ~4h quiet clear) · rolling 8h may supersede if higher. Times in GMT.';
  } else {
    method = 'ERG index-point triggers from UK midnight · from 19:00 UK partial-day mean may replace if higher. Display times in GMT.';
  }

  const dataMax = Math.max(
    0,
    ...hours.map((h) => h.ug).filter((v) => v != null && !Number.isNaN(v)),
  );
  // Headroom above the series peak so the line isn't jammed against the top
  const chartMax = niceChartMax(dataMax);

  const triggerSinceGmt = trigger?.sinceGmt
    || (trigger?.sinceHour != null && todayDay?.hourMeta
      ? Object.values(todayDay.hourMeta).find((m) => m && new Date(m.gmtTimestamp).getUTCHours() === trigger.sinceHour)?.gmtTimestamp
      : null)
    || null;
  // sinceHour in stored JSON is GMT (see today-calc triggerWhen)
  const triggerSinceGmtLabel = trigger?.sinceHour != null
    ? `${String(trigger.sinceHour).padStart(2, '0')}:00`
    : formatGmtHour(triggerSinceGmt);

  const prevUk = state.previousHour?.hour ?? null;
  const prevGmt = prevUk != null
    ? (todayDay?.hourMeta?.[prevUk]?.gmtTimestamp
      || hours.find((h) => h.ukHour === prevUk)?.gmtTimestamp
      || null)
    : null;

  return {
    key,
    label: labels[key],
    method,
    dataHourUk: latest?.ukHour ?? null,
    dataGmt: latest?.gmtTimestamp ?? null,
    dataGmtLabel: latest?.gmtLabel ?? formatGmtHour(latest?.gmtTimestamp),
    fetchedAt: index?.lastFetchedAt || latest?.fetchedAt || null,
    latestUg: latest?.ug ?? null,
    latestHourIndex: latest?.level ?? null,
    todayIndex: idx,
    triggerIndex: trigger?.index ?? null,
    triggerSinceHourUk: null,
    triggerSinceGmt,
    triggerSinceGmtLabel,
    triggerSinceHour: trigger?.sinceHour ?? null, // GMT hour in JSON / state
    previousUg: state.previousHour?.[key] ?? null,
    previousDataHourUk: prevUk,
    previousGmtLabel: formatGmtHour(prevGmt),
    hours,
    chartMax,
    triggerRows: triggerRowsFor(key),
    triggerTableKind: key === 'no2' ? 'daqi' : 'erg',
    hourHistory,
  };
}

export function formatHourLabel(h) {
  return `${String(h).padStart(2, '0')}:00`;
}

/** Y-max slightly above the series peak, snapped to a readable tick. */
export function niceChartMax(dataMax) {
  const peak = Math.max(Number(dataMax) || 0, 1);
  const padded = peak * 1.2; // ~20% headroom
  if (padded <= 5) return 5;
  if (padded <= 10) return 10;
  if (padded <= 20) return Math.ceil(padded / 2) * 2;
  if (padded <= 50) return Math.ceil(padded / 5) * 5;
  if (padded <= 100) return Math.ceil(padded / 10) * 10;
  return Math.ceil(padded / 20) * 20;
}

/**
 * Interactive SVG line chart for hourly ug/m3 (x-axis = GMT hour labels).
 * Line segments and dots use activeIndex (Today index at that hour), not raw hour DAQI.
 */
export function hourlyLineChartHtml(hours, { chartMax = 100, highlightHour = null } = {}) {
  const W = 340;
  const H = 120;
  const padL = 28;
  const padR = 8;
  const padT = 10;
  const padB = 22;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const max = Math.max(chartMax || 1, 1);
  const n = Math.max(hours.length, 1);

  const pts = hours.map((h, i) => {
    const x = padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const gmtLabel = h.gmtLabel || formatGmtHour(h.gmtTimestamp) || formatHourLabel(h.hour);
    const chartIndex = h.activeIndex ?? h.level;
    const color = daqiColor(chartIndex) || '#2a6bb5';
    if (h.ug == null || Number.isNaN(h.ug)) {
      return { ...h, gmtLabel, chartIndex, color, x, y: null, i };
    }
    const y = padT + innerH - (h.ug / max) * innerH;
    return { ...h, gmtLabel, chartIndex, color, x, y, i };
  });

  const linePts = pts.filter((p) => p.y != null);
  const segments = [];
  for (let i = 0; i < linePts.length - 1; i++) {
    const a = linePts[i];
    const b = linePts[i + 1];
    segments.push(
      `<path d="M${a.x.toFixed(1)},${a.y.toFixed(1)} L${b.x.toFixed(1)},${b.y.toFixed(1)}" `
      + `fill="none" stroke="${a.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`,
    );
  }

  const yTicks = [0, 0.5, 1].map((t) => {
    const v = max * t;
    const y = padT + innerH - t * innerH;
    return `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#e8ebf0" stroke-width="1"/>
      <text x="${padL - 4}" y="${y + 3}" text-anchor="end" font-size="8" fill="#8a929e">${v < 10 ? v.toFixed(0) : Math.round(v)}</text>`;
  }).join('');

  // Label a few ticks with GMT hour of that sample
  const labelIdx = [0, 6, 12, 18].filter((i) => i < hours.length);
  if (!labelIdx.includes(hours.length - 1) && hours.length > 1) labelIdx.push(hours.length - 1);
  const xLabels = labelIdx.map((i) => {
    const x = padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const label = pts[i]?.gmtLabel || formatHourLabel(i);
    return `<text x="${x.toFixed(1)}" y="${H - 6}" text-anchor="middle" font-size="8" fill="#8a929e">${label}</text>`;
  }).join('');

  const dots = pts.filter((p) => p.y != null).map((p) => {
    const active = highlightHour === p.hour || highlightHour === p.gmtHour;
    const r = active ? 4 : 3;
    return `<circle class="ug-line__dot" data-i="${p.i}" data-hour="${p.hour}" data-gmt="${p.gmtLabel || ''}" data-ug="${p.ug}" data-level="${p.chartIndex ?? ''}"
      cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r}"
      fill="${active ? p.color : '#fff'}" stroke="${p.color}" stroke-width="1.5"/>`;
  }).join('');

  const payload = encodeURIComponent(JSON.stringify(pts.map((p) => ({
    hour: p.hour,
    gmtLabel: p.gmtLabel,
    ug: p.ug,
    level: p.chartIndex ?? p.level,
    x: p.x,
    y: p.y,
    gmt: p.gmtTimestamp,
    color: p.color,
  }))));

  return `
    <div class="ug-line" data-ug-line data-points="${payload}" data-unit="${UG_M3}">
      <svg class="ug-chart ug-chart--line" viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="Hourly ${UG_M3} (GMT)">
        ${yTicks}
        ${segments.join('')}
        ${dots}
        ${xLabels}
        <line class="ug-line__crosshair" x1="0" y1="${padT}" x2="0" y2="${padT + innerH}" stroke="#c8d0dc" stroke-width="1" stroke-dasharray="3 2" visibility="hidden"/>
      </svg>
      <div class="ug-line__tip" hidden></div>
    </div>`;
}

/** Bind hover tooltips on charts inserted into the DOM. */
export function bindHourlyLineCharts(root = document) {
  root.querySelectorAll('[data-ug-line]').forEach((wrap) => {
    if (wrap._bound) return;
    wrap._bound = true;
    const svg = wrap.querySelector('svg');
    const tip = wrap.querySelector('.ug-line__tip');
    const cross = wrap.querySelector('.ug-line__crosshair');
    const unit = wrap.dataset.unit || UG_M3;
    let points = [];
    try {
      points = JSON.parse(decodeURIComponent(wrap.dataset.points || '[]'));
    } catch {
      points = [];
    }

    const show = (p, clientX) => {
      if (!p || p.ug == null) {
        tip.hidden = true;
        cross.setAttribute('visibility', 'hidden');
        return;
      }
      const when = p.gmtLabel || (p.gmt ? formatGmtHour(p.gmt) : formatHourLabel(p.hour));
      tip.hidden = false;
      tip.innerHTML = `<strong>${when} GMT</strong> · ${formatUgDisplay(p.ug)} ${unit}`
        + (p.level != null && p.level !== '' ? ` · active DAQI ${p.level}` : '');
      const rect = wrap.getBoundingClientRect();
      const left = Math.min(Math.max(8, clientX - rect.left - 40), rect.width - 120);
      tip.style.left = `${left}px`;
      tip.style.top = '4px';
      cross.setAttribute('x1', p.x);
      cross.setAttribute('x2', p.x);
      cross.setAttribute('visibility', 'visible');
      wrap.querySelectorAll('.ug-line__dot').forEach((c) => {
        c.classList.toggle('is-hot', Number(c.dataset.hour) === p.hour);
      });
    };

    svg.addEventListener('mousemove', (ev) => {
      const rect = svg.getBoundingClientRect();
      const x = ((ev.clientX - rect.left) / rect.width) * 340;
      let best = null;
      let bestDist = Infinity;
      for (const p of points) {
        if (p.ug == null) continue;
        const d = Math.abs(p.x - x);
        if (d < bestDist) {
          bestDist = d;
          best = p;
        }
      }
      show(best, ev.clientX);
    });
    svg.addEventListener('mouseleave', () => {
      tip.hidden = true;
      cross.setAttribute('visibility', 'hidden');
      wrap.querySelectorAll('.ug-line__dot.is-hot').forEach((c) => c.classList.remove('is-hot'));
    });
  });
}

