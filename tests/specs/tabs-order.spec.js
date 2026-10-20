// 3.63.0: the tabs in the order of the exported document — Module, Module
// Information, Front Cover, Introduction, sheets, Assessment, References,
// Back Cover. Only places on screen moved: saving and the export are unchanged.
const { test, expect } = require('@playwright/test');
const { openApp, tab } = require('../helpers');

test('the side navigation order, and each part in its own tab', async ({ page }) => {
  const errors = await openApp(page, { lang: 'en' });
  const names = await page.locator('#mb-sidenav .tabs .tab').evaluateAll(b => b.map(x => x.getAttribute('data-args') || x.id));
  expect(names).toEqual(['["basic-info"]', '["module-info"]', '["covers"]', '["intro"]', '["info"]', '["activity"]',
    '["assessment"]', '["references"]', '["back-cover"]', 'mb-settings-nav', '["help"]']);
  const inTab = (id) => page.evaluate(i => document.getElementById(i).closest('.tab-content').id, id);
  expect(await inTab('covers-table-container')).toBe('module-info-tab');
  expect(await inTab('covers-additional-info')).toBe('module-info-tab');
  expect(await inTab('front-cover-upload-area')).toBe('covers-tab');
  expect(await inTab('back-cover-upload-area')).toBe('back-cover-tab');
  await tab(page, 'module-info');
  await expect(page.locator('#mb-tab-title')).toHaveText('📋 Module Information');
  await expect(page.locator('#covers-table-container')).toBeVisible();
  await tab(page, 'back-cover');
  await expect(page.locator('#back-cover-upload-area')).toBeVisible();
  // the «Proceed» chain follows the new order
  await tab(page, 'basic-info');
  await page.locator('#basic-info-tab [data-act="proceedToTab"]').click();
  await expect(page.locator('#module-info-tab')).toHaveClass(/active/);
  await page.locator('#module-info-tab [data-act="proceedToTab"]').click();
  await expect(page.locator('#covers-tab')).toHaveClass(/active/);
  expect(errors).toEqual([]);
});

test('the module information table is saved and exported as before', async ({ page }) => {
  const errors = await openApp(page, { lang: 'en', contentLang: 'en' });
  await tab(page, 'module-info');
  const val = page.locator('#covers-table-container textarea, #covers-table-container input[type="text"]').nth(1);
  await val.fill('Automotive sector');
  await val.dispatchEvent('change');
  await page.evaluate(() => mbLibrarySave({ force: true }));
  await page.reload();
  await page.waitForFunction(() => window.mbLib && mbLib.booted === true);
  await page.waitForTimeout(400);
  const kept = await page.evaluate(() => mbState.coverRows.some(r => r.value && r.value.en === 'Automotive sector'));
  expect(kept).toBe(true);
  const xml = await page.evaluate(async () => {
    const lo = mbState.learningOutcomesData[0];
    lo.infoSheets = [{ title: { en: 'Sheet', ar: '', fr: '' }, contentSections: [] }];
    saveCurrentModuleLOData(); mbState.currentLOId = null; _applyLOSwitch(lo.id);
    let got = null;
    window.mbExportSink = { take: (b) => { got = b; return Promise.resolve(); }, skip: () => {}, fail: (e) => { throw e; } };
    try { await exportToDocx(); } finally { window.mbExportSink = null; }
    return new TextDecoder().decode(fflate.unzipSync(new Uint8Array(await got.arrayBuffer()))['word/document.xml']);
  });
  expect(xml).toContain('Automotive sector');
  expect(errors).toEqual([]);
});
