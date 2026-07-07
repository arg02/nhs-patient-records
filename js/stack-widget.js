import { clinicalGuidanceHtml, recentDaysForV33, recentDaysForLadder } from './air-quality.js?v=9';
import {
  whoAnnualChart,
  recentCardHtml,
  forecastCardHtml,
  daqiLegendHtml,
  bandAxisLabelsHtml,
  bandAxisLinesHtml,
  syncV32cLaddersBandLayer,
  todayCardHtml,
  combinedLaddersCardHtml,
} from './widget-render.js?v=27';
import { whoAnnualChartAligned } from './who-chart-v31.js?v=6';
import { whoAnnualChartV32 } from './who-chart-v32.js?v=8';
import { whoAnnualChartV32A, whoAnnualChartV32B, whoAnnualChartV32C, pollutantKeyStripAlignedHtml } from './who-chart-v32a.js?v=7';
import { ergCreditHtml } from './erg-credit.js?v=2';
import { whoAnnualChartV33 } from './who-chart-v33.js?v=7';
import { whoAnnualChartV34 } from './who-chart-v34.js?v=1';
import { recentDaysForV34, forecastForV34 } from './who-data-v34.js?v=2';
import { whoRecentCardHtml, whoForecastCardHtml, whoLegendHtml } from './who-recent-v34.js?v=3';
import { whoAnnualChartV35 } from './who-chart-v35.js?v=2';
import { recentDaysForV35, forecastForV35 } from './who-data-v35.js?v=1';
import { whoRecentCardHtmlV35, whoForecastCardHtmlV35, whoCaqiLegendHtml } from './who-recent-v35.js?v=4';

const DEFAULT_SPECIES = 'pm25';
/** Canonical DAQI ladder pill — 34px wide, centred in 56px day slot (see css --daqi-bar-track). */
const LADDER_SIZE = { height: 95, width: 34 };

