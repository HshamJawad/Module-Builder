#!/usr/bin/env node
// Checks mb-styles.css: it must parse, contain no exact-duplicate rules,
// and no rule whose class/id names appear nowhere in the app (dead CSS).
// Run from the repo root:  node tools/check-css.js   (needs tests/ deps)
// Class names built at run time ("ws-c-" + hex, "is-" + state) cannot be
// found as whole words, so those prefixes are listed in DYNAMIC below.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const nm = path.join(root, 'tests', 'node_modules');
const postcss = require(path.join(nm, 'postcss'));
const sp = require(path.join(nm, 'postcss-selector-parser'));
const DYNAMIC = [/^ws-c-/, /^ws-msg-/, /^mb-tpl-/, /^is-/, /^mb-hw-dot$/, /^mb-hw-badge$/];

let css = fs.readFileSync(path.join(root, 'mb-styles.css'), 'utf8'), tree;
try { tree = postcss.parse(css); } catch (e) { console.error('CSS does not parse: ' + e.message); process.exit(1); }

const files = ['index.html', 'module-builder-guide.html', 'sw.js', 'error-handler2.js', 'version.js', 'toolbar_fit.js', 'export_menu.js']
  .filter(f => fs.existsSync(path.join(root, f)))
  .concat(fs.readdirSync(path.join(root, 'src')).filter(f => f.endsWith('.js')).map(f => 'src/' + f));
const corpus = files.map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');

const ctx = n => { let p = n.parent, m = []; while (p && p.type !== 'root') { if (p.type === 'atrule') m.push(p.name + ' ' + p.params); p = p.parent; } return m.reverse().join('|'); };
const names = sel => { const t = []; try { sp(s => s.walk(n => { if (n.type === 'class' || n.type === 'id') t.push(n.value); })).processSync(sel); } catch (e) {} return t; };
const seen = new Map(), cache = new Map(); let problems = 0;
tree.walkRules(r => {
  if (r.parent.type === 'atrule' && /keyframes/.test(r.parent.name)) return;
  const key = ctx(r) + '||' + r.selector.replace(/\s+/g, ' ') + '||' + r.nodes.filter(n => n.type === 'decl').map(d => d.prop + ':' + d.value).join(';');
  const line = r.source.start.line;
  if (seen.has(key)) { console.error(`duplicate rule at line ${line} (same as line ${seen.get(key)}): ${r.selector.slice(0, 80)}`); problems++; } else seen.set(key, line);
  const parts = r.selector.split(',');
  const allDead = parts.every(p => { const t = names(p); return t.length && t.some(v => { if (!cache.has(v)) cache.set(v, DYNAMIC.some(d => d.test(v)) || corpus.includes(v)); return !cache.get(v); }); });
  if (allDead) { console.error(`unused selector at line ${line}: ${r.selector.replace(/\s+/g, ' ').slice(0, 80)}`); problems++; }
});
if (problems) { console.error(problems + ' CSS problem(s). Remove the rule, or add its name prefix to DYNAMIC if it is built at run time.'); process.exit(1); }
console.log('check-css: mb-styles.css parses; no duplicate or unused rules.');
