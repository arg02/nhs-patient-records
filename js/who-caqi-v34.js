/**
 * Variant 3.4 — full CAQI scale (re-exported from who-caqi-v35.js).
 * Circle stacks use the same 13-level thresholds and colours as 3.5 pill bars.
 */

export {
  CAQI_MEETS_COUNT,
  CAQI_PM25_COLORS,
  CAQI_PM25_THRESHOLDS,
  CAQI_NO2_COLORS,
  CAQI_NO2_THRESHOLDS,
  CAQI_KEY,
  CAQI_BAND_GAP,
  CAQI_SEG_GAP,
  CAQI_INACTIVE,
  getCaqiScale,
  caqiLevel,
  caqiColor,
  caqiBandLabel,
  whoLineRatio,
  dailyWhoComparison,
} from './who-caqi-v35.js?v=3';

/** 3.4 aliases — same 13-level CAQI scale as 3.5 pill bars */
export { CAQI_KEY as WHO_KEY, caqiLevel as caqiWhoLevel, caqiColor as whoCircleColor } from './who-caqi-v35.js?v=3';