function bindGuidance(strip) {
  const foot = strip.querySelector('[data-foot]');
  const btn = strip.querySelector('[data-guidance-toggle]');
  btn.addEventListener('click', () => {
    const open = foot.classList.toggle('open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
}

function footHtml(guidanceText) {
  return `
    <div class="aq-foot" data-foot>
      <button type="button" class="guidance-toggle" data-guidance-toggle aria-expanded="false">
        <span class="guidance-toggle-text">View clinical guidance</span>
        <span class="guidance-toggle-icon" aria-hidden="true">▼</span>
      </button>
      <div class="guidance" role="region" aria-label="Clinical guidance">${guidanceText}</div>
    </div>
  `;
}

function shell(data, zonesHtml) {
  const guidanceText = clinicalGuidanceHtml();
  const strip = document.createElement('div');
  strip.className = 'aq-strip strip-stack';
  strip.innerHTML = `
    <div class="aq-meta">
      <div><strong>Air quality at patient's home</strong><span class="place"> · ${data.patient.name} · SE1</span></div>
      <div class="pollutants" data-pollutants></div>
    </div>
    <div class="aq-body">
      <div class="aq-zones">${zonesHtml}</div>
    </div>
    ${footHtml(guidanceText)}
  `;
  strip.querySelector('[data-pollutants]').remove();
  bindGuidance(strip);
  return strip;
}

function updateStack(strip, data, species = DEFAULT_SPECIES, {
  longTermChart = whoAnnualChart,
  recentVisual = 'ladders',
  forecastVisual = 'ladder',
  recentDays = data.recentDays,
  todayHeaderSplit = false,
} = {}) {
  strip.querySelector('[data-long]').innerHTML = `
    <div class="zone-label">Long-term</div>
    <div class="zone-main">${longTermChart(data.annual)}</div>
  `;
  const recentEl = strip.querySelector('[data-recent]');
  recentEl.innerHTML = recentCardHtml(recentDays, species, {
    visual: recentVisual,
    ladderSize: LADDER_SIZE,
    legendOutside: true,
    todayHeaderSplit,
  });
  recentEl.querySelectorAll('.daqi-legend-wrap').forEach((el) => el.remove());
  strip.querySelector('[data-recent-legend]').innerHTML = daqiLegendHtml();
  strip.querySelector('[data-forecast]').innerHTML = forecastCardHtml(data.forecast, species, {
    type: forecastVisual,
    ladderSize: LADDER_SIZE,
  });
}

/** Design 3 — DAQI ladders, WHO row, legend below Recent card */
export function createStackWidget(data, { species = DEFAULT_SPECIES } = {}) {
  const strip = shell(data, `
    <section class="zone-card zone-long" data-long></section>
    <div class="zone-recent-block" data-recent-block>
      <section class="zone-card zone-recent" data-recent></section>
      <div class="daqi-legend-wrap daqi-legend-wrap--outside" data-recent-legend></div>
    </div>
    <section class="zone-card zone-forecast" data-forecast></section>
  `);
  updateStack(strip, data, species, { recentDays: recentDaysForLadder(data.recentDays) });
  strip._update = () => updateStack(strip, data, species, { recentDays: recentDaysForLadder(data.recentDays) });
  return strip;
}

/** 3.1 — aligned WHO dotted line; excess above line proportional to × WHO */
export function createStackWidgetV31(data, { species = DEFAULT_SPECIES } = {}) {
  const strip = shell(data, `
    <section class="zone-card zone-long" data-long></section>
    <div class="zone-recent-block" data-recent-block>
      <section class="zone-card zone-recent" data-recent></section>
      <div class="daqi-legend-wrap daqi-legend-wrap--outside" data-recent-legend></div>
    </div>
    <section class="zone-card zone-forecast" data-forecast></section>
  `);
  updateStack(strip, data, species, { longTermChart: whoAnnualChartAligned, recentDays: recentDaysForLadder(data.recentDays) });
  strip._update = () => updateStack(strip, data, species, { longTermChart: whoAnnualChartAligned, recentDays: recentDaysForLadder(data.recentDays) });
  return strip;
}

/** 3.2 — ratio above the bar, concentration below the bar */
export function createStackWidgetV32(data, { species = DEFAULT_SPECIES } = {}) {
  const strip = shell(data, `
    <section class="zone-card zone-long" data-long></section>
    <div class="zone-recent-block" data-recent-block>
      <section class="zone-card zone-recent" data-recent></section>
      <div class="daqi-legend-wrap daqi-legend-wrap--outside" data-recent-legend></div>
    </div>
    <section class="zone-card zone-forecast" data-forecast></section>
  `);
  updateStack(strip, data, species, {
    longTermChart: whoAnnualChartV32,
    recentDays: recentDaysForLadder(data.recentDays),
    todayHeaderSplit: true,
  });
  strip._update = () => updateStack(strip, data, species, {
    longTermChart: whoAnnualChartV32,
    recentDays: recentDaysForLadder(data.recentDays),
    todayHeaderSplit: true,
  });
  return strip;
}

/** 3.2a / 3.2b — coloured ratios, pollutant key below long-term, ERG credit bottom-right */
function updateStackV32Variant(strip, data, species = DEFAULT_SPECIES, { variant = 'a' } = {}) {
  const year = data.annualYear ?? 2022;
  const longChart = variant === 'b' ? whoAnnualChartV32B : whoAnnualChartV32A;
  const keyHtml = pollutantKeyStripAlignedHtml({
    labelStyle: variant === 'a' ? 'chemical' : 'descriptive',
  });
  const ergLogo = variant === 'a' ? 'lightBlue' : 'blue';

  strip.querySelector('[data-long]').innerHTML = `
    <div class="zone-label-stack">
      <div class="zone-label">Long-term</div>
      <div class="zone-year">(${year})</div>
    </div>
    <div class="zone-main">${longChart(data.annual)}</div>
  `;
  strip.querySelector('[data-long-key]').innerHTML = keyHtml;
  const recentEl = strip.querySelector('[data-recent]');
  recentEl.innerHTML = recentCardHtml(recentDaysForLadder(data.recentDays), species, {
    visual: 'ladders',
    ladderSize: LADDER_SIZE,
    legendOutside: true,
    todayHeaderSplit: true,
  });
  recentEl.querySelectorAll('.daqi-legend-wrap').forEach((el) => el.remove());
  strip.querySelector('[data-recent-legend]').innerHTML = daqiLegendHtml();
  strip.querySelector('[data-forecast]').innerHTML = forecastCardHtml(data.forecast, species, {
    type: 'ladder',
    ladderSize: LADDER_SIZE,
  });
  strip.querySelector('[data-erg-credit]').innerHTML = ergCreditHtml(ergLogo);
}

function shellV32A(data, zonesHtml, variant = 'a') {
  const guidanceText = clinicalGuidanceHtml();
  const strip = document.createElement('div');
  strip.className = `aq-strip strip-stack strip-stack--v32${variant}`;
  strip.innerHTML = `
    <div class="aq-meta">
      <div><strong>Air quality at patient's home</strong><span class="place"> · ${data.patient.name} · SE1</span></div>
      <div class="pollutants" data-pollutants></div>
    </div>
    <div class="aq-body">
      <div class="aq-zones">${zonesHtml}</div>
    </div>
    ${footHtml(guidanceText)}
  `;
  strip.querySelector('[data-pollutants]').remove();
  bindGuidance(strip);
  return strip;
}

const ZONES_V32A = `
  <div class="zone-long-block" data-long-block>
    <section class="zone-card zone-long" data-long></section>
    <div class="pollutant-key-wrap pollutant-key-wrap--outside" data-long-key></div>
  </div>
  <div class="zone-recent-block" data-recent-block>
    <section class="zone-card zone-recent" data-recent></section>
    <div class="daqi-legend-wrap daqi-legend-wrap--outside" data-recent-legend></div>
  </div>
  <div class="zone-forecast-block" data-forecast-block>
    <section class="zone-card zone-forecast" data-forecast></section>
    <div class="erg-credit-wrap erg-credit-wrap--outside" data-erg-credit></div>
  </div>
`;

export function createStackWidgetV32A(data, { species = DEFAULT_SPECIES } = {}) {
  const strip = shellV32A(data, ZONES_V32A, 'a');
  updateStackV32Variant(strip, data, species, { variant: 'a' });
  strip._update = () => updateStackV32Variant(strip, data, species, { variant: 'a' });
  return strip;
}

/** 3.2b — side WHO values, DAQI-style pollutant key, dark-blue ERG logo */
export function createStackWidgetV32B(data, { species = DEFAULT_SPECIES } = {}) {
  const strip = shellV32A(data, ZONES_V32A, 'b');
  updateStackV32Variant(strip, data, species, { variant: 'b' });
  strip._update = () => updateStackV32Variant(strip, data, species, { variant: 'b' });
  return strip;
}

const ZONES_V32C = `
  <div class="zone-long-block" data-long-block>
    <section class="zone-card zone-long" data-long></section>
  </div>
  <div class="zone-ladders-span" data-ladders-span>
    <div class="ladders-band-layer" aria-hidden="true">
      <div class="ladders-band-axis" data-band-axis></div>
      <div class="ladders-band-lines" data-band-lines></div>
    </div>
    <div class="zone-recent-block" data-recent-block>
      <section class="zone-card zone-recent" data-recent></section>
    </div>
    <div class="zone-forecast-block" data-forecast-block>
      <section class="zone-card zone-forecast" data-forecast></section>
      <div class="erg-credit-wrap erg-credit-wrap--outside" data-erg-credit></div>
    </div>
  </div>
`;

/** 3.2c — standard layout; band-axis labels + lines on Recent; names under annual bars */
function updateStackV32C(strip, data, species = DEFAULT_SPECIES) {
  const year = data.annualYear ?? 2022;

  strip.querySelector('[data-long]').innerHTML = `
    <div class="zone-label-stack">
      <div class="zone-label">Long-term</div>
      <div class="zone-year">(${year})</div>
    </div>
    <div class="zone-main">${whoAnnualChartV32C(data.annual)}</div>
  `;
  const recentEl = strip.querySelector('[data-recent]');
  recentEl.innerHTML = recentCardHtml(recentDaysForLadder(data.recentDays), species, {
    visual: 'ladders',
    ladderSize: LADDER_SIZE,
    legendOutside: true,
    spanBand: true,
    todayHeaderSplit: true,
  });
  recentEl.querySelectorAll('.daqi-legend-wrap').forEach((el) => el.remove());
  strip.querySelector('[data-forecast]').innerHTML = forecastCardHtml(data.forecast, species, {
    type: 'ladder',
    ladderSize: LADDER_SIZE,
    ladderChartAlign: true,
    compact: true,
  });
  strip.querySelector('[data-erg-credit]').innerHTML = ergCreditHtml('blue');

  const bandLayer = strip.querySelector('.ladders-band-layer');
  bandLayer.querySelector('[data-band-axis]').innerHTML = bandAxisLabelsHtml();
  bandLayer.querySelector('[data-band-lines]').innerHTML = bandAxisLinesHtml();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => syncV32cLaddersBandLayer(strip));
  });
}

