#!/usr/bin/env node
// Finds names that TWO OR MORE scripts define at the top level.
//
// The app is loaded as ~85 classic <script> tags sharing one global scope,
// so when a later file defines a function that an earlier file already
// defined, the later one silently wins — STATE.md records this ("a
// duplicate definition in the first shadows the second"). ESLint cannot see
// across files; this can.
//
//   node tools/check-globals.js          → exit 1 if there is a duplicate not
//                                          listed in tools/globals-allowlist.json
//   node tools/check-globals.js --list   → print every duplicate
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const allowPath = path.join(__dirname, 'globals-allowlist.json');
const allow = new Set(fs.existsSync(allowPath) ? JSON.parse(fs.readFileSync(allowPath, 'utf8')).names : []);

const files = fs.readdirSync(path.join(ROOT, 'src')).filter(f => f.endsWith('.js')).map(f => 'src/' + f)
  .concat(['error-handler2.js', 'version.js'].filter(f => fs.existsSync(path.join(ROOT, f))));

const TOP = /^(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)|^(?:var|let|const|class)\s+([A-Za-z_$][\w$]*)/;
const defs = new Map();
for (const f of files) {
  const seen = new Set();
  for (const line of fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n')) {
    const m = TOP.exec(line);
    if (!m) continue;
    const name = m[1] || m[2];
    if (seen.has(name)) continue;          // the same file twice is ESLint's business
    seen.add(name);
    if (!defs.has(name)) defs.set(name, []);
    defs.get(name).push(f);
  }
}
const dups = [...defs].filter(([, fs_]) => fs_.length > 1).sort((a, b) => a[0].localeCompare(b[0]));
const fresh = dups.filter(([n]) => !allow.has(n));

if (process.argv.includes('--list')) {
  for (const [n, fs_] of dups) console.log((allow.has(n) ? '  (allowed) ' : '  ') + n + '  ←  ' + fs_.join(', '));
}
if (fresh.length) {
  console.error('\nTop-level names defined in more than one script (the later one silently wins):\n');
  for (const [n, fs_] of fresh) console.error('  ' + n + '  ←  ' + fs_.join(', '));
  console.error('\nRename one, or — if it is intended — add the name to tools/globals-allowlist.json.\n');
  process.exit(1);
}
console.log('check-globals: no unexpected duplicate top-level names (' + defs.size + ' names, ' + dups.length + ' allowed).');
