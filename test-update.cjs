// Update flow: node test-update.cjs  (env: CHROME_EXE, PLAYWRIGHT_PKG)
// Serves a scratch copy of the built site, loads it, swaps in a "new build" (different sw.js stamp), triggers the
// update check, and asserts: the pill appears only after the new worker is installed, nothing reloads until it is
// tapped, and the tap activates the new worker and reloads onto it.
const { chromium } = require(process.env.PLAYWRIGHT_PKG || 'C:/Projects/iqc-dashboard/node_modules/playwright');
const http = require('http'); const fs = require('fs'); const path = require('path'); const os = require('os');
const REPO = __dirname;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cb-upd-'));
for (const f of ['index.html', 'sw.js', 'manifest.webmanifest']) fs.copyFileSync(path.join(REPO, f), path.join(dir, f));
fs.mkdirSync(path.join(dir, 'icons')); for (const f of fs.readdirSync(path.join(REPO, 'icons'))) if (f.endsWith('.png')) fs.copyFileSync(path.join(REPO, 'icons', f), path.join(dir, 'icons', f));
const types = { '.html': 'text/html', '.js': 'application/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const srv = http.createServer((req, res) => {
  let f = req.url.split('?')[0]; if (f === '/') f = '/index.html';
  const fp = path.join(dir, f); if (!fs.existsSync(fp)) { res.statusCode = 404; return res.end(); }
  res.setHeader('Content-Type', types[path.extname(fp)] || 'application/octet-stream'); res.setHeader('Cache-Control', 'no-store'); res.end(fs.readFileSync(fp));
});
const fails = []; const log = (...a) => console.log(...a);
const expect = (c, m) => { if (c) log('  PASS', m); else { log('  FAIL', m); fails.push(m); } };
(async () => {
  await new Promise(r => srv.listen(0, '127.0.0.1', r)); const url = `http://127.0.0.1:${srv.address().port}/index.html`;
  const browser = await chromium.launch({ executablePath: process.env.CHROME_EXE });
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  await page.addInitScript(() => { window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } }; if (window.speechSynthesis) { speechSynthesis.speak = () => {}; speechSynthesis.cancel = () => {}; } });
  await page.goto(url, { waitUntil: 'load' });
  const sw1 = await page.evaluate(() => navigator.serviceWorker.ready.then(r => r.active.scriptURL));
  expect(!!sw1, 'first worker active');
  await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(400); // controlled load
  const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
  expect(controlled, 'page is controlled by the worker');
  expect(!(await page.$('#upd')), 'no update pill when nothing is new');
  const build1 = await page.evaluate(() => caches.keys());
  // deploy a "new build": different stamp in sw.js
  const sw = fs.readFileSync(path.join(dir, 'sw.js'), 'utf8'); const stamp = sw.match(/const BUILD = '([0-9a-f]+)'/)[1];
  fs.writeFileSync(path.join(dir, 'sw.js'), sw.replace(stamp, 'ffffffffffff'));
  let reloads = 0; page.on('load', () => reloads++);
  await page.evaluate(() => window.__swCheck());
  await page.waitForSelector('#upd', { timeout: 10000 }).catch(() => null);
  expect(!!(await page.$('#upd')), 'update pill appears after the new worker installs');
  expect(reloads === 0, 'no reload until the pill is tapped');
  const waiting = await page.evaluate(() => navigator.serviceWorker.getRegistration().then(r => !!r.waiting));
  expect(waiting, 'new worker is waiting, old one still controls');
  await page.click('#upd');
  await page.waitForEvent('load', { timeout: 10000 }).catch(() => null); await page.waitForTimeout(500);
  const after = await page.evaluate(async () => ({ ctl: !!navigator.serviceWorker.controller, caches: await caches.keys(), pill: !!document.getElementById('upd') }));
  expect(reloads >= 1, `tap reloads the page (reloads=${reloads})`);
  expect(after.ctl && after.caches.includes('code-breakers-ffffffffffff') && !after.caches.some(k => build1.includes(k)), `new worker controls and the old cache is gone: ${JSON.stringify(after.caches)}`);
  expect(!after.pill, 'pill gone after the update');
  await browser.close(); srv.close(); fs.rmSync(dir, { recursive: true, force: true });
  log(`\nRESULT: ${fails.length ? 'FAIL ' + fails.length : 'ALL PASS'}`);
  if (fails.length) process.exit(1);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
