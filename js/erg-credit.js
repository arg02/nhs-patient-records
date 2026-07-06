/** ERG (Environmental Research Group) data source credit — shown below Forecast panel */

const ERG_LOGOS = {
  blue: 'images/ERG_logo_blue.png',
  lightBlue: 'images/ERG_logo_light_blue.png',
};

export function ergCreditHtml(variant = 'blue') {
  const src = ERG_LOGOS[variant] ?? ERG_LOGOS.blue;
  return `
    <div class="erg-credit" aria-label="Data source">
      <span class="erg-credit-label">Forecast data</span>
      <img class="erg-credit-logo" src="${src}" alt="Environmental Research Group" width="120" height="28" loading="lazy">
    </div>
  `;
}