export function createStackWidgetV32C(data, { species = DEFAULT_SPECIES } = {}) {
  const strip = shellV32A(data, ZONES_V32C, 'c');
  updateStackV32C(strip, data, species);
  strip._update = () => updateStackV32C(strip, data, species);
  if (!strip._v32cBandObserver) {
    strip._v32cBandObserver = new ResizeObserver(() => syncV32cLaddersBandLayer(strip));
    strip._v32cBandObserver.observe(strip);
  }
  return strip;
}

const ZONES_V32D = `
  <div class="zone-long-block" data-long-block>
    <section class="zone-card zone-long" data-long></section>
  </div>
  <div class="zone-ladders-span" data-ladders-span>
    <div class="ladders-band-layer" aria-hidden="true">
      <div class="ladders-band-axis" data-band-axis></div>
      <div class="ladders-band-lines" data-band-lines></div>
    </div>
    <div class="zone-recent-block" data-recent-block>
      <section class="zone-card zone-recent" data-recent></section>
    </div>
    <div class="zone-today-block" data-today-block>
      <section class="zone-card zone-today" data-today></section>
    </div>
    <div class="zone-forecast-block" data-forecast-block>
      <section class="zone-card zone-forecast" data-forecast></section>
      <div class="erg-credit-wrap erg-credit-wrap--outside" data-erg-credit></div>
    </div>
  </div>
`;

