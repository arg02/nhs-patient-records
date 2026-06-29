import { HEALTH_ADVICE } from './air-quality.js';
import {
  whoAnnualChart,
  whoAnnualChartAligned,
  recentCardHtml,
  forecastCardHtml,
  daqiLegendHtml,
} from './widget-render.js';

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
      <div><strong>Air at home</strong><span class="place"> · ${data.patient.name} · SE1</span></div>
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

function updateStack(strip, data, species = DEFAULT_SPECIES, { longTermChart = whoAnnualChart } = {}) {
  strip.querySelector('[data-long]').innerHTML = `
    <div class="zone-label">Long-term</div>
    <div class="zone-main">${longTermChart(data.annual)}</div>
  `;
  const recentEl = strip.querySelector('[data-recent]');
  recentEl.innerHTML = recentCardHtml(data.recentDays, species, {
    visual: 'ladders',
    ladderSize: LADDER_SIZE,
    legendOutside: true,
  });
  recentEl.querySelectorAll('.daqi-legend-wrap').forEach((el) => el.remove());
  strip.querySelector('[data-recent-legend]').innerHTML = daqiLegendHtml();
  strip.querySelector('[data-forecast]').innerHTML = forecastCardHtml(data.forecast, species, {
    type: 'ladder',
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
  updateStack(strip, data, species);
  strip._update = () => updateStack(strip, data, species);
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
  updateStack(strip, data, species, { longTermChart: whoAnnualChartAligned });
  strip._update = () => updateStack(strip, data, species, { longTermChart: whoAnnualChartAligned });
  return strip;
}
