const fs = require('fs');
const path = require('path');
const { Resvg } = require(path.resolve(__dirname, '../../../../../node_modules/.pnpm/@resvg+resvg-js@2.6.2/node_modules/@resvg/resvg-js'));

const outDir = __dirname;

const svgs = {
  'user-icon.png': `
<svg width="80" height="80" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="40" height="40" rx="10" fill="#dbeafe"/>
  <circle cx="20" cy="15" r="5.5" fill="#2563eb"/>
  <path d="M10 30c0-4.5 4.5-7 10-7s10 2.5 10 7" fill="#2563eb"/>
</svg>`,

  'lock-icon.png': `
<svg width="80" height="80" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="40" height="40" rx="10" fill="#dbeafe"/>
  <path d="M14 17.5V14a6 6 0 1 1 12 0v3.5" stroke="#2563eb" stroke-width="2.7" stroke-linecap="round"/>
  <rect x="11.5" y="17.5" width="17" height="13" rx="3.5" fill="#2563eb"/>
  <circle cx="20" cy="23.5" r="1.8" fill="#dbeafe"/>
  <path d="M20 25v2.2" stroke="#dbeafe" stroke-width="1.8" stroke-linecap="round"/>
</svg>`,

  'link-icon.png': `
<svg width="80" height="80" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="40" height="40" rx="10" fill="#dbeafe"/>
  <path d="M18.5 21.5L21.5 18.5M16 16L14 18C12 20 12 23 14 25C16 27 19 27 21 25L23 23M19 17L21 15C23 13 26 13 28 15C30 17 30 20 28 22L26 24" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`,

  'eye-icon.png': `
<svg width="60" height="60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M2 12C2 12 5.5 5 12 5C18.5 5 22 12 22 12C22 12 18.5 19 12 19C5.5 19 2 12 2 12Z" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="12" cy="12" r="3" stroke="#94a3b8" stroke-width="2"/>
</svg>`,

  'google-play.png': `
<svg width="360" height="108" viewBox="0 0 180 54" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="180" height="54" rx="10" fill="#000000"/>
  <rect x="0.5" y="0.5" width="179" height="53" rx="9.5" stroke="#333333"/>
  <!-- Google Play icon -->
  <g transform="translate(16, 12)">
    <path d="M2.5 1.5L18.5 15L2.5 28.5V1.5Z" fill="#00E5FF"/>
    <path d="M18.5 15L23.5 19.2L2.5 28.5L18.5 15Z" fill="#FF3D00"/>
    <path d="M23.5 10.8L18.5 15L2.5 1.5L23.5 10.8Z" fill="#00E676"/>
    <path d="M18.5 15L23.5 10.8C25.5 12 25.5 18 23.5 19.2L18.5 15Z" fill="#FFD600"/>
  </g>
  <!-- Text -->
  <text x="56" y="21" fill="#FFFFFF" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="9" font-weight="600" letter-spacing="0.5">GET IT ON</text>
  <text x="56" y="38" fill="#FFFFFF" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="700">Google Play</text>
</svg>`,

  'app-store.png': `
<svg width="360" height="108" viewBox="0 0 180 54" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="180" height="54" rx="10" fill="#000000"/>
  <rect x="0.5" y="0.5" width="179" height="53" rx="9.5" stroke="#333333"/>
  <!-- Apple logo -->
  <g transform="translate(18, 12)">
    <path d="M18.4 17.5C18.4 15.3 19.6 14.1 19.7 14C18.6 12.4 16.9 12.2 16.3 12.1C14.8 12 13.4 13 12.6 13C11.8 13 10.7 12.1 9.5 12.1C8 12.1 6.5 13 5.7 14.4C4.1 17.2 5.3 21.3 6.9 23.5C7.7 24.6 8.5 25.8 9.7 25.8C10.9 25.8 11.3 25 12.7 25C14.1 25 14.5 25.8 15.7 25.8C16.9 25.8 17.7 24.7 18.5 23.6C19.4 22.3 19.8 21 19.8 20.9C19.7 20.9 18.4 19.4 18.4 17.5Z" fill="#FFFFFF"/>
    <path d="M15.3 10C15.9 9.2 16.3 8.1 16.2 7C15.2 7 14 7.7 13.4 8.5C12.8 9.1 12.4 10.3 12.5 11.4C13.6 11.5 14.7 10.7 15.3 10Z" fill="#FFFFFF"/>
  </g>
  <!-- Text -->
  <text x="54" y="21" fill="#FFFFFF" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="9" font-weight="500">Download on the</text>
  <text x="54" y="38" fill="#FFFFFF" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="17" font-weight="700">App Store</text>
</svg>`
};

for (const [filename, svg] of Object.entries(svgs)) {
  const resvg = new Resvg(svg.trim());
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();
  fs.writeFileSync(path.join(outDir, filename), pngBuffer);
  console.log('Generated:', filename);
}
