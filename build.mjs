// Wraps app.html (artifact fragment) into a standalone index.html for GitHub Pages.
// Gate: data lint on the source first; after the wrap, lint the built artifact and syntax-check the inline script.
import { readFileSync, writeFileSync } from 'node:fs';
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
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%94%90%3C/text%3E%3C/svg%3E">
<style>img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
`;
writeFileSync(new URL('./index.html', import.meta.url), head + frag + '\n</body>\n</html>\n');
// syntax check the inline script
const m = frag.match(/<script>([\s\S]*)<\/script>/);
writeFileSync(new URL('./_check.js', import.meta.url), m ? m[1] : '');
must([here('./lint.mjs'), here('./index.html')], 'lint index.html');
must(['--check', here('./_check.js')], 'syntax check of the inline script');
console.log('built index.html', (head.length + frag.length), 'bytes');
