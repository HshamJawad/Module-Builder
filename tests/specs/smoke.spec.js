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

// 3.38.0: Settings in the side navigation too, above Help, in every language.
test('side navigation: ⚙️ Settings opens the settings dialog', async ({ page }) => {
  const errors = await openApp(page);
  const btn = page.locator('#mb-sidenav #mb-settings-nav');
  await expect(btn).toBeVisible();
  await btn.click();
  await expect(page.locator('#ws-overlay')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.i18n.setLang('ar'));
  await expect(btn).toHaveText('⚙️ الإعدادات');
  expect(errors).toEqual([]);
});

// 3.39.0: the dialog is the tool's Settings; Export is a tab of it with
// Word & PDF, HTML and PowerPoint inside; the Export menu opens it there.
test('Settings dialog: titled Settings, Export is a tab with its own tabs', async ({ page }) => {
  const errors = await openApp(page);
  await page.locator('#mb-settings-nav').click();
  const ov = page.locator('#ws-overlay');
  await expect(ov.locator('#ws-head')).toHaveText('⚙️ Settings');
  await expect(ov.locator('.ws-nav-btn')).toHaveText(['📤Export', '🌐Language', '🧰Misc', '⌨️Shortcuts']);   // 3.42.0: Misc
  await expect(ov.locator('.ws-sub-btn')).toHaveCount(3);
  await expect(ov.locator('.ws-sub[data-pane="doc"]')).toBeVisible();
  await ov.locator('.ws-sub-btn[data-ws-sub="pptx"]').click();
  await expect(ov.locator('.ws-sub[data-pane="pptx"]')).toBeVisible();
  await expect(ov.locator('.ws-sub[data-pane="doc"]')).toBeHidden();
  await ov.locator('.ws-nav-btn[data-ws-pane="keys"]').click();
  await expect(ov.locator('[data-pane="keys"]')).toContainText('Settings');
  await ov.locator('#ws-close').click();
  await expect(ov).toHaveCount(0);
  // from the Export menu: straight to the Export tab
  await page.locator('#mb-exp-trigger').click();
  await page.locator('#word-settings-btn').click();
  await expect(page.locator('#ws-overlay .ws-nav-btn.is-on')).toHaveAttribute('data-ws-pane', 'export');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.i18n.setLang('ar'));
  await page.locator('#mb-settings-nav').click();
  await expect(page.locator('#ws-head')).toHaveText('⚙️ الإعدادات');
  expect(errors).toEqual([]);
});
