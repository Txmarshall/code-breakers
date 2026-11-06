// E2E: node test-e2e.cjs [url]  (env: CHROME_EXE=<chromium exe>, PLAYWRIGHT_PKG=<playwright pkg dir>, E2E_OUT=<screenshot dir>)
// Playwright pass against the live Pages build. Speech and the phoneme synth are instrumented so
// "what would be spoken" is asserted without ears.
const { chromium } = require(process.env.PLAYWRIGHT_PKG || 'C:/Projects/iqc-dashboard/node_modules/playwright');
const URL = process.argv[2] || 'file:///C:/Projects/code-breakers/index.html';
const OUT = (process.env.E2E_OUT || require('os').tmpdir()) + '/code-breakers-e2e';
require('fs').mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log(...a);
const fails = [];
const expect = (cond, msg) => { if (cond) log('  PASS', msg); else { log('  FAIL', msg); fails.push(msg); } };

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_EXE });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true, isMobile: false });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => {
    window.__spoken = []; window.__syn = [];
    window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; this.rate = 1; this.pitch = 1; } };
    const S = window.speechSynthesis;
    if (S) {
      S.speak = (u) => { window.__spoken.push({ t: u.text, rate: u.rate, pitch: u.pitch, at: performance.now() }); setTimeout(() => u.onend && u.onend(), 150); };
      S.cancel = () => {};
      S.getVoices = () => [{ name: 'Google US English', voiceURI: 'Google US English', lang: 'en-US' }];
    }
  });
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(500);
  // wrap the synth after the script ran (function declaration = global binding)
  await page.evaluate(() => { const o = synthPhoneme; synthPhoneme = (g) => { const r = o(g); window.__syn.push({ g, synth: !!r }); return r; }; });
  const spoken = async () => page.evaluate(() => window.__spoken.splice(0));
  const syn = async () => page.evaluate(() => window.__syn.splice(0));

  log('1. build present:', await page.evaluate(() => typeof synthPhoneme + ' ' + typeof buildPrompt + ' ' + typeof SPEECH_GEN));
  log('   speech stub check:', JSON.stringify(await page.evaluate(() => { speak('stub-check'); return window.__spoken.splice(0).map(x => x.t); })));

  // profile
  await page.click('[data-act="newprofile"]');
  await page.fill('#pname', 'Test');
  await page.click('[data-act="band"][data-v="young"]');
  await page.click('[data-act="skin"]');
  await page.click('[data-act="createprofile"]');
  await page.waitForTimeout(300);
  await page.click('[data-act="play"]');
  await page.waitForTimeout(300);
  await page.evaluate(() => { session.rounds[session.r].splice(session.i, 0, { t: 'build', g: 's', w: 'sap' }); cur = null; go('play'); });
  await page.waitForTimeout(600);
  await page.screenshot({ path: OUT + '/01-first-item.png' });

  // generic solver, item by item
  let buildSeen = 0, itemsDone = 0, prevW = null;
  for (let n = 0; n < 40; n++) {
    const it = await page.evaluate(() => cur && cur.item ? { t: cur.item.t, g: cur.item.g, w: cur.item.w, n: cur.item.n, need: cur.need ? cur.need.map(x => x.g) : null, bank: cur.bank || null, done: !!cur.done } : null);
    const view = await page.evaluate(() => view);
    if (view === 'play' && !it) { await page.waitForTimeout(1200); n--; continue; }
    if (view !== 'play' || !it) { log('left play view:', view); break; }
    log(`item ${n}: ${it.t} g=${it.g} w=${it.w}`);
    await page.waitForTimeout(700); // let the item's auto-prompt fire (250ms timeout + speech)
    const auto = await spoken(); const autoSyn = await syn();
    if (prevW && prevW !== it.w) expect(!auto.some(x => x.t.includes('The word is: ' + prevW)), `previous word "${prevW}" does not leak into this item's audio`);
    if (it.t === 'build') {
      buildSeen++;
      const prompt = await page.textContent('#bprompt');
      expect(prompt === 'What sound does the word start with?', `build prompt initial: "${prompt}"`);
      expect(auto.some(x => x.t === `The word is: ${it.w}. ${it.w}.`), `build auto-say carrier: ${JSON.stringify(auto.map(x => x.t))}`);
      expect(auto.some(x => x.t === 'What sound does the word start with?'), 'build auto-say asks the first sound');
      // bank must contain each in-word grapheme at least as many times as needed, and distractors must not be in-word letters
      const counts = {}; it.bank.forEach(g => counts[g] = (counts[g] || 0) + 1);
      const needC = {}; it.need.filter(g => g !== 'e' || true).forEach(g => needC[g] = (needC[g] || 0) + 1);
      let dupOk = true; for (const g in counts) { if (counts[g] > (needC[g] || 0) && needC[g]) dupOk = false; }
      expect(dupOk, `bank has no surplus in-word tiles: bank=${it.bank.join(',')} need=${it.need.join(',')}`);
      if (buildSeen === 1) {
        // WRONG answer first: fill boxes with the bank in reversed need order where possible
        const wrong = it.need.slice().reverse();
        const tiles = await page.$$('#bank .tile');
        for (const g of wrong) { for (const t of tiles) { const used = await t.evaluate(e => e.classList.contains('used')); const v = await t.getAttribute('data-v'); if (!used && v === g) { await t.click(); break; } } }
        await page.waitForTimeout(900);
        const tap = await spoken(); const tapSyn = await syn();
        expect(!tap.some(x => /tiger|pig|sun|apple|nut|mouse|dog/.test(x.t)), `tile taps never speak a keyword: ${JSON.stringify(tap.map(x => x.t))}`);
        expect(tap.some(x => x.t === 'What is the next sound?'), 'tile tap asks for the next sound');
        const sTap = tapSyn.filter(x => ['s', 'ss', 'm', 'n', 'f', 'z', 'sh', 'th', 'v', 'ng'].includes(x.g));
        if (sTap.length) expect(sTap.every(x => x.synth), `continuous consonants synthesized on tap: ${JSON.stringify(sTap)}`);
        const p2 = await page.textContent('#bprompt');
        expect(p2 === 'Now tap Check ✓', `prompt when full: "${p2}"`);
        await page.screenshot({ path: OUT + '/02-build-wrong-filled.png' });
        const disabled = await page.$eval('#checkbtn', b => b.disabled);
        if (!disabled && wrong.join('') !== it.need.join('')) {
          await page.click('#checkbtn'); await page.waitForTimeout(3500);
          const rev = await spoken(); const revSyn = await syn();
          log('   reveal spoke:', JSON.stringify(rev.map(x => x.t)), 'synth:', JSON.stringify(revSyn.map(x => x.g)));
          expect(!rev.some(x => /^[a-z]{2,4}$/.test(x.t) && !['ah', 'ih', 'eh', 'aw', 'uh', 'ay', 'ee', 'oh', 'eye', 'you', 'oo', 'ow', 'oy', 'ar', 'or', 'er'].includes(x.t)), `reveal never TTS-es a consonant string: ${JSON.stringify(rev.map(x => x.t))}`);
          expect(rev.some(x => x.t === `The word is: ${it.w}. ${it.w}.`), 'reveal ends with the carrier-phrase word');
          await page.screenshot({ path: OUT + '/03-build-after-miss.png' });
          const p3 = await page.textContent('#bprompt');
          log('   prompt after miss reveal:', JSON.stringify(p3));
        }
      }
      // now the right answer
      await page.evaluate(() => { app.querySelectorAll('#boxes .box.filled').forEach(b => b.click()); });
      await page.waitForTimeout(200);
      for (const g of it.need) {
        if (g === 'e' && (await page.$('#boxes .box.outside'))) continue;
        const tiles = await page.$$('#bank .tile');
        let hit = false;
        for (const t of tiles) { const used = await t.evaluate(e => e.classList.contains('used')); const v = await t.getAttribute('data-v'); if (!used && v === g) { await t.click(); hit = true; break; } }
        if (!hit) log('   no tile for', g);
        await page.waitForTimeout(250);
      }
      await page.waitForTimeout(600);
      await page.click('#checkbtn');
    } else if (it.t === 'spy') {
      const mode = await page.evaluate(() => cur.item.mode);
      const kw = await page.evaluate(() => G[cur.item.g].k);
      if (mode === 'g2k') expect(auto.some(x => x.t === kw) || autoSyn.some(x => x.synth), `spy picture->sound prompt audible: ${JSON.stringify(auto.map(x => x.t))}`);
      else expect(!auto.some(x => x.t === kw), `spy letter->picture never speaks the answer keyword "${kw}": ${JSON.stringify(auto.map(x => x.t))}`);
      await page.click(`[data-act="pickg"][data-v="${it.g}"]`);
    } else if (it.t === 'first') {
      expect(auto.some(x => x.t === `The word is: ${it.w}. ${it.w}.`), `first-sound auto-say carrier: ${JSON.stringify(auto.map(x => x.t))}`);
      await page.click(`[data-act="pickg"][data-v="${it.g}"]`);
    } else if (it.t === 'find') {
      await page.click(`[data-act="pickw"][data-v="${it.w}"]`);
    } else if (it.t === 'count') {
      await page.click(`[data-act="pickn"][data-v="${it.n}"]`);
    } else if (it.t === 'read') {
      await page.click('[data-act="blend"]').catch(() => {});
      await page.waitForTimeout(500);
      const w = await page.$(`[data-act="pickw"][data-v="${it.w}"]`); if (w) await w.click(); else { log('   read item: no pickw, skipping'); break; }
    } else { log('   unhandled type', it.t, '- stopping solver'); break; }
    // after answering, the transition happens; verify nothing from this item speaks AFTER the next render
    await page.waitForTimeout(2200);
    prevW = it.w || null;
    itemsDone++;
    if (itemsDone >= 7 && buildSeen >= 1) break;
  }
  log(`items solved: ${itemsDone}, build items: ${buildSeen}`);

  // Garden: reach the break screen. Force it via the round-end path if the solver did not get there.
  const v = await page.evaluate(() => view);
  if (!(await page.$('[data-act="pickbreak"]'))) { await page.evaluate(() => { session.i = session.rounds[session.r].length; cur = null; go('play'); }); await page.waitForTimeout(300); }
  const pick = await page.$('[data-act="pickbreak"][data-v="garden"]');
  expect(!!pick, 'break picker shows Grow a garden');
  if (pick) {
    await pick.click(); await page.waitForTimeout(400);
    await page.screenshot({ path: OUT + '/04-garden-empty.png' });
    // tap-spam: 300 pointerdowns spread over the canvas, as fast as a kid can
    await page.evaluate(() => { const cv = document.getElementById('cv'); const r = cv.getBoundingClientRect(); for (let i = 0; i < 300; i++) { cv.dispatchEvent(new PointerEvent('pointerdown', { clientX: r.left + 10 + (i * 37) % (r.width - 20), clientY: r.top + r.height * .55 + (i * 13) % (r.height * .4), bubbles: true })); } });
    await page.waitForTimeout(1500);
    // slow-tap 80 more over 10s is the realistic path; here we measure the frame budget after 300 bursts
    const fps = await page.evaluate(() => new Promise(res => { let n = 0; const t0 = performance.now(); (function f() { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(n / 2); })(); }));
    log('   garden fps (headless, after 300 burst taps):', fps.toFixed(1));
    expect(fps > 30, `garden keeps >30fps after tap spam (got ${fps.toFixed(1)})`);
    await page.screenshot({ path: OUT + '/05-garden-spam.png' });
    // leave: loop must stop
    await page.evaluate(() => go('home'));
    await page.waitForTimeout(100);
    const stopped = await page.evaluate(() => animId === null && document.getElementById('cv') === null);
    expect(stopped, 'garden loop cancelled after leaving the break');
  }

  // settings: voice pitch/rate defaults
  const u = await page.evaluate(() => { window.__spoken.length = 0; speak('hi'); return window.__spoken[0]; });
  expect(u && u.pitch === 1.25 && u.rate === 0.8, `voice defaults pitch=${u && u.pitch} rate=${u && u.rate}`);

  expect(errors.length === 0, `no page errors: ${JSON.stringify(errors)}`);
  await browser.close();
  log(`\nRESULT: ${fails.length ? 'FAIL ' + fails.length : 'ALL PASS'}`);
  if (fails.length) { fails.forEach(f => log(' -', f)); process.exit(1); }
})().catch(e => { console.error('CRASH', e); process.exit(2); });
