/**
 * Full CAQI scale — colours, thresholds, and level helpers from daqi-vs-caqi colorScales.ts
 * PM₂.₅ and NO₂ each have 13 index levels; other species fall back to PM₂.₅ scale.
 */

import { WHO_ANNUAL, normalizeSpecies } from './air-quality.js?v=6';

/** Indices 1–3 sit below the WHO dotted line (Meets WHO blues) */
export const CAQI_MEETS_COUNT = 3;

/** PM₂.₅ CAQI colours — index 1 lowest, 13 highest */
export const CAQI_PM25_COLORS = [
  '#6cc8e8', '#3195d2', '#3758a4',
  '#ffec80', '#ffdf43', '#ffd500',
  '#EEBF8F', '#FE994D', '#F46200',
  '#D80000', '#A30000', '#7A0000',
  '#000000',
];

/** PM₂.₅ lower-bound thresholds (µg/m³) */
export const CAQI_PM25_THRESHOLDS = [
  0, 5, 10, 15.5, 23.4, 28.7, 36, 42, 48, 54, 59, 65, 71,
];

/** NO₂ CAQI colours */
export const CAQI_NO2_COLORS = [
  '#6cc8e8', '#3195d2', '#3758a4',
  '#ffec80', '#ffdf43', '#ffd500',
  '#EEBF8F', '#FE994D', '#F46200',
  '#D80000', '#A30000', '#7A0000',
  '#000000',
];

/** NO₂ lower-bound thresholds (µg/m³) */
export const CAQI_NO2_THRESHOLDS = [
  0, 8.3, 16.7, 25.5, 84.4, 142.7, 201, 268, 335, 401, 468, 535, 601,
];

/** Legend / pill-bar band groups — daqi-vs-caqi ColorLegend CAQI_KEY */
export const CAQI_KEY = [
  { label: 'Meets WHO', colors: ['#6cc8e8', '#3195d2', '#3758a4'], levels: [1, 2, 3], zone: 'below' },
  { label: 'Above WHO', colors: ['#ffec80', '#ffdf43', '#ffd500'], levels: [4, 5, 6], zone: 'above' },
  { label: 'Moderate', colors: ['#EEBF8F', '#FE994D', '#F46200'], levels: [7, 8, 9], zone: 'above' },
  { label: 'High', colors: ['#D80000', '#A30000', '#7A0000'], levels: [10, 11, 12], zone: 'above' },
  { label: 'V.High', colors: ['#000000'], levels: [13], zone: 'above' },
];

/** Spacing mirrored from .daqi-legend / .daqi-legend-dots */
export const CAQI_BAND_GAP = 8;
export const CAQI_SEG_GAP = 3;

const SCALES = {
  pm25: { colors: CAQI_PM25_COLORS, thresholds: CAQI_PM25_THRESHOLDS },
  no2: { colors: CAQI_NO2_COLORS, thresholds: CAQI_NO2_THRESHOLDS },
  pm10: { colors: CAQI_PM25_COLORS, thresholds: CAQI_PM25_THRESHOLDS },
  o3: { colors: CAQI_PM25_COLORS, thresholds: CAQI_PM25_THRESHOLDS },
};

export function getCaqiScale(species) {
  const sp = normalizeSpecies(species);
  return SCALES[sp] ?? SCALES.pm25;
}

/** CAQI index level 1–13 for a concentration */
export function caqiLevel(value, species) {
  if (value == null || Number.isNaN(value)) return null;
  const { thresholds } = getCaqiScale(species);
  let level = 1;
  for (let i = 0; i < thresholds.length; i++) {
    if (value >= thresholds[i]) level = i + 1;
    else break;
  }
  return level;
}

export function caqiColor(level, species) {
  const { colors } = getCaqiScale(species);
  return colors[level - 1] ?? '#999';
}

/** Band label for a CAQI level */
export function caqiBandLabel(level) {
  if (level == null) return '—';
  if (level <= 3) return 'Meets WHO';
  if (level <= 6) return 'Above WHO';
  if (level <= 9) return 'Moderate';
  if (level <= 12) return 'High';
  return 'V.High';
}

/** WHO dotted-line position as fraction of track height (top of Meets WHO zone) */
export function whoLineRatio(species) {
  const total = getCaqiScale(species).colors.length;
  return CAQI_MEETS_COUNT / total;
}

/** Daily mean vs WHO annual guideline */
export function dailyWhoComparison(dailyMean, species) {
  const sp = normalizeSpecies(species);
  const who = WHO_ANNUAL[sp];
  if (dailyMean == null || who == null) return null;
  const level = caqiLevel(dailyMean, species);
  const above = dailyMean > who;
  return {
    who,
    dailyMean,
    above,
    meets: !above,
    level,
    label: caqiBandLabel(level),
  };
}

/** Grey fill for inactive segments above max level */
export const CAQI_INACTIVE = '#eceef2';
