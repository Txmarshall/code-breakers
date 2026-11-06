// Wraps app.html (artifact fragment) into a standalone index.html for GitHub Pages.
import { readFileSync, writeFileSync } from 'node:fs';
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
console.log('built index.html', (head.length + frag.length), 'bytes');