function pastDaysForLadder(recentDays) {
  return recentDaysForLadder(recentDays).filter((d) => d.offset > 0);
}

/** 3.2d — Recent, Today, Forecast each in their own panel (based on 3.2c) */
function updateStackV32D(strip, data, species = DEFAULT_SPECIES) {
  const year = data.annualYear ?? 2022;
  const ladderDays = recentDaysForLadder(data.recentDays);

  strip.querySelector('[data-long]').innerHTML = `
    <div class="zone-label-stack">
      <div class="zone-label">Long-term</div>
      <div class="zone-year">(${year})</div>
    </div>
    <div class="zone-main">${whoAnnualChartV32C(data.annual)}</div>
  `;
  strip.querySelector('[data-recent]').innerHTML = recentCardHtml(pastDaysForLadder(data.recentDays), species, {
    visual: 'ladders',
    ladderSize: LADDER_SIZE,
    legendOutside: true,
    spanBand: true,
    dividerBeforeToday: false,
  });
  strip.querySelector('[data-today]').innerHTML = todayCardHtml(ladderDays, species, {
    ladderSize: LADDER_SIZE,
  });
  strip.querySelector('[data-forecast]').innerHTML = forecastCardHtml(data.forecast, species, {
    type: 'ladder',
    ladderSize: LADDER_SIZE,
    ladderChartAlign: true,
    compact: true,
  });
  strip.querySelector('[data-erg-credit]').innerHTML = ergCreditHtml('blue');

  const bandLayer = strip.querySelector('.ladders-band-layer');
  bandLayer.querySelector('[data-band-axis]').innerHTML = bandAxisLabelsHtml();
  bandLayer.querySelector('[data-band-lines]').innerHTML = bandAxisLinesHtml();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => syncV32cLaddersBandLayer(strip));
  });
}

export function createStackWidgetV32D(data, { species = DEFAULT_SPECIES } = {}) {
  const strip = shellV32A(data, ZONES_V32D, 'd');
  updateStackV32D(strip, data, species);
  strip._update = () => updateStackV32D(strip, data, species);
  if (!strip._v32dBandObserver) {
    strip._v32dBandObserver = new ResizeObserver(() => syncV32cLaddersBandLayer(strip));
    strip._v32dBandObserver.observe(strip);
  }
  return strip;
}

const ZONES_V32E = `
  <div class="zone-long-block" data-long-block>
    <section class="zone-card zone-long" data-long></section>
  </div>
  <div class="zone-ladders-span" data-ladders-span>
    <div class="ladders-band-layer" aria-hidden="true">
      <div class="ladders-band-axis" data-band-axis></div>
      <div class="ladders-band-lines" data-band-lines></div>
    </div>
    <div class="zone-combined-block" data-combined-block>
      <section class="zone-card zone-combined" data-combined></section>
      <div class="erg-credit-wrap erg-credit-wrap--outside" data-erg-credit></div>
    </div>
  </div>
`;

