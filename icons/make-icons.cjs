// Regenerates icons/*.png from the inline SVG (also written to icons/icon.svg).
// Run: CHROME_EXE=<chromium exe> SP=<preview dir> node icons/make-icons.cjs  (borrows Playwright from iqc-dashboard, see test-e2e.cjs)
const { chromium } = require('C:/Projects/iqc-dashboard/node_modules/playwright');
const fs = require('fs');
const F = 'font-family="Verdana,DejaVu Sans,Arial,sans-serif" font-weight="700"';
const letters = ['s','a','t','p','i','n','m','d','g','o','c','k'];
const dial = letters.map((l,i)=>{ const a=i/letters.length*Math.PI*2-Math.PI/2; const r=150; const x=256+Math.cos(a)*r, y=256+Math.sin(a)*r; return `<text x="${x.toFixed(1)}" y="${(y+16).toFixed(1)}" text-anchor="middle" ${F} font-size="46" fill="${i===1?'#FFE38A':'#D6DFFA'}">${l}</text>`; }).join('');
const body = (bleed) => `<rect width="512" height="512" rx="${bleed?0:112}" fill="url(#bg)"/>
<g transform="${bleed?'translate(256 256) scale(.82) translate(-256 -256)':''}">
<circle cx="256" cy="256" r="200" fill="#15204A" stroke="#33448A" stroke-width="6"/>
<circle cx="256" cy="256" r="200" fill="none" stroke="#D6DFFA" stroke-width="4" stroke-dasharray="4 28" opacity=".45"/>
${dial}
<circle cx="256" cy="256" r="106" fill="url(#gold)" filter="url(#sh)"/>
<circle cx="256" cy="256" r="84" fill="#1B2550"/>
<text x="256" y="294" text-anchor="middle" ${F} font-size="108" fill="#FFE38A">a</text>
<polygon points="256,50 238,94 274,94" fill="#FF5A7A"/>
</g>`;
const svg = (bleed) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<!-- Code Breakers app icon: a vault dial whose combination is the first sounds (s a t p i n ...). Source for icons/*.png; regenerate with the script noted in README/memory. -->
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1E2A5A"/><stop offset="1" stop-color="#0B1230"/></linearGradient>
<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE38A"/><stop offset="1" stop-color="#E09B1A"/></linearGradient>
<filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="#000" flood-opacity=".35"/></filter>
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
