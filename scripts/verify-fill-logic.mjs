/**
 * Unit-style audit of level-based fill logic via rendered HTML.
 * Run: node scripts/verify-fill-logic.mjs
 *
 * 3.5 pill bars: segment ON/OFF is set in who-recent-v35.js (level <= maxLevel).
 * Visual bottom-up order in the Meets WHO zone requires .who-caqi-zone--below { column-reverse } in CSS.
 */
import { mockPatientExposure, recentDaysForV33, recentDaysForLadder, daqiLevel, forecastBandToDaqi } from '../js/air-quality.js';
import { daqiStackedBar, daqiCircleStack, forecastCardHtml } from '../js/widget-render.js';
import { whoCircleStack } from '../js/who-recent-v34.js';
import { caqiWhoPillBar } from '../js/who-recent-v35.js';
import { recentDaysForV34, forecastForV34 } from '../js/who-data-v34.js';
import { recentDaysForV35, forecastForV35 } from '../js/who-data-v35.js';
import { caqiLevel } from '../js/who-caqi-v35.js';

const GREY = '#eceef2';
const species = 'pm25';

function segOn(html, idx, inactive = GREY) {
  const re = new RegExp(`class="[^"]*seg[^"]*"[^>]*style="[^"]*background:([^";]+)`, 'g');
  const matches = [...html.matchAll(re)];
  if (idx > matches.length) return null;
  const bg = matches[idx - 1][1];
  return bg.toLowerCase() !== inactive.toLowerCase();
}

function auditDaqiBar(level) {
  const html = daqiStackedBar(level);
  const results = [];
  for (let i = 1; i <= 10; i++) {
    const on = segOn(html, i);
    results.push({ i, on, expect: i <= level });
  }
  return { ok: results.every((r) => r.on === r.expect), results, level };
}

function auditDaqiCircles(level) {
  const html = daqiCircleStack(level);
  const dots = [...html.matchAll(/daqi-circle-dot([^"]*)" data-level="(\d+)"/g)];
  const results = dots.map((m) => {
    const idx = Number(m[2]);
    const on = m[1].includes('--on');
    return { idx, on, expect: idx <= level };
  });
  return { ok: results.every((r) => r.on === r.expect), results, level };
}

function auditWhoCircles(dailyMean, speciesKey) {
  const level = caqiLevel(dailyMean, speciesKey);
  const html = whoCircleStack(dailyMean, speciesKey);
  const dots = [...html.matchAll(/who-circle-dot([^"]*)" data-level="(\d+)"/g)];
  const results = dots.map((m) => {
    const idx = Number(m[2]);
    const on = m[1].includes('--on');
    return { idx, on, expect: level != null && idx <= level };
  });
  return { ok: results.every((r) => r.on === r.expect), results, level };
}

function auditCaqiPill(dailyMean, speciesKey) {
  const level = caqiLevel(dailyMean, speciesKey);
  const html = caqiWhoPillBar(dailyMean, speciesKey);
  const belowHtml = html.match(/who-caqi-zone--below">([\s\S]*?)<\/div>/)?.[1] ?? '';
  const aboveHtml = html.match(/who-caqi-zone--above">([\s\S]*?)<\/div>/)?.[1] ?? '';
  const parseZone = (chunk) => [...chunk.matchAll(/who-caqi-seg([^"]*)"[^>]*background:([^"]+)/g)].map((m) => m[1].includes('--on'));
  const belowOn = parseZone(belowHtml);
  const aboveOn = parseZone(aboveHtml);
  const levels = [];
  belowOn.forEach((on, i) => levels.push({ level: i + 1, on }));
  aboveOn.forEach((on, i) => levels.push({ level: 13 - i, on }));
  levels.sort((a, b) => a.level - b.level);
  const ok = level != null && levels.every((r) => (r.level <= level ? r.on : !r.on));
  return { ok, levels, level };
}

const data = mockPatientExposure();
const report = {};

// 3.0–3.2 DAQI ladders (Recent)
const ladderDays = recentDaysForLadder(data.recentDays);
report['3.0–3.2 DAQI ladder Recent'] = ladderDays.map((d) => {
  const lv = daqiLevel(d.daily.pm25, species);
  return { offset: d.offset, ...auditDaqiBar(lv) };
});

// 3.0–3.2 Forecast
const fcLevel = forecastBandToDaqi(data.forecast.band);
report['3.0–3.2 DAQI ladder Forecast'] = [{ band: data.forecast.band, ...auditDaqiBar(fcLevel) }];

// 3.3 circles
const v33Days = recentDaysForV33(data.recentDays);
report['3.3 DAQI circles Recent'] = v33Days.map((d) => {
  const lv = daqiLevel(d.daily.pm25, species);
  return { offset: d.offset, ...auditDaqiCircles(lv) };
});
report['3.3 DAQI circles Forecast'] = [{ band: data.forecast.band, ...auditDaqiCircles(fcLevel) }];

// 3.4 who circles
const v34Days = recentDaysForV34(data.recentDays);
const v34Fc = forecastForV34(data.forecast);
report['3.4 WHO circles Recent'] = v34Days.map((d) => ({
  offset: d.offset,
  ...auditWhoCircles(d.daily.pm25, species),
}));
report['3.4 WHO circles Forecast'] = [{
  ...auditWhoCircles(v34Fc.daily.pm25, species),
}];

// 3.5 caqi pills
const v35Days = recentDaysForV35(data.recentDays);
const v35Fc = forecastForV35(data.forecast);
report['3.5 CAQI pills Recent'] = v35Days.map((d) => ({
  offset: d.offset,
  ...auditCaqiPill(d.daily.pm25, species),
}));
report['3.5 CAQI pills Forecast'] = [{
  ...auditCaqiPill(v35Fc.daily.pm25, species),
}];

let allOk = true;
for (const [key, rows] of Object.entries(report)) {
  const ok = rows.every((r) => r.ok);
  console.log(`${key}: ${ok ? 'OK' : 'FAIL'}`);
  if (!ok) {
    allOk = false;
    rows.filter((r) => !r.ok).forEach((r) => console.log(' ', JSON.stringify(r)));
  }
}
process.exit(allOk ? 0 : 1);
