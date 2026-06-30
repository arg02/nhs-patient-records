/**
 * Mock data for variant 3.5 — ascending CAQI levels across recent days + forecast.
 * PM₂.₅ daily means map to CAQI levels 2, 3, 5, 8 (−3d→Today) and 4 (forecast).
 */

/** PM₂.₅ µg/m³ → CAQI levels 2, 3, 5, 8 */
const PM25_BY_OFFSET = { 3: 7.0, 2: 12.0, 1: 25.0, 0: 45.0 };

export function recentDaysForV35(recentDays) {
  return recentDays.map((d) => {
    const pm25 = PM25_BY_OFFSET[d.offset];
    if (pm25 == null) return d;
    return { ...d, daily: { ...d.daily, pm25 } };
  });
}

/** Tomorrow — CAQI level 4 (Above WHO) */
export function forecastForV35(forecast) {
  return {
    ...forecast,
    band: 'Above WHO',
    daily: { pm25: 18.0, pm10: 28, no2: 30, o3: 55 },
  };
}
