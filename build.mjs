// Wraps app.html (artifact fragment) into a standalone index.html for GitHub Pages.
// Gate: data lint on the source first; after the wrap, lint the built artifact and syntax-check the inline script.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const here = (f) => fileURLToPath(new URL(f, import.meta.url));
function must(args, label) {
  const r = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (r.status !== 0) { console.error(`build aborted: ${label} failed`); process.exit(r.status || 1); }
}
must([here('./lint.mjs'), here('./app.html')], 'lint app.html');
const frag = readFileSync(new URL('./app.html', import.meta.url), 'utf8');
const head = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#FBF5E6">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Code Breakers">
<meta name="application-name" content="Code Breakers">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">
<link rel="apple-touch-icon" sizes="180x180" href="icons/apple-touch-icon.png">
<style>img{max-width:100%}[hidden]{display:none!important}</style>
<style>.upd{position:fixed;left:50%;bottom:calc(72px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:50;background:#2F7D6B;color:#fff;border:0;border-radius:999px;padding:12px 20px;font:700 1rem Verdana,"DejaVu Sans",Arial,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.3);cursor:pointer}.upd:disabled{opacity:.7}</style>
<script>
// PWA: register the service worker on http(s) only (file:// and the artifact viewer have no SW).
// A new build waits (sw.js does not skipWaiting on its own); an "update ready" pill appears on every screen and the
// reload happens only when it is tapped, so nobody loses a session mid-item. Updates are checked hourly and whenever
// the app comes back to the foreground, because an installed app can stay open for days.
if('serviceWorker' in navigator && /^https?:$/.test(location.protocol)){ addEventListener('load', async ()=>{
  let reg; try{ reg=await navigator.serviceWorker.register('sw.js'); }catch(e){ return; }
  let clicked=false;
  const show=()=>{ if(!reg.waiting||document.getElementById('upd')) return; const b=document.createElement('button'); b.id='upd'; b.className='upd'; b.textContent='New version ready \u00b7 tap to update';
    b.onclick=()=>{ clicked=true; b.disabled=true; b.textContent='Updating\u2026'; try{ if(typeof endSession==='function') endSession(false); }catch(e){} if(reg.waiting) reg.waiting.postMessage({type:'SKIP_WAITING'}); else location.reload(); };
    document.body.appendChild(b); };
  if(reg.waiting) show();
  reg.addEventListener('updatefound',()=>{ const w=reg.installing; if(!w) return; w.addEventListener('statechange',()=>{ if(w.state==='installed'&&navigator.serviceWorker.controller) show(); }); });
  navigator.serviceWorker.addEventListener('controllerchange',()=>{ if(clicked){ clicked=false; location.reload(); } });
  const check=()=>{ reg.update().catch(()=>{}); };
  setInterval(check,60*60*1000); document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') check(); });
  window.__swCheck=check;
}); }
</script>
</head>
<body>
`;
const html = head + frag + '\n</body>\n</html>\n';
writeFileSync(new URL('./index.html', import.meta.url), html);
// service worker: stamp a hash of the whole app shell (page, manifest, icons) so any deploy installs a fresh cache and drops the old one
const shell = ['./manifest.webmanifest', './sw.src.js', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png'];
const h = createHash('sha1').update(html); for (const f of shell) h.update(readFileSync(new URL(f, import.meta.url)));
const build = h.digest('hex').slice(0, 12);
writeFileSync(new URL('./sw.js', import.meta.url), readFileSync(new URL('./sw.src.js', import.meta.url), 'utf8').replaceAll('__BUILD__', build));
must(['--check', here('./sw.js')], 'syntax check of sw.js');
// syntax check the inline script
const m = frag.match(/<script>([\s\S]*)<\/script>/);
writeFileSync(new URL('./_check.js', import.meta.url), m ? m[1] : '');
must([here('./lint.mjs'), here('./index.html')], 'lint index.html');
must(['--check', here('./_check.js')], 'syntax check of the inline script');
console.log('built index.html', html.length, 'bytes; sw.js build', build);