/** 3.2e — single combined panel for Recent + Today + Forecast (based on 3.2c) */
function updateStackV32E(strip, data, species = DEFAULT_SPECIES) {
  const year = data.annualYear ?? 2022;

  strip.querySelector('[data-long]').innerHTML = `
    <div class="zone-label-stack">
      <div class="zone-label">Long-term</div>
      <div class="zone-year">(${year})</div>
    </div>
    <div class="zone-main">${whoAnnualChartV32C(data.annual)}</div>
  `;
  strip.querySelector('[data-combined]').innerHTML = combinedLaddersCardHtml(
    recentDaysForLadder(data.recentDays),
    data.forecast,
    species,
    { ladderSize: LADDER_SIZE },
  );
  strip.querySelector('[data-erg-credit]').innerHTML = ergCreditHtml('blue');

  const bandLayer = strip.querySelector('.ladders-band-layer');
  bandLayer.querySelector('[data-band-axis]').innerHTML = bandAxisLabelsHtml();
  bandLayer.querySelector('[data-band-lines]').innerHTML = bandAxisLinesHtml();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => syncV32cLaddersBandLayer(strip));
  });
}

export function createStackWidgetV32E(data, { species = DEFAULT_SPECIES } = {}) {
  const strip = shellV32A(data, ZONES_V32E, 'e');
  updateStackV32E(strip, data, species);
  strip._update = () => updateStackV32E(strip, data, species);
  if (!strip._v32eBandObserver) {
    strip._v32eBandObserver = new ResizeObserver(() => syncV32cLaddersBandLayer(strip));
    strip._v32eBandObserver.observe(strip);
  }
  return strip;
}

/** 3.3 — 3.2 layout with an alternative pollution profile */
export function createStackWidgetV33(data, { species = DEFAULT_SPECIES } = {}) {
  const strip = shell(data, `
    <section class="zone-card zone-long" data-long></section>
    <div class="zone-recent-block" data-recent-block>
      <section class="zone-card zone-recent" data-recent></section>
      <div class="daqi-legend-wrap daqi-legend-wrap--outside" data-recent-legend></div>
    </div>
    <section class="zone-card zone-forecast" data-forecast></section>
  `);
  const recentDays = recentDaysForV33(data.recentDays);
  const update = () => updateStack(strip, data, species, {
    longTermChart: whoAnnualChartV33,
    recentVisual: 'circles',
    forecastVisual: 'circles',
    recentDays,
  });
  update();
  strip._update = update;
  return strip;
}

/** 3.4 — full CAQI legend; circle stacks for Recent & Forecast */
export function createStackWidgetV34(data, { species = DEFAULT_SPECIES } = {}) {
  const strip = shell(data, `
    <section class="zone-card zone-long" data-long></section>
    <div class="zone-recent-block" data-recent-block>
      <section class="zone-card zone-recent" data-recent></section>
      <div class="who-legend-wrap who-legend-wrap--outside who-legend-wrap--caqi-full" data-recent-legend></div>
    </div>
    <section class="zone-card zone-forecast" data-forecast></section>
  `);
  const recentDays = recentDaysForV34(data.recentDays);
  const forecast = forecastForV34(data.forecast);
  const update = () => {
    strip.querySelector('[data-long]').innerHTML = `
      <div class="zone-label">Long-term</div>
      <div class="zone-main">${whoAnnualChartV34(data.annual)}</div>
    `;
    strip.querySelector('[data-recent]').innerHTML = whoRecentCardHtml(recentDays, species);
    strip.querySelector('[data-recent-legend]').innerHTML = whoLegendHtml();
    strip.querySelector('[data-forecast]').innerHTML = whoForecastCardHtml(forecast, species);
  };
  update();
  strip._update = update;
  return strip;
}

/** 3.5 — full CAQI WHO-line pill bars for Recent & Forecast; full CAQI legend */
export function createStackWidgetV35(data, { species = DEFAULT_SPECIES } = {}) {
  const strip = shell(data, `
    <section class="zone-card zone-long" data-long></section>
    <div class="zone-recent-block" data-recent-block>
      <section class="zone-card zone-recent" data-recent></section>
      <div class="who-legend-wrap who-legend-wrap--outside who-legend-wrap--caqi-full" data-recent-legend></div>
    </div>
    <section class="zone-card zone-forecast" data-forecast></section>
  `);
  const recentDays = recentDaysForV35(data.recentDays);
  const forecast = forecastForV35(data.forecast);
  const update = () => {
    strip.querySelector('[data-long]').innerHTML = `
      <div class="zone-label">Long-term</div>
      <div class="zone-main">${whoAnnualChartV35(data.annual)}</div>
    `;
    strip.querySelector('[data-recent]').innerHTML = whoRecentCardHtmlV35(recentDays, species);
    strip.querySelector('[data-recent-legend]').innerHTML = whoCaqiLegendHtml();
    strip.querySelector('[data-forecast]').innerHTML = whoForecastCardHtmlV35(forecast, species);
  };
  update();
  strip._update = update;
  return strip;
}
