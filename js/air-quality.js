/**
 * Air quality utilities — UK DAQI colours/thresholds from daqi-vs-caqi (colorScales.ts).
 * WHO annual guidelines for long-term comparison (separate from DAQI daily indexing).
 */

/** DAQI ladder — indices 1–10 (daqi-vs-caqi/src/utils/colorScales.ts) */
export const DAQI_COLORS = [
  '#A3CC7A', '#66A33E', '#2B8200', '#EEBF8F', '#FE994D',
  '#F46200', '#D80000', '#A30000', '#7A0000', '#000000',
];

/** Lower-bound thresholds (µg/m³) per DAQI index level 1–10 */
export const DAQI_THRESHOLDS = {
  pm25: [0, 12, 24, 36, 42, 48, 54, 59, 65, 71],
  no2: [0, 68, 135, 201, 268, 335, 401, 468, 535, 601],
  /** UK DEFRA daily bands — same colour ladder as PM2.5/NO2 in daqi-vs-caqi */
  pm10: [0, 17, 34, 51, 59, 67, 76, 85, 93, 102],
  o3: [0, 51, 101, 121, 141, 161, 181, 201, 221, 241],
};

/** Long-term bar colours — solid above WHO guideline, light fill below */
export const POLLUTANT_WHO_STYLES = {
  no2: { above: '#EBA602', below: '#FDF6E6' },
  pm10: { above: '#8000FF', below: '#F2E5FF' },
  pm25: { above: '#FF089A', below: '#FFE6F5' },
  o3: { above: '#0387E2', below: '#E5F3FC' },
};

export const WHO_ANNUAL = {
  no2: 10,
  o3: 60,
  pm10: 15,
  pm25: 5,
};

export const POLLUTANTS = [
  { key: 'pm25', label: 'PM₂.₅', daqiKey: 'pm25' },
  { key: 'pm10', label: 'PM₁₀', daqiKey: 'pm10' },
  { key: 'no2', label: 'NO₂', daqiKey: 'no2' },
  { key: 'o3', label: 'O₃', daqiKey: 'o3' },
];

/** CityAir forecast band → representative DAQI index level */
export const FORECAST_BAND_DAQI = {
  low: 3,
  moderate: 6,
  high: 9,
  veryhigh: 10,
  'very high': 10,
};

export function normalizeSpecies(key) {
  const k = key.toLowerCase().replace('pm2.5', 'pm25');
  return k === 'pm2.5' ? 'pm25' : k;
}

/** DAQI index level 1–10 for a daily mean concentration */
export function daqiLevel(value, species) {
  if (value == null || Number.isNaN(value)) return null;
  const sp = normalizeSpecies(species);
  const t = DAQI_THRESHOLDS[sp];
  if (!t) return null;
  let level = 1;
  for (let i = 0; i < t.length; i++) {
    if (value >= t[i]) level = i + 1;
    else break;
  }
  return level;
}

export function daqiColor(level) {
  if (level == null || level < 1) return '#999999';
  return DAQI_COLORS[Math.min(level - 1, 9)];
}

export function forecastBandToDaqi(band) {
  if (!band) return null;
  const key = band.toLowerCase().replace(/\s+/g, '');
  return FORECAST_BAND_DAQI[key] ?? FORECAST_BAND_DAQI[band.toLowerCase()] ?? null;
}

