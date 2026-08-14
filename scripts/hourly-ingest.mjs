#!/usr/bin/env node
/**
 * Hourly ingest → data/live/{YYYY-MM-DD}.json (+ index.json).
 *
 * Nowcast lag: floor(now → GMT hour) − 2h = data timestamp (e.g. 20:39Z → 18:00Z).
 * Day files keyed by UK-local date/hour via Europe/London.
 *
 * Cold start / --seed: one range fetch for UK days −3…today (through latest
 * data hour). Ongoing cron: fetch only that latest data hour.
 *
 * Active window: today + −1/−2/−3. Older day files move to data/live/_old/.
 *
 *   node scripts/hourly-ingest.mjs
 *   node scripts/hourly-ingest.mjs --seed
 *   node scripts/hourly-ingest.mjs --advance   # demo: next data hour
 *   EXPOSURE_API_KEY=… node scripts/hourly-ingest.mjs --live
 *   node scripts/hourly-ingest.mjs --live --gcs   # Cloud Run / GCS (hourly only; no --seed)
 */
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { emptyTriggerState, ukLocalParts, replayDay } from '../js/today-calc.js';
import { resolveLiveStorage } from '../js/live-storage.js';
import {
  DEFAULT_LAT,
  DEFAULT_LNG,
  DEFAULT_PATIENT,
  addDateKeyDays,
  latestDataHour,
  DATA_LAG_HOURS,
  ukMidnightUtc,
  ukHourStartUtc,
  emptyHourly,
  emptyDayFile,
  lastFilledHour,
  summarizeDay,
  keptDateKeys,
} from '../js/live-store.js';
import {
  LONDON_AIR_FORECAST_URL,
  parseLondonAirPayload,
  pickFutureForecast,
  buildStoredForecast,
} from '../js/london-air-forecast.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

/** Load repo-root .env if present; does not override existing process.env. */
function loadLocalEnv() {
  const envPath = join(root, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"'))
      || (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === '') process.env[key] = val;
  }
}
loadLocalEnv();

const live = process.argv.includes('--live');
const seed = process.argv.includes('--seed') || process.argv.includes('--reset');
const advance = process.argv.includes('--advance');
const gcs = process.argv.includes('--gcs');

if (gcs && seed) {
  console.error('Refusing --seed with --gcs (production is hourly ongoing only).');
  process.exit(1);
}

function siteCoords() {
  return {
    lat: Number(process.env.LAT || DEFAULT_LAT),
    lng: Number(process.env.LNG || DEFAULT_LNG),
  };
}

function sitePatient() {
  return {
    name: process.env.PATIENT_NAME || DEFAULT_PATIENT.name,
    address: process.env.PATIENT_ADDRESS || DEFAULT_PATIENT.address,
    place: process.env.PLACE || DEFAULT_PATIENT.place,
  };
}

function demoHourlySeries() {
  return {
    no2: [32, 28, 26, 24, 30, 48, 72, 98, 142, 188, 165, 118, 88, 76, 70, 64, 58, 52, 48, 44, 40, 38, 36, 34],
    pm25: [9, 8, 8, 7, 8, 10, 12, 14, 22, 51, 54, 49, 40, 28, 20, 16, 14, 12, 11, 10, 10, 9, 9, 8],
    pm10: [16, 15, 14, 13, 15, 18, 22, 28, 40, 70, 75, 70, 55, 40, 30, 24, 20, 18, 16, 15, 15, 14, 14, 14],
    o3: [48, 46, 44, 42, 45, 50, 55, 70, 100, 108, 112, 110, 95, 80, 70, 62, 58, 55, 52, 50, 48, 46, 45, 44],
  };
}

/** Shifted demo series per past day so −1/−2/−3 look distinct. */
function demoSeriesForOffset(offset) {
  const base = demoHourlySeries();
  const factor = 1 - offset * 0.08;
  const out = {};
  for (const sp of Object.keys(base)) {
    out[sp] = base[sp].map((v) => Math.round(v * factor * 10) / 10);
  }
  return out;
}

function dayFileName(dateKey) {
  return `${dateKey}.json`;
}

async function readDay(storage, dateKey) {
  return (await storage.readJson(dayFileName(dateKey))) || emptyDayFile(dateKey);
}

