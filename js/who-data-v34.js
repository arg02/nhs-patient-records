/**
 * Mock data for variant 3.4 — varied CAQI levels across recent days + forecast.
 * PM₂.₅ daily means map to CAQI levels 2, 5, 8, 11 (−3d→Today) and 4 (forecast).
 */

/** PM₂.₅ µg/m³ → CAQI levels 2 (Meets), 5 (Above), 8 (Moderate), 11 (High) */
const PM25_BY_OFFSET = { 3: 7.0, 2: 25.0, 1: 45.0, 0: 62.0 };

export function recentDaysForV34(recentDays) {
  return recentDays.map((d) => {
    const pm25 = PM25_BY_OFFSET[d.offset];
    if (pm25 == null) return d;
    return { ...d, daily: { ...d.daily, pm25 } };
  });
}

/** Tomorrow — CAQI level 4 (Above WHO) */
export function forecastForV34(forecast) {
  return {
    ...forecast,
    band: 'Above WHO',
    daily: { pm25: 18.0, pm10: 28, no2: 30, o3: 55 },
  };
}
