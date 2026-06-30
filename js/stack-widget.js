import { HEALTH_ADVICE, recentDaysForV33, recentDaysForLadder } from './air-quality.js?v=6';
import {
  whoAnnualChart,
  recentCardHtml,
  forecastCardHtml,
  daqiLegendHtml,
} from './widget-render.js?v=5';
import { whoAnnualChartAligned } from './who-chart-v31.js?v=5';
import { whoAnnualChartV32 } from './who-chart-v32.js?v=7';
import { whoAnnualChartV33 } from './who-chart-v33.js?v=6';
import { whoAnnualChartV34 } from './who-chart-v34.js?v=1';
import { recentDaysForV34, forecastForV34 } from './who-data-v34.js?v=2';
import { whoRecentCardHtml, whoForecastCardHtml, whoLegendHtml } from './who-recent-v34.js?v=2';
import { whoAnnualChartV35 } from './who-chart-v35.js?v=2';
import { recentDaysForV35, forecastForV35 } from './who-data-v35.js?v=1';
import { whoRecentCardHtmlV35, whoForecastCardHtmlV35, whoCaqiLegendHtml } from './who-recent-v35.js?v=4';

const DEFAULT_SPECIES = 'pm25';
const LADDER_SIZE = { height: 96, width: 34 };

function bindGuidance(strip) {
  strip.querySelector('[data-guidance-toggle]').addEventListener('click', () => {
    strip.querySelector('[data-foot]').classList.toggle('open');
  });
}

function shell(data, zonesHtml) {
  const guidanceText = `${HEALTH_ADVICE.annual} ${HEALTH_ADVICE.recent}`;
  const strip = document.createElement('div');
  strip.className = 'aq-strip strip-stack';
  strip.innerHTML = `
    <div class="aq-meta">
      <div><strong>Air Quality at patient's home</strong><span class="place"> · ${data.patient.name} · SE1</span></div>
      <div class="pollutants" data-pollutants></div>
    </div>
    <div class="aq-body">
      <div class="aq-zones">${zonesHtml}</div>
    </div>
    <div class="aq-foot" data-foot>
      <button type="button" data-guidance-toggle>Clinical guidance</button>
      <div class="guidance">${guidanceText}</div>
    </div>
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
  updateStack(strip, data, species, { longTermChart: whoAnnualChartV32, recentDays: recentDaysForLadder(data.recentDays) });
  strip._update = () => updateStack(strip, data, species, { longTermChart: whoAnnualChartV32, recentDays: recentDaysForLadder(data.recentDays) });
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
