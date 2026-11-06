// Mutation tests for lint.mjs: each known defect class must produce its specific ERROR and exit 1;
// the unmodified app must pass; a broken seam must fail loudly. Run: node test-lint.mjs
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = readFileSync(new URL('./app.html', import.meta.url), 'utf8');
const lint = fileURLToPath(new URL('./lint.mjs', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'cb-lint-'));
let fails = 0;
const id = x => x;
function run(name, mutate, expectExit, expectText) {
  const out = mutate(src);
  if (out === src && mutate !== id) { console.log(`FAIL ${name}: mutation did not apply (anchor text changed?)`); fails++; return; }
  const f = join(dir, name.replace(/\W+/g, '_') + '.html'); writeFileSync(f, out);
  const r = spawnSync(process.execPath, [lint, f], { encoding: 'utf8' });
  const ok = r.status === expectExit && (!expectText || r.stdout.includes(expectText));
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} (exit ${r.status}${expectText ? ', expects "' + expectText + '"' : ''})`);
  if (!ok) { fails++; console.log(r.stdout.split('\n').filter(l => l.startsWith('ERROR')).join('\n')); }
}
run('clean app passes', id, 0, '0 error(s)');
run('keyword does not start with its sound', s => s.replace("s:{k:'sun',e:'☀️',say:'sss'}", "s:{k:'apple',e:'☀️',say:'sss'}"), 1, 'G.s: keyword "apple" does not start with /s/');
run('final grapheme keyword must end with it', s => s.replace("ck:{k:'duck',e:'🦆'}", "ck:{k:'kite',e:'🦆'}"), 1, 'G.ck: keyword "kite" does not end with /ck/');
run('two graphemes share a picture', s => s.replace("p:{k:'pig',e:'🐷'}", "p:{k:'pig',e:'☀️'}"), 1, 'share the same picture');
run('two graphemes share a keyword', s => s.replace("t:{k:'tiger',e:'🐯'}", "t:{k:'sun',e:'🐯'}"), 1, 'share the same keyword "sun"');
run('word uses an untaught grapheme', s => s.replace("words:['at','sat','pat','tap','sap','taps','pats']", "words:['at','sat','pat','tap','sap','taps','pats','fish']"), 1, 'L1 "fish": uses untaught grapheme(s) f, i, sh');
run('heart word also decodable', s => s.replace("heart:['the','a','I']", "heart:['the','a','I','sit']"), 1, '"sit": listed as both decodable and heart word');
run('CONFUSE points at a missing grapheme', s => s.replace("s:['z'],", "s:['z','zq'],"), 1, 'CONFUSE s -> "zq" not in G');
run('seam: data section marker removed', s => s.replace('/* ---------- 1. DATA ---------- */', '/* data */'), 1, 'section marker 1 missing');
run('seam: browser global in data section', s => s.replace('const VOWELS = ', 'const _x = document.title; const VOWELS = '), 1, 'did not evaluate without a DOM');
rmSync(dir, { recursive: true, force: true });
console.log(fails ? `\n${fails} test(s) FAILED` : '\nall lint mutation tests passed');
process.exit(fails ? 1 : 0);