async function writeDay(storage, day) {
  const summary = summarizeDay(day);
  day.dailyMeans = summary.dailyMeans;
  day.dayMaxDaqi = summary.dayMaxDaqi;
  const filled = lastFilledHour(day.hourly);
  // Complete past day when we have hour 23
  day.complete = filled >= 23;
  await storage.writeJson(dayFileName(day.ukDateKey), day);
  return day;
}

async function readIndex(storage) {
  return storage.readJson('index.json');
}

async function writeIndex(storage, index) {
  await storage.writeJson('index.json', index);
}

async function archiveStaleDays(storage, todayKey) {
  const keep = new Set(keptDateKeys(todayKey));
  const oldestKeep = addDateKeyDays(todayKey, -3);
  for (const key of await storage.listDayFileKeys()) {
    if (keep.has(key)) continue;
    if (key >= oldestKeep) continue;
    await storage.archiveDay(key);
    console.log(`Archived ${key}.json → live/_old/`);
  }
}

const EXPOSURE_BASE = 'https://swift-exposure-357937791793.europe-west2.run.app/exposure/london';

/**
 * Fetch London Air Future forecast (widget Tomorrow panel).
 * ForecastID increments when ERG publishes a new outlook (not always +1).
 */
async function refreshForecast(storage, ukNow, previousForecast = null) {
  try {
    const res = await fetch(LONDON_AIR_FORECAST_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rawText = await res.text();
    const payload = parseLondonAirPayload(rawText);
    await storage.writeJson('forecast-last-raw.json', payload);
    const future = pickFutureForecast(payload);
    if (!future) throw new Error('response missing ForecastType Future');
    const tomorrowKey = addDateKeyDays(ukNow.dateKey, 1);
    const stored = buildStoredForecast(future, tomorrowKey);
    if (!stored) throw new Error('Future entry missing ForecastBand');
    if (
      previousForecast?.forecastId != null
      && stored.forecastId != null
      && stored.forecastId > previousForecast.forecastId
    ) {
      console.log(
        `London Air Future forecast updated: ID ${stored.forecastId} `
        + `(was ${previousForecast.forecastId}) · ${stored.band}`,
      );
    }
    return { stored, error: null };
  } catch (err) {
    console.warn('London Air forecast fetch failed:', err.message);
    return { stored: previousForecast || null, error: err.message };
  }
}

/** /coord timestamp param: 2026-08-11T15:00:00Z */
function formatCoordTimestamp(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Multi-hour → /coords?from&to
 * Single hour → /coord?timestamp&weighted=true
 */
async function fetchExposure(from, to, { singleHour = false } = {}) {
  const key = process.env.EXPOSURE_API_KEY;
  if (!key) throw new Error('EXPOSURE_API_KEY required for --live');
  const { lat, lng } = siteCoords();
  const path = singleHour ? 'coord' : 'coords';
  const url = new URL(`${EXPOSURE_BASE}/${path}`);
  url.searchParams.set('key', key);
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lng', String(lng));
  // Match service examples (uppercase species list)
  url.searchParams.set('species', singleHour ? 'NO2,PM10,PM25,O3' : 'no2,pm10,pm25,o3');
  if (singleHour) {
    url.searchParams.set('timestamp', formatCoordTimestamp(from));
    url.searchParams.set('weighted', 'true');
  } else {
    url.searchParams.set('from', from.toISOString());
    url.searchParams.set('to', to.toISOString());
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Exposure HTTP ${res.status} (${path})`);
  return res.json();
}

/**
 * Parse /coords range payload. Timestamps are GMT hour-start → UK-local date+hour.
 * Annual means from species `value`; hourly from `nowcast_value`.
 */
function parseCoordsPayload(payload) {
  let rows = Array.isArray(payload)
    ? payload
    : payload?.hours || payload?.data || payload?.results || null;
  if (!rows && payload && (payload.timestamp || payload.time || payload.datetime)) {
    rows = [payload];
  }
  if (!Array.isArray(rows) || !rows.length) {
    throw new Error('Unexpected /coords payload — see data/live/exposure-last-raw.json');
  }

  const byKey = new Map();
  const annual = {};
  let annualYear = null;

  for (const row of rows) {
    const ts = row.timestamp || row.time || row.datetime;
    if (!ts) continue;
    const iso = /Z|[+-]\d{2}:?\d{2}$/.test(String(ts)) ? String(ts) : `${String(ts).replace(/ ?GMT$/i, '')}Z`;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) continue;
    const parts = ukLocalParts(d);
    const map = {};
    const results = row.results || row.species || [];
    if (Array.isArray(results)) {
      for (const r of results) {
        const sp = String(r.species || r.name || r.pollutant || '').toLowerCase().replace('pm2.5', 'pm25');
        const key = sp === 'pm2.5' ? 'pm25' : sp;
        if (!['pm25', 'pm10', 'no2', 'o3'].includes(key)) continue;
        map[key] = r.nowcast_value ?? r.nowcast ?? null;
        if (r.value != null && annual[key] == null) annual[key] = r.value;
        if (r.data_map_start != null && annualYear == null) {
          annualYear = Number(String(r.data_map_start).slice(0, 4)) || null;
        }
      }
    } else if (typeof results === 'object') {
      for (const key of ['pm25', 'pm10', 'no2', 'o3']) {
        const r = results[key] || results[key === 'pm25' ? 'pm2.5' : key];
        if (r == null) continue;
        if (typeof r === 'number') {
          map[key] = r;
        } else {
          map[key] = r.nowcast_value ?? r.nowcast ?? null;
          if (r.value != null && annual[key] == null) annual[key] = r.value;
          if (r.data_map_start != null && annualYear == null) {
            annualYear = Number(String(r.data_map_start).slice(0, 4)) || null;
          }
        }
      }
    }
    const hasHourly = Object.values(map).some((v) => v != null);
    if (!hasHourly) continue;
    byKey.set(`${parts.dateKey}|${parts.hour}`, {
      ...map,
      gmtTimestamp: d.toISOString(),
      ukDateKey: parts.dateKey,
      hour: parts.hour,
    });
  }

  const annualOut = ['pm25', 'pm10', 'no2', 'o3'].every((k) => annual[k] != null) ? annual : null;
  return { samples: byKey, annual: annualOut, annualYear };
}

/**
 * Parse /coord single-hour payload.
 *
 * Expected (healthy) shape includes top-level timestamp + data_map_start, and per species:
 *   value        → annual mean at lat/lng
 *   nowcast_value → hourly nowcast for that timestamp
 *
 * If nowcast_value is missing (recent API quirk), do NOT treat value as hourly —
 * leave the hour empty so we never store annual means as nowcast.
 */
function parseCoordPayload(payload, gmtHourStart) {
  const results = payload?.results;
  if (!Array.isArray(results) || !results.length) {
    throw new Error('Unexpected /coord payload — see data/live/exposure-last-raw.json');
  }

  const tsRaw = payload.timestamp || payload.time || payload.datetime;
  let d;
  if (tsRaw) {
    const iso = /Z|[+-]\d{2}:?\d{2}$/.test(String(tsRaw))
      ? String(tsRaw)
      : `${String(tsRaw).replace(/ ?GMT$/i, '')}Z`;
    d = new Date(iso);
  } else {
    d = gmtHourStart instanceof Date ? gmtHourStart : new Date(gmtHourStart);
  }
  if (Number.isNaN(d.getTime())) {
    throw new Error('Could not resolve /coord timestamp');
  }

  const parts = ukLocalParts(d);
  const map = {};
  const annual = {};
  let nowcastCount = 0;

  for (const r of results) {
    const sp = String(r.species || r.name || '').toLowerCase().replace('pm2.5', 'pm25');
    const key = sp === 'pm2.5' ? 'pm25' : sp;
    if (!['pm25', 'pm10', 'no2', 'o3'].includes(key)) continue;
    if (r.value != null) annual[key] = r.value;
    if (r.nowcast_value != null || r.nowcast != null) {
      map[key] = r.nowcast_value ?? r.nowcast;
      nowcastCount += 1;
    }
  }

  let annualYear = null;
  if (payload.data_map_start != null) {
    annualYear = Number(String(payload.data_map_start).slice(0, 4)) || null;
  }

  const annualOut = ['pm25', 'pm10', 'no2', 'o3'].every((k) => annual[k] != null) ? annual : null;
  const byKey = new Map();

  if (nowcastCount === 0) {
    console.warn(
      ` /coord ${d.toISOString()} returned no nowcast_value (only annual value) — hour not written.`,
    );
    return { samples: byKey, annual: annualOut, annualYear, missingNowcast: true };
  }

  byKey.set(`${parts.dateKey}|${parts.hour}`, {
    ...map,
    gmtTimestamp: d.toISOString(),
    ukDateKey: parts.dateKey,
    hour: parts.hour,
  });
  return { samples: byKey, annual: annualOut, annualYear, missingNowcast: false };
}

function applySampleToDay(day, sample, fetchedAt) {
  const h = sample.hour;
  day.hourly.pm25[h] = sample.pm25;
  day.hourly.pm10[h] = sample.pm10;
  day.hourly.no2[h] = sample.no2;
  day.hourly.o3[h] = sample.o3;
  day.hourMeta[h] = {
    hour: h,
    ukDateKey: day.ukDateKey,
    gmtTimestamp: sample.gmtTimestamp || ukHourStartUtc(day.ukDateKey, h, ukLocalParts).toISOString(),
    fetchedAt,
    sample: {
      pm25: sample.pm25,
      pm10: sample.pm10,
      no2: sample.no2,
      o3: sample.o3,
    },
  };
}

function recomputeTodayState(day) {
  const filled = lastFilledHour(day.hourly);
  if (filled < 0) {
    day.previousHour = null;
    day.triggers = emptyTriggerState();
    day.indexes = null;
    day.todayLevel = null;
    return day;
  }
  const { state } = replayDay(day.hourly, {
    asOfHour: filled + 1,
    ukDateKey: day.ukDateKey,
    hourMeta: day.hourMeta,
  });
  day.previousHour = state.previousHour;
  day.triggers = state.triggers;
  day.indexes = state.indexes;
  day.todayLevel = state.todayLevel;
  return day;
}

function demoSample(dateKey, hour, offsetFromToday) {
  const series = demoSeriesForOffset(Math.max(0, offsetFromToday));
  const gmt = ukHourStartUtc(dateKey, hour, ukLocalParts);
  return {
    ukDateKey: dateKey,
    hour,
    pm25: series.pm25[hour],
    pm10: series.pm10[hour],
    no2: series.no2[hour],
    o3: series.o3[hour],
    gmtTimestamp: gmt.toISOString(),
  };
}

/**
 * Build list of {dateKey, hour} to write.
 * Seed: every hour from −3 midnight through latest data hour.
 * Ongoing: only the latest data hour (or --advance next missing).
 */
function hoursNeeded({ todayKey, dataTarget, index, forceSeed, hourlyOnly = false }) {
  // hourlyOnly (GCS production): never backfill — one latest data hour even on empty bucket
  if (!hourlyOnly && (forceSeed || !index?.seeded)) {
    const out = [];
    for (let off = 3; off >= 0; off--) {
      const key = addDateKeyDays(todayKey, -off);
      const lastH = key === dataTarget.dateKey ? dataTarget.hour : 23;
      // Today (or the day that holds latest data): only through data hour
      const end = key > dataTarget.dateKey ? -1 : key === dataTarget.dateKey ? dataTarget.hour : lastH;
      for (let h = 0; h <= end; h++) out.push({ dateKey: key, hour: h });
    }
    return { mode: 'seed', hours: out };
  }

  if (advance) {
    // Demo stepping: next missing hour after lastData (may run ahead of real −2h lag).
    const last = index.lastData;
    if (!last) return { mode: 'seed', hours: hoursNeeded({ todayKey, dataTarget, index: null, forceSeed: true }).hours };
    let nextKey = last.ukDateKey;
    let nextHour = last.hour + 1;
    if (nextHour > 23) {
      nextHour = 0;
      nextKey = addDateKeyDays(nextKey, 1);
    }
    if (nextKey > todayKey) {
      return { mode: 'noop', hours: [] };
    }
    // Cap demo advance at end of today (don't invent tomorrow)
    if (nextKey === todayKey && nextHour > 23) {
      return { mode: 'noop', hours: [] };
    }
    return { mode: 'advance', hours: [{ dateKey: nextKey, hour: nextHour }] };
  }

  return { mode: 'latest', hours: [{ dateKey: dataTarget.dateKey, hour: dataTarget.hour }] };
}

/**
 * @param {{ storage?: import('../js/live-storage.js').LiveStorage, live?: boolean, seed?: boolean, advance?: boolean, gcs?: boolean }} [opts]
 */
export async function runHourlyIngest(opts = {}) {
  const useLive = opts.live ?? live;
  const useSeed = opts.seed ?? seed;
  const useAdvance = opts.advance ?? advance;
  const useGcs = opts.gcs ?? gcs;
  if (useGcs && useSeed) {
    throw new Error('Refusing seed with GCS (production is hourly ongoing only).');
  }

  const storage = opts.storage ?? await resolveLiveStorage({ root, gcs: useGcs });
  await storage.ensureReady();
  console.log(`Live storage: ${storage.label} (${storage.kind})`);

  const ukNow = ukLocalParts();
  const dataTarget = latestDataHour(new Date(), ukLocalParts);
  let index = useSeed ? null : await readIndex(storage);
  const hourlyOnly = useGcs && !useSeed;
  const forceSeed = useSeed || (!hourlyOnly && !index?.seeded);

  let source = useLive ? 'exposure-live' : 'demo-cron';
  let note = '';
  let sampleMap = null;
  let annualFromApi = null;
  let annualYearFromApi = null;

  const plan = hoursNeeded({
    todayKey: ukNow.dateKey,
    dataTarget,
    index,
    forceSeed,
    hourlyOnly,
  });

  const { stored: forecastStored } = await refreshForecast(storage, ukNow, index?.forecast);

  if (plan.mode === 'noop') {
    const indexKeep = (await readIndex(storage)) || {};
    await writeIndex(storage, {
      ...indexKeep,
      patient: sitePatient(),
      lat: siteCoords().lat,
      lng: siteCoords().lng,
      forecast: forecastStored,
      lastFetchedAt: new Date().toISOString(),
      wallClockUk: { dateKey: ukNow.dateKey, hour: ukNow.hour },
    });
    console.log(
      `Nothing to ingest — already at data hour ${dataTarget.dateKey} `
      + `${String(dataTarget.hour).padStart(2, '0')}:00 UK `
      + `(${dataTarget.gmtTimestamp} = GMT floor ${dataTarget.gmtFloor} − ${DATA_LAG_HOURS}h); `
      + `Forecast ${forecastStored?.band ?? '—'} (Future ID ${forecastStored?.forecastId ?? '—'})`,
    );
    return { mode: 'noop', forecast: forecastStored };
  }

  if (useLive) {
    try {
      const first = plan.hours[0];
      const last = plan.hours[plan.hours.length - 1];
      const from = ukHourStartUtc(first.dateKey, first.hour, ukLocalParts);
      const to = new Date(ukHourStartUtc(last.dateKey, last.hour, ukLocalParts).getTime() + 3599 * 1000);
      const singleHour = plan.hours.length === 1;
      const raw = await fetchExposure(from, to, { singleHour });
      await storage.writeJson('exposure-last-raw.json', raw);
      const parsed = singleHour
        ? parseCoordPayload(raw, from)
        : parseCoordsPayload(raw);
      sampleMap = parsed.samples;
      annualFromApi = parsed.annual;
      annualYearFromApi = parsed.annualYear;
      if (parsed.missingNowcast) {
        note = `Latest data hour ${dataTarget.gmtTimestamp} — /coord returned annual value only (no nowcast_value); hour not written.`;
      } else {
        note = plan.mode === 'seed'
          ? `Seeded −3…today through ${dataTarget.gmtTimestamp} (${sampleMap.size} GMT hours parsed).`
          : `Latest data hour ${dataTarget.gmtTimestamp} `
            + `(GMT floor ${dataTarget.gmtFloor} − ${DATA_LAG_HOURS}h; `
            + `UK ${dataTarget.dateKey} ${String(dataTarget.hour).padStart(2, '0')}:00).`;
      }
    } catch (err) {
      console.warn('Live fetch failed, falling back to demo:', err.message);
      source = 'demo-cron';
      note = `Live fetch failed (${err.message}); demo data used.`;
      sampleMap = null;
    }
  } else {
    note = plan.mode === 'seed'
      ? `Demo seed −3…today through data hour ${dataTarget.dateKey} ${String(dataTarget.hour).padStart(2, '0')}:00.`
      : `Demo data hour ${dataTarget.gmtTimestamp} (GMT floor − ${DATA_LAG_HOURS}h).`;
  }

  const fetchedAt = new Date().toISOString();
  const touched = new Map();
  const writtenHours = [];
  const skippedMissing = [];

  for (const { dateKey, hour } of plan.hours) {
    const offset = Math.round((Date.parse(`${ukNow.dateKey}T00:00:00Z`) - Date.parse(`${dateKey}T00:00:00Z`)) / 86400000);
    let sample = sampleMap?.get(`${dateKey}|${hour}`);
    if (!sample) {
      // Never mix demo concentrations into a live run — leave the hour empty.
      if (useLive && source === 'exposure-live') {
        skippedMissing.push(`${dateKey}|${hour}`);
        continue;
      }
      sample = demoSample(dateKey, hour, offset);
    } else {
      sample = { ...sample, ukDateKey: dateKey, hour };
    }

    let day = touched.get(dateKey) || await readDay(storage, dateKey);
    applySampleToDay(day, sample, fetchedAt);
    touched.set(dateKey, day);
    writtenHours.push({ dateKey, hour });
  }

  if (useLive && source === 'exposure-live' && skippedMissing.length) {
    console.warn(`Live payload missing ${skippedMissing.length} hour(s); left empty (no demo fill): ${skippedMissing.slice(-5).join(', ')}${skippedMissing.length > 5 ? '…' : ''}`);
  }

  if (!writtenHours.length) {
    console.log('No hours written this run.');
    const indexKeep = (await readIndex(storage)) || {};
    await writeIndex(storage, {
      ...indexKeep,
      patient: sitePatient(),
      lat: siteCoords().lat,
      lng: siteCoords().lng,
      source,
      forecast: forecastStored,
      note: `${note} No new hours available yet.`,
      lastFetchedAt: fetchedAt,
      wallClockUk: { dateKey: ukNow.dateKey, hour: ukNow.hour },
    });
    console.log(
      `Forecast ${forecastStored?.band ?? '—'} (Future ID ${forecastStored?.forecastId ?? '—'})`,
    );
    return { mode: 'no-hours', forecast: forecastStored };
  }

  // Recompute Today state for today's file; summarize all touched
  for (const [dateKey, day] of touched) {
    if (dateKey === ukNow.dateKey) recomputeTodayState(day);
    else {
      // Past days: no Today triggers — still useful to leave null triggers
      day.triggers = null;
      day.indexes = null;
      day.todayLevel = null;
      day.previousHour = null;
    }
    await writeDay(storage, day);
  }

  // Ensure empty stubs exist for kept days not yet touched
  for (const key of keptDateKeys(ukNow.dateKey)) {
    if (!(await storage.exists(dayFileName(key)))) await writeDay(storage, emptyDayFile(key));
  }

  await archiveStaleDays(storage, ukNow.dateKey);

  const todayDay = await readDay(storage, ukNow.dateKey);
  // If today was not in touched but we need recompute after archive — ok
  if (touched.has(ukNow.dateKey)) {
    // already written
  } else if (lastFilledHour(todayDay.hourly) >= 0) {
    await writeDay(storage, recomputeTodayState(todayDay));
  }

  const lastHour = writtenHours[writtenHours.length - 1];
  const nextIndex = {
    patient: sitePatient(),
    lat: siteCoords().lat,
    lng: siteCoords().lng,
    source,
    note: skippedMissing.length
      ? `${note} Skipped ${skippedMissing.length} hour(s) not yet in API.`
      : note,
    seeded: true,
    lastFetchedAt: fetchedAt,
    lastData: {
      ukDateKey: lastHour.dateKey,
      hour: lastHour.hour,
      gmtTimestamp: ukHourStartUtc(lastHour.dateKey, lastHour.hour, ukLocalParts).toISOString(),
    },
    wallClockUk: { dateKey: ukNow.dateKey, hour: ukNow.hour },
    dataLagHours: DATA_LAG_HOURS,
    keptDays: keptDateKeys(ukNow.dateKey),
    todayLevel: (await readDay(storage, ukNow.dateKey)).todayLevel,
    annual: annualFromApi || index?.annual || null,
    annualYear: annualYearFromApi || index?.annualYear || null,
    forecast: forecastStored,
  };
  await writeIndex(storage, nextIndex);

  console.log(
    `${plan.mode === 'seed' ? 'Seeded' : 'Updated'} ${writtenHours.length} data hour(s); `
    + `last data ${lastHour.dateKey} ${String(lastHour.hour).padStart(2, '0')}:00 UK `
    + `(GMT ${nextIndex.lastData.gmtTimestamp}); Today DAQI ${nextIndex.todayLevel ?? '—'}; `
    + `Forecast ${forecastStored?.band ?? '—'} (Future ID ${forecastStored?.forecastId ?? '—'})`,
  );

  return {
    mode: plan.mode,
    hoursWritten: writtenHours.length,
    lastData: nextIndex.lastData,
    todayLevel: nextIndex.todayLevel,
    forecast: forecastStored,
    storage: storage.label,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runHourlyIngest().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
