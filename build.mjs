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
<script>
// PWA: register the service worker on http(s) only (file:// and the artifact viewer have no SW).
if('serviceWorker' in navigator && /^https?:$/.test(location.protocol)){ addEventListener('load',()=>{ navigator.serviceWorker.register('sw.js').catch(()=>{}); }); }
</script>
</head>
<body>
`;
const html = head + frag + '\n</body>\n</html>\n';
writeFileSync(new URL('./index.html', import.meta.url), html);
// service worker: stamp the build hash so a new deploy installs a fresh cache and drops the old one
const build = createHash('sha1').update(html).digest('hex').slice(0, 12);
writeFileSync(new URL('./sw.js', import.meta.url), readFileSync(new URL('./sw.src.js', import.meta.url), 'utf8').replaceAll('__BUILD__', build));
must(['--check', here('./sw.js')], 'syntax check of sw.js');
// syntax check the inline script
const m = frag.match(/<script>([\s\S]*)<\/script>/);
writeFileSync(new URL('./_check.js', import.meta.url), m ? m[1] : '');
must([here('./lint.mjs'), here('./index.html')], 'lint index.html');
must(['--check', here('./_check.js')], 'syntax check of the inline script');
console.log('built index.html', html.length, 'bytes; sw.js build', build);
