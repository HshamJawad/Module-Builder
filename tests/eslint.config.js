// Static checks for the app's own scripts (src/*.js and the root scripts).
//
// The app is ~85 classic <script> files that share one global scope, so
// "is this name defined?" cannot be answered file by file. The list of
// globals is therefore BUILT from the scripts themselves each run: every
// top-level function / var / let / const / class and every window.X = …
// counts as defined. `no-undef` then catches what has bitten this project
// before — a call to a function that no file defines (typo, renamed,
// script not loaded) — and nothing else.
//
// Cross-file duplicates (a later script silently shadowing an earlier
// one, see STATE.md) are caught by tools/check-globals.js.
const fs = require('fs');
const path = require('path');
const globals = require('globals');

const ROOT = path.join(__dirname, '..');   // run from the repository root: eslint -c tests/eslint.config.js .
const FILES = [
  ...fs.readdirSync(path.join(ROOT, 'src')).filter(f => f.endsWith('.js')).map(f => 'src/' + f),
  'error-handler2.js', 'version.js', 'sw.js', 'export_menu.js', 'toolbar_fit.js',
].filter(f => fs.existsSync(path.join(ROOT, f)));

const declared = new Set();
const TOP = /^(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)|^(?:var|let|const)\s+([A-Za-z_$][\w$]*)|^class\s+([A-Za-z_$][\w$]*)/;
for (const f of FILES) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const line of src.split('\n')) {
    const m = TOP.exec(line);
    if (m) declared.add(m[1] || m[2] || m[3]);
    // multi-declarations on one line: var a = 1, b = 2;
    const multi = /^(?:var|let|const)\s+([^;=]+=[^;]*);/.exec(line);
    if (multi) for (const part of multi[1].split(/,(?![^([{]*[)\]}])/)) { const n = /^\s*([A-Za-z_$][\w$]*)/.exec(part); if (n) declared.add(n[1]); }
  }
  for (const m of src.matchAll(/\b(?:window|global)\.([A-Za-z_$][\w$]*)\s*=[^=]/g)) declared.add(m[1]);
}

// Libraries loaded from vendor/ by <script> tags, and APIs the browser
// environment set does not list.
const vendor = ['docx', 'jspdf', 'fflate', 'pdfjsLib', 'PptxGenJS', 'JSZip', 'MB_KEYS'];
// Called only as `if (typeof X === 'function') X()` — an optional hook with no
// implementation (yet) or Node-only. Anything NOT guarded that is missing still fails.
const optional = ['mbRenderSheetMappedSource', 'mbAssessmentReferenceHtml', 'module'];

module.exports = [
  { ignores: ['node_modules/**'] },
  {
    files: FILES,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...Object.fromEntries([...declared, ...vendor, ...optional].map(n => [n, 'writable'])),
      },
    },
    linterOptions: { reportUnusedDisableDirectives: false },
    rules: {
      'no-undef': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-dupe-else-if': 'error',
      'no-duplicate-case': 'error',
      'no-unreachable': 'error',
      'no-func-assign': 'error',
      'no-const-assign': 'error',
      'no-self-assign': 'error',
      'no-unsafe-finally': 'error',
      'no-unsafe-negation': 'error',
      'use-isnan': 'error',
      'valid-typeof': 'error',
      'no-redeclare': ['error', { builtinGlobals: false }],
    },
  },
];
