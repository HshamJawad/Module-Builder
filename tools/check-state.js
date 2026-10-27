#!/usr/bin/env node
// Every `mbState.<key>` the app reads or writes must be declared in the
// state object in src/mb_state.js. A key that is only ever created by
// assignment is invisible to anyone reading mb_state.js, reads as
// undefined until then, and a misspelt one silently makes a second
// property. Run from the repository root: node tools/check-state.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const stateSrc = fs.readFileSync(path.join(root, 'src', 'mb_state.js'), 'utf8');
const start = stateSrc.indexOf('var mbState = {');
const end = stateSrc.indexOf('\n};', start);
const body = stateSrc.slice(start, end);
const declared = new Set([...body.matchAll(/^    ([A-Za-z_]\w*)\s*:/gm)].map(m => m[1]));

const files = fs.readdirSync(path.join(root, 'src')).filter(f => f.endsWith('.js')).map(f => 'src/' + f)
  .concat(['error-handler2.js', 'version.js', 'toolbar_fit.js', 'export_menu.js'].filter(f => fs.existsSync(path.join(root, f))));
const bad = new Map();
for (const f of files) {
  const text = fs.readFileSync(path.join(root, f), 'utf8').split('\n');
  text.forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, '');                       // ignore line comments
    for (const m of code.matchAll(/\bmbState\.([A-Za-z_]\w*)/g)) {
      if (!declared.has(m[1])) { const k = m[1]; if (!bad.has(k)) bad.set(k, []); bad.get(k).push(f + ':' + (i + 1)); }
    }
  });
}
if (bad.size) {
  for (const [k, where] of bad) console.error(`mbState.${k} is not declared in src/mb_state.js (${where.slice(0, 3).join(', ')}${where.length > 3 ? ', …' : ''})`);
  console.error('Declare the key, with its empty value, in src/mb_state.js.');
  process.exit(1);
}
console.log(`check-state: all mbState keys used (${declared.size} declared) are declared.`);