export function dailyMeanFromHourly(hourlyValues) {
  const valid = hourlyValues.filter((v) => v != null && !Number.isNaN(v));
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

export function whoAnnualComparison(annualMean, species) {
  const sp = normalizeSpecies(species);
  const who = WHO_ANNUAL[sp];
  if (annualMean == null || who == null) return null;
  const ratio = annualMean / who;
  const above = annualMean > who;
  return {
    who,
    ratio,
    above,
    label: above
      ? `${ratio.toFixed(1)}× WHO`
      : ratio >= 0.99 && ratio <= 1.01
        ? 'At WHO'
        : `${(1 - ratio).toFixed(0)}% below WHO`,
  };
}

/** Display ratio without "WHO" suffix (e.g. "3.6×") */
export function whoRatioShort(annualMean, species) {
  const cmp = whoAnnualComparison(annualMean, species);
  if (!cmp) return '—';
  if (cmp.above) return `${cmp.ratio.toFixed(1)}×`;
  if (cmp.ratio >= 0.99 && cmp.ratio <= 1.01) return 'At guideline';
  return `${cmp.ratio.toFixed(1)}×`;
}

export function formatDateChip(date) {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function sortedRecentDays(recentDays) {
  return [...recentDays].sort((a, b) => b.offset - a.offset);
}

/** Concept 2 demo — two moderate PM₂.₅ days (−3d, −2d) for DAQI legend variety */
export function recentDaysForConcept2(recentDays) {
  const moderatePm25 = { 3: 42, 2: 49 };
  return recentDays.map((d) => {
    const pm25 = moderatePm25[d.offset];
    if (pm25 == null) return d;
    return { ...d, daily: { ...d.daily, pm25 } };
  });
}

/** 3.0–3.2 demo — ascending DAQI levels across recent days (pm25 → levels 2, 4, 6, 8) */
export function recentDaysForLadder(recentDays) {
  const pm25ByOffset = { 3: 15, 2: 38, 1: 50, 0: 62 };
  return recentDays.map((d) => {
    const pm25 = pm25ByOffset[d.offset];
    if (pm25 == null) return d;
    return { ...d, daily: { ...d.daily, pm25 } };
  });
}

/** 3.3 demo — varied DAQI levels across recent days (pm25 → levels 2, 5, 7, 9) */
export function recentDaysForV33(recentDays) {
  const pm25ByOffset = { 3: 15, 2: 45, 1: 56, 0: 68 };
  return recentDays.map((d) => {
    const pm25 = pm25ByOffset[d.offset];
    if (pm25 == null) return d;
    return { ...d, daily: { ...d.daily, pm25 } };
  });
}

export function mockPatientExposure() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const buildHourly = (base, variance, hours = 24) => {
    const out = [];
    for (let h = 0; h < hours; h++) {
      const wobble = Math.sin(h / 3) * variance + (Math.random() - 0.5) * variance * 0.4;
      out.push(Math.max(0, base + wobble));
    }
    return out;
  };

  const recentDays = [
    { offset: 3, pm25: buildHourly(22, 4), pm10: buildHourly(38, 6), no2: buildHourly(28, 5), o3: buildHourly(72, 8) },
    { offset: 2, pm25: buildHourly(31, 5), pm10: buildHourly(48, 7), no2: buildHourly(42, 6), o3: buildHourly(88, 10) },
    { offset: 1, pm25: buildHourly(18, 3), pm10: buildHourly(32, 5), no2: buildHourly(24, 4), o3: buildHourly(65, 7) },
    { offset: 0, pm25: buildHourly(14, 2), pm10: buildHourly(26, 4), no2: buildHourly(19, 3), o3: buildHourly(58, 6) },
  ].map((d) => {
    const date = new Date(today);
    date.setDate(date.getDate() - d.offset);
    const daily = {};
    for (const sp of ['pm25', 'pm10', 'no2', 'o3']) {
      daily[sp] = dailyMeanFromHourly(d[sp]);
    }
    return { offset: d.offset, date, hourly: d, daily };
  });

  const annual = { pm25: 18.2, pm10: 28.4, no2: 22.1, o3: 74.5 };
  const realtime = { pm25: 15.1, pm10: 27.2, no2: 21.4, o3: 61.3 };

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const forecast = {
    band: 'Low',
    text: 'Cloudy with showers. Atlantic air feed should keep pollution Low.',
    date: tomorrow,
  };

  return {
    patient: {
      name: 'Eleanor Marsh',
      address: '14 Walworth Road, Southwark, London SE1 6EE',
      postcode: 'SE1 6EE',
    },
    annualYear: 2022,
    annual,
    realtime,
    recentDays,
    forecast,
    fetchedAt: new Date(),
  };
}

/** DAQI index 1–10 for a day — highest level across all pollutants */
export function daqiLevelForDay(day) {
  let max = 0;
  for (const p of POLLUTANTS) {
    const level = daqiLevel(day.daily[p.key], p.key);
    if (level != null && level > max) max = level;
  }
  return max || null;
}

export const HEALTH_ADVICE = {
  annual: 'Chronic exposure above WHO annual guidelines is a separate risk from daily index peaks. Consider long-term cardiovascular and respiratory context.',
  recent: 'Pollution presentations may lag 1–3 days. Review the past three days, not only today.',
};
