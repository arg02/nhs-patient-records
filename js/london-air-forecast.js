/**
 * London Air forecast — always ForecastType "Future" for the widget Tomorrow panel.
 * Band → DAQI ladder via forecastBandToDaqi in air-quality.js.
 */

export const LONDON_AIR_FORECAST_URL =
  'https://londonair.org.uk/data/londonair/LondonAirForecast.asp';

/** Parse "DD/MM/YYYY HH:mm:ss GMT" from London Air JSON. */
export function parseLondonAirDateTime(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})\s+GMT$/i);
  if (!m) return null;
  return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +m[6]));
}

/** London Air returns Current + Future; widget uses Future only. */
export function pickFutureForecast(payload) {
  const list = payload?.Forecasts;
  if (!Array.isArray(list)) return null;
  return list.find((f) => f.ForecastType === 'Future') || null;
}

/**
 * Normalise Future entry for index.json.
 * @param {object} future — London Air Future forecast object
 * @param {string} tomorrowDateKey — UK-local YYYY-MM-DD for the widget date chip
 */
export function buildStoredForecast(future, tomorrowDateKey) {
  if (!future?.ForecastBand || !tomorrowDateKey) return null;
  return {
    band: future.ForecastBand,
    text: String(future.ForecastText || '').trim(),
    date: tomorrowDateKey,
    forecastId: future.ForecastID ?? null,
    forecastType: 'Future',
    publishedAt: future.PublishedDateTime || null,
    validFrom: future.ValidFrom || null,
    validTo: future.ValidTo || null,
    title: future.ForecastTitle || null,
  };
}

/** Widget payload { band, text, date: Date } from stored index.forecast. */
export function forecastForWidget(stored) {
  if (!stored?.band || !stored?.date) return null;
  const [y, m, d] = stored.date.split('-').map(Number);
  if (!y || !m || !d) return null;
  return {
    band: stored.band,
    text: stored.text || '',
    date: new Date(Date.UTC(y, m - 1, d, 12, 0, 0)),
  };
}

/** Parse London Air JSON body (may include BOM / leading whitespace). */
export function parseLondonAirPayload(rawText) {
  const trimmed = String(rawText).trim().replace(/^\uFEFF/, '');
  return JSON.parse(trimmed);
}
