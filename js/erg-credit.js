/** ERG (Environmental Research Group) data source credit */

const ERG_LOGOS = {
  blue: 'images/ERG_logo_blue.png',
  lightBlue: 'images/ERG_logo_light_blue.png',
};

export function ergCreditHtml(variant = 'blue') {
  const src = ERG_LOGOS[variant] ?? ERG_LOGOS.blue;
  return `
    <div class="erg-credit" aria-label="Data source">
      <span class="erg-credit-label">Data provided by:</span>
      <img class="erg-credit-logo" src="${src}" alt="Environmental Research Group — Imperial College London" width="100" height="24" loading="lazy">
    </div>
  `;
}
