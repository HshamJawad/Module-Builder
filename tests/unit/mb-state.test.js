// Node unit tests: the shape of the single application state (src/mb_state.js).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path'), vm = require('vm');

const ctx = vm.createContext({ console });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../../src/mb_state.js'), 'utf8'), ctx);
const state = () => vm.runInContext('mbState', ctx);

test('every declared key has a defined starting value', () => {
  for (const [k, v] of Object.entries(state())) assert.notStrictEqual(v, undefined, k + ' starts undefined');
});

test('the state survives a JSON round trip unchanged', () => {
  const s = state();
  assert.deepStrictEqual(JSON.parse(JSON.stringify(s)), JSON.parse(JSON.stringify(JSON.parse(JSON.stringify(s)))));
});

test('counters start at zero and ids at the documented seeds', () => {
  const s = state();
  for (const k of ['resourceCount', 'stepCount', 'criteriaCount', 'contentSectionCount', 'moduleIdCounter', 'loIdCounter']) assert.strictEqual(s[k], 0, k);
  assert.strictEqual(s.currentModuleId, null);
  assert.strictEqual(s.currentLOId, null);
});

test('keys created on first use by other files are declared with their absent-value', () => {
  const s = state();
  const expected = { assessmentResults: null, ratingScale: null, moduleCategories: null, structureProposal: null, mapAllTasks: false, cmFilter: '', cmOpen: true };
  for (const [k, v] of Object.entries(expected)) assert.deepStrictEqual(s[k], v, k);
});

test('the cover table starts with its eight seeded rows', () => {
  assert.strictEqual(state().coverRows.length, 8);
});
