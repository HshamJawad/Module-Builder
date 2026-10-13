// The app starts in EN / FR / AR with no script error, and a DACUM Live
// Pro handoff becomes a module with its outcomes and Task Analysis.
const { test, expect } = require('@playwright/test');
const { openApp, fixture, openModule } = require('../helpers');

for (const lang of ['en', 'fr', 'ar']) {
  test(`starts cleanly in ${lang}`, async ({ page }) => {
    const errors = await openApp(page, { lang });
    await expect(page.locator('#mb-sidenav')).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('a DACUM handoff becomes a module with outcomes and Task Analysis', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json') });
  const m = await openModule(page);
  expect(m.moduleCode).toBe('CMT 1');
  expect(m.learningOutcomes.length).toBe(3);
  expect(Object.keys(m.taskAnalysisSource.taskAnalysis)).toEqual(expect.arrayContaining(['duty_1_1', 'duty_2_3']));
  expect(errors).toEqual([]);
});

// Offline: every script and stylesheet index.html loads is in the
// service worker's precache list (sw.js), so the app still opens offline.
test('every asset index.html loads is precached by sw.js', async () => {
  const fs = require('fs');
  const path = require('path');
  const root = path.join(__dirname, '..', '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const precached = new Set([...sw.matchAll(/BASE\s*\+\s*'([^']+)'/g)].map(m => m[1]));
  const refs = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))(?:\?[^"]*)?"/g)]
    .map(m => m[1].replace(/^\.\//, '')).filter(u => !/^(https?:)?\/\//.test(u) && !u.startsWith('/'));
  const missing = refs.filter(u => !precached.has(u));
  expect(missing).toEqual([]);
  for (const u of precached) if (u && !u.endsWith('/')) expect(fs.existsSync(path.join(root, u)), u).toBe(true);
});
