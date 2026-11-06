// Data lint for Code Breakers. Loads the DATA + TOKENIZER sections of app.html
// (no DOM needed) and checks the sound/word/picture tables for mismatches that
// would surface as a wrong or confusing screen. Exit 1 on any error.
// Run: node lint.mjs [file]   default app.html; build.mjs runs it on app.html, then on the built index.html.
// Seam contract: the file holds one <script> whose '/* ---------- 1. DATA' and '/* ---------- 3. TOKENIZER' sections
// are browser-free. test-lint.mjs proves each error class fires and that a broken seam fails loudly.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const file = process.argv[2] || new URL('./app.html', import.meta.url);
const html = readFileSync(file, 'utf8');
const m = html.match(/<script>([\s\S]*)<\/script>/);
if (!m) { console.log('ERROR no <script> block found in ' + file); process.exit(1); }
const script = m[1];
function section(n){ const a=script.indexOf(`/* ---------- ${n}.`); if(a<0){ console.log(`ERROR section marker ${n} missing - lint seam broken`); process.exit(1); } const b=script.indexOf('/* ---------- ', a+5); return script.slice(a, b<0?undefined:b); }
const src = section(1) + section(3) + '\n;({G,PIC,LEVELS,CONFUSE,MULTI,HEART_HINT,tokenize,taughtGraphemes,wordsFor})';
let D; try { D = vm.runInNewContext(src, { saveAll(){} }); } catch(e) { console.log('ERROR data sections did not evaluate without a DOM: ' + e.message); process.exit(1); }
const { G, PIC, LEVELS, CONFUSE, MULTI, HEART_HINT, tokenize } = D;

const errors=[], warns=[];
const err=(m)=>errors.push(m), warn=(m)=>warns.push(m);
const META = new Set(['blend','syll','morph']);
const taughtThrough = (id)=>{ const s=new Set(); LEVELS.filter(l=>l.id<=id).forEach(l=>l.g.forEach(g=>{ if(G[g]&&!META.has(g)) s.add(g); })); return s; };

// 1. Every grapheme keyword actually contains its sound where the child expects it.
for (const [g,d] of Object.entries(G)) {
  if (META.has(g)) continue;
  if (!d.k) { err(`G.${g}: no keyword`); continue; }
  if (!d.e) err(`G.${g}: keyword "${d.k}" has no picture`);
  const toks = tokenize(d.k.split(' ')[0]).map(t=>t.g);
  const FINAL = new Set(['ck','ff','ll','ss','zz','x','ng']); // only ever heard at the end of a word
  const ok = d.v ? toks.includes(g) : FINAL.has(g) ? toks[toks.length-1]===g : toks[0]===g;
  if (!ok) err(`G.${g}: keyword "${d.k}" does not ${d.v?'contain':FINAL.has(g)?'end with':'start with'} /${g}/ (tokens: ${toks.join(' ')})`);
  if (!d.v && d.say===undefined && !/^[bcdgjkpqtx]|^ck$|^ch$|^qu$/.test(g)) warn(`G.${g}: consonant with no "say" value (will fall back to keyword on TTS)`);
}
// 2. No two graphemes share a picture or a keyword (Sound Spy shows 3 pictures side by side).
const byPic={}, byKw={};
for (const [g,d] of Object.entries(G)) { if(META.has(g)) continue; (byPic[d.e]??=[]).push(g); (byKw[d.k]??=[]).push(g); }
for (const [e,gs] of Object.entries(byPic)) if (gs.length>1) err(`graphemes ${gs.join(', ')} share the same picture ${e}`);
for (const [k,gs] of Object.entries(byKw)) if (gs.length>1) err(`graphemes ${gs.join(', ')} share the same keyword "${k}"`);

// 3. Every decodable word is spelled only with graphemes taught by its level, and is lowercase a-z.
const seen=new Map();
for (const L of LEVELS) {
  if (L.older) continue;
  const taught = taughtThrough(L.id);
  for (const w of L.words) {
    if (!/^[a-z]+$/.test(w)) err(`L${L.id} "${w}": not lowercase a-z`);
    const bad = tokenize(w).filter(t=>!t.silent && !taught.has(t.g)).map(t=>t.g);
    if (bad.length) err(`L${L.id} "${w}": uses untaught grapheme(s) ${bad.join(', ')}`);
    if (seen.has(w)) warn(`"${w}" appears in L${seen.get(w)} and L${L.id}`); else seen.set(w, L.id);
    if (L.heart.includes(w)) err(`L${L.id} "${w}": listed as both decodable and heart word`);
  }
  for (const h of L.heart) if (HEART_HINT[h]===undefined) warn(`L${L.id} heart word "${h}": no HEART_HINT entry`);
  const pics = L.words.filter(w=>PIC[w]);
  if (pics.length<3) warn(`L${L.id} (${L.name}): only ${pics.length} picture word(s) [${pics.join(', ')}] - Read It falls back to Find the Word, first/count are listen-only`);
}

// 4. Picture table hygiene.
const picDup={};
for (const [w,e] of Object.entries(PIC)) { (picDup[e]??=[]).push(w); if (!/^[a-z]+$/.test(w)) err(`PIC "${w}": not lowercase a-z`); }
for (const [e,ws] of Object.entries(picDup)) if (ws.length>1) warn(`PIC words ${ws.join(', ')} share picture ${e} (guarded in Read It, but one picture = two words)`);
const allWords = new Set(LEVELS.flatMap(l=>l.words));
const orphans = Object.keys(PIC).filter(w=>!allWords.has(w));
if (orphans.length) warn(`PIC words not in any level (only ever used as Read It distractors): ${orphans.join(', ')}`);

// 5. Cross-references.
for (const m of MULTI) if (!G[m]) err(`MULTI "${m}" has no G entry`);
for (const [g,alts] of Object.entries(CONFUSE)) { if(!G[g]) err(`CONFUSE key "${g}" not in G`); for (const a of alts) if(!G[a]) err(`CONFUSE ${g} -> "${a}" not in G`); }

// Report.
for (const w of warns) console.log('warn  ' + w);
for (const e of errors) console.log('ERROR ' + e);
console.log(`\nlint: ${errors.length} error(s), ${warns.length} warning(s) across ${Object.keys(G).length} graphemes, ${allWords.size} words, ${Object.keys(PIC).length} pictures`);
process.exit(errors.length ? 1 : 0);
