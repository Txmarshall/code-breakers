// Regenerates icons/*.png from the inline SVG (also written to icons/icon.svg).
// Run: CHROME_EXE=<chromium exe> SP=<preview dir> node icons/make-icons.cjs  (borrows Playwright from iqc-dashboard, see test-e2e.cjs)
const { chromium } = require('C:/Projects/iqc-dashboard/node_modules/playwright');
const fs = require('fs');
const F = 'font-family="Verdana,DejaVu Sans,Arial,sans-serif" font-weight="700"';
// Icon: an open gold padlock whose body is a two-wheel code window. The first wheel has landed on
// a lit "a" (cracked); the other still shows cipher marks (# ?). One object, one idea: crack the code.
const body = (bleed) => `<rect width="512" height="512" rx="${bleed?0:112}" fill="url(#navy)"/>
<g transform="${bleed?'translate(256 256) scale(.8) translate(-256 -256)':''}">
<g filter="url(#sh)">
<path d="M196 230 v-68 a84 84 0 0 1 168 0 v10" fill="none" stroke="url(#gold)" stroke-width="34" stroke-linecap="round" transform="rotate(-14 364 172)"/>
<rect x="84" y="222" width="344" height="230" rx="46" fill="url(#gold)"/>
</g>
<rect x="118" y="256" width="118" height="162" rx="22" fill="#101A45" opacity=".85"/>
<g ${F} font-size="72" fill="#8FA2FF" text-anchor="middle"><text x="177" y="328" opacity=".55">#</text><text x="177" y="404">?</text></g>
<rect x="254" y="256" width="142" height="162" rx="22" fill="#101A45"/>
<text x="325" y="398" text-anchor="middle" ${F} font-size="140" fill="#FFE38A">a</text>
</g>`;
const svg = (bleed) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<!-- Code Breakers app icon: open padlock, two-wheel code window, first wheel cracked to "a". Source for icons/*.png. -->
<defs>
<linearGradient id="navy" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2A3F92"/><stop offset="1" stop-color="#101A45"/></linearGradient>
<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE38A"/><stop offset="1" stop-color="#F0A822"/></linearGradient>
<filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#000" flood-opacity=".3"/></filter>
</defs>
${body(bleed)}</svg>`;
(async () => {
  fs.writeFileSync('C:/Projects/code-breakers/icons/icon.svg', svg(false));
  const b = await chromium.launch({ executablePath: process.env.CHROME_EXE });
  const p = await b.newPage({ viewport: { width: 512, height: 512 } });
  for (const [name, size, bleed] of [['icon-192.png', 192, false], ['icon-512.png', 512, false], ['maskable-512.png', 512, true], ['apple-touch-icon.png', 180, true]]) {
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(`<body style="margin:0;background:transparent">${svg(bleed).replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body>`);
    await p.screenshot({ path: 'C:/Projects/code-breakers/icons/' + name, omitBackground: !bleed });
  }
  // preview at phone size on a dark and a light wallpaper
  await p.setViewportSize({ width: 420, height: 180 });
  const png = fs.readFileSync('C:/Projects/code-breakers/icons/icon-192.png').toString('base64');
  await p.setContent(`<body style="margin:0;display:flex"><div style="flex:1;background:#1a1a2e;display:grid;place-items:center"><img src="data:image/png;base64,${png}" width="72"></div><div style="flex:1;background:#e9eef5;display:grid;place-items:center"><img src="data:image/png;base64,${png}" width="72"></div><div style="flex:1;background:#fff;display:grid;place-items:center"><img src="data:image/png;base64,${png}" width="48"></div></body>`);
  await p.screenshot({ path: process.env.SP + '/icon-preview.png' });
  await b.close(); console.log('icons written');
})().catch(e => { console.error(e); process.exit(1); });
