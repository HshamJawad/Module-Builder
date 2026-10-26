#!/usr/bin/env node
// Usage: node tools/bump-version.js 3.81.7 [YYYY-MM-DD]
// Updates every place a release number lives: version.json, sw.js
// CACHE_VERSION, and the ?v= on each script/style tag in index.html.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const ver = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(ver || '')) { console.error('Usage: node tools/bump-version.js X.Y.Z [date]'); process.exit(1); }
const date = process.argv[3] || new Date().toISOString().slice(0, 10);
const edit = (f, fn) => { const p = path.join(root, f); const a = fs.readFileSync(p, 'utf8'), b = fn(a); if (a === b) throw new Error('no change in ' + f); fs.writeFileSync(p, b); };
edit('version.json', () => JSON.stringify({ version: ver, build: date }, null, 2) + '\n');
edit('sw.js', s => s.replace(/(const CACHE_VERSION = 'mb-)[\d.]+(')/, '$1' + ver + '$2'));
let n = 0;
edit('index.html', s => s.replace(/\?v=\d+\.\d+\.\d+/g, () => (n++, '?v=' + ver)));
console.log('Bumped to ' + ver + ' (' + date + '): version.json, sw.js, ' + n + ' tags in index.html.');
console.log('Remember the CHANGELOG_dacum_handoff.md entry.');
