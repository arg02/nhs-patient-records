/**
 * Live day-file store helpers — shared by ingest (Node) and live.html (browser).
 *
 * Nowcast lag (GMT): floor(now → GMT hour start) − 2 hours.
 * Example: 21:39 BST = 20:39 GMT → floor 20:00Z → data hour 18:00Z.
 * Day files are still keyed by UK-local calendar date/hour via Europe/London.
 */

import {
  dailyMeanFromHourly,
  daqiLevel,
  daqiLevelForDay,
} from './air-quality.js';

export const DEFAULT_LAT = 51.51582459205555;
export const DEFAULT_LNG = -0.22380761638931398;
export const DEFAULT_PATIENT = {
  name: 'ERG',
  address: 'Uren Building',
  place: 'Uren Building',
};

export const DATA_LAG_HOURS = 2;

/** Parse YYYY-MM-DD and add calendar days (civil date, not UTC ms). */
export function addDateKeyDays(dateKey, delta) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Latest available nowcast hour.
 * @param {Date} [now]
 * @param {(d: Date) => { dateKey: string, hour: number }} ukLocalPartsFn
 * @returns {{ dateKey: string, hour: number, gmtTimestamp: string, gmtHour: number, gmtFloor: string }}
 */
export function latestDataHour(now = new Date(), ukLocalPartsFn) {
  const gmtFloorMs = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    now.getUTCHours(),
    0, 0, 0,
  );
  const dataGmt = new Date(gmtFloorMs - DATA_LAG_HOURS * 3600 * 1000);
  const uk = ukLocalPartsFn
    ? ukLocalPartsFn(dataGmt)
    : {
      // Fallback: treat GMT as UK (winter only) — callers should pass ukLocalParts
      dateKey: dataGmt.toISOString().slice(0, 10),
      hour: dataGmt.getUTCHours(),
    };
  return {
    dateKey: uk.dateKey,
    hour: uk.hour,
    gmtTimestamp: dataGmt.toISOString(),
    gmtHour: dataGmt.getUTCHours(),
    gmtFloor: new Date(gmtFloorMs).toISOString(),
  };
}

/** UTC Instant for UK-local midnight on dateKey (handles GMT/BST). */
export function ukMidnightUtc(dateKey, ukLocalPartsFn) {
  const [y, m, d] = dateKey.split('-').map(Number);
  for (let offsetH = -3; offsetH <= 3; offsetH++) {
    const cand = new Date(Date.UTC(y, m - 1, d, offsetH, 0, 0));
    const p = ukLocalPartsFn(cand);
    if (p.dateKey === dateKey && p.hour === 0) return cand;
  }
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
}

/** UTC Instant for the start of a UK-local hour (GMT/BST aware). */
export function ukHourStartUtc(dateKey, hour, ukLocalPartsFn) {
  const mid = ukMidnightUtc(dateKey, ukLocalPartsFn);
  for (let h = 0; h < 48; h++) {
    const cand = new Date(mid.getTime() + h * 3600 * 1000);
    const p = ukLocalPartsFn(cand);
    if (p.dateKey === dateKey && p.hour === hour) return cand;
  }
  return new Date(mid.getTime() + hour * 3600 * 1000);
}

export function emptyHourly() {
  return {
    no2: Array(24).fill(null),
    pm25: Array(24).fill(null),
    pm10: Array(24).fill(null),
    o3: Array(24).fill(null),
  };
}

export function emptyDayFile(ukDateKey, extras = {}) {
  return {
    ukDateKey,
    hourly: emptyHourly(),
    /** Per-hour provenance: data hour (UK) + GMT timestamp from service + when we fetched */
    hourMeta: Array(24).fill(null),
    previousHour: null,
    triggers: null,
    indexes: null,
    todayLevel: null,
    /** Max overall DAQI across hours that have data (for completed past days). */
    dayMaxDaqi: null,
    dailyMeans: null,
    complete: false,
    ...extras,
  };
}

export function lastFilledHour(hourly) {
  const arr = hourly?.no2 || [];
  let last = -1;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] != null && !Number.isNaN(arr[i])) last = i;
  }
  return last;
}

/** Daily means + max hourly-overall DAQI for a day file. */
export function summarizeDay(day) {
  const daily = {};
  for (const sp of ['pm25', 'pm10', 'no2', 'o3']) {
    daily[sp] = dailyMeanFromHourly(day.hourly?.[sp] || []);
  }
  let dayMaxDaqi = 0;
  for (let h = 0; h < 24; h++) {
    const levels = ['pm25', 'pm10', 'no2', 'o3'].map((sp) =>
      daqiLevel(day.hourly?.[sp]?.[h], sp),
    );
    const overall = Math.max(0, ...levels.filter((x) => x != null));
    if (overall > dayMaxDaqi) dayMaxDaqi = overall;
  }
  const dayObj = { daily };
  const fromMeans = daqiLevelForDay(dayObj);
  return {
    dailyMeans: daily,
    dayMaxDaqi: dayMaxDaqi || null,
    daqiFromDailyMeans: fromMeans || null,
  };
}

/** Days to keep active: today and −1/−2/−3. */
export function keptDateKeys(todayKey) {
  return [0, 1, 2, 3].map((off) => addDateKeyDays(todayKey, -off)).reverse();
}
