// Node unit tests (no browser): the v3 → v4 project migration in src/bilang.js.
// Run: node --test tests/unit
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = vm.createContext({ console });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../../src/bilang.js'), 'utf8'), ctx);
const run = (code) => vm.runInContext(code, ctx);

// An old (schema v3) project: bare strings everywhere.
const v3 = () => ({
  moduleTitle: 'Welding basics',
  modules: [{
    title: 'مدخل إلى اللحام',
    outcomes: [{
      title: 'Weld a joint',
      infoSheets: [{ title: 'Safety', contentSections: [{ heading: 'مقدمة', text: 'Wear PPE' }] }],
      activitySheets: [{ title: 'Practice', criteria: ['Clean bead', 'تهوية جيدة'] }]
    }]
  }]
});

test('detects the side of a bare value', () => {
  assert.strictEqual(run("biDetectLang('hello')"), 'en');
  assert.strictEqual(run("biDetectLang('مرحبا')"), 'ar');
  assert.strictEqual(run("biDetectLang('')"), 'en');
});

test('biUpgrade puts Arabic text on the ar side and Latin on en', () => {
  const a = run("biUpgrade('مرحبا')"), e = run("biUpgrade('Hello')");
  assert.strictEqual(a.ar, 'مرحبا'); assert.strictEqual(a.en, '');
  assert.strictEqual(e.en, 'Hello'); assert.strictEqual(e.ar, '');
});

test('biUpgrade leaves an existing pair alone and tolerates null', () => {
  const pair = run("biNew('x','y')");
  assert.strictEqual(run('biUpgrade')(pair), pair);
  const n = run('biUpgrade')(null);
  assert.strictEqual(n.en, ''); assert.strictEqual(n.ar, '');
});

test('biMigrateProject sets schemaVersion 4 and is idempotent', () => {
  ctx.p = v3();
  const out = run('biMigrateProject(p)');
  assert.strictEqual(out.schemaVersion, 4);
  const snapshot = JSON.stringify(out);
  assert.strictEqual(JSON.stringify(run('biMigrateProject(p)')), snapshot);
});

test('biMigrateProject upgrades nested outcome and sheet fields without losing text', () => {
  ctx.p = v3();
  run('biMigrateProject(p)');
  const text = JSON.stringify(ctx.p);
  for (const s of ['Welding basics', 'مدخل إلى اللحام', 'Weld a joint', 'Safety', 'Wear PPE', 'Clean bead', 'تهوية جيدة']) {
    assert.ok(text.includes(s), 'lost: ' + s);
  }
  const m = ctx.p.modules[0];
  assert.strictEqual(m.title.ar, 'مدخل إلى اللحام');
  assert.strictEqual(m.outcomes[0].title.en, 'Weld a joint');
  assert.strictEqual(m.outcomes[0].infoSheets[0].contentSections[0].text.en, 'Wear PPE');
  const crit = ctx.p.modules[0].outcomes[0].activitySheets[0].criteria;
  assert.strictEqual(crit[0].en, 'Clean bead');
  assert.strictEqual(crit[1].ar, 'تهوية جيدة');
});

test('biMigrateProject ignores non-objects', () => {
  assert.strictEqual(run('biMigrateProject(null)'), null);
  assert.strictEqual(run("biMigrateProject('x')"), 'x');
});
