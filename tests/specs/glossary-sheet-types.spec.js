// 3.42.0: the Glossary of Terms (References tab), the activity-sheet types
// with their names in Settings → Misc, and the "within the required time"
// row of the performance criteria checklist.
const { test, expect } = require('@playwright/test');
const { openApp, fixture, tab, openNav } = require('../helpers');

async function buildActivity(page) {
  await tab(page, 'activity');
  await page.evaluate(() => { mbSpViewFilter('activity', 'all'); mbSpApproveMany('activity', 'shown'); mbSpBuild('activity', 'all'); });
}

async function reopen(page) {
  await page.reload();
  await page.waitForFunction(() => window.mbLib && window.mbLib.booted === true);
  await page.waitForTimeout(500);
}

/** The Word export's text, one line per paragraph. */
async function docxText(page) {
  const xml = await page.evaluate(async () => {
    let got = null;
    window.mbExportSink = { take: (b) => { got = b; return Promise.resolve(); }, skip: () => {}, fail: (e) => { throw e; } };
    try { await exportToDocx(); } finally { window.mbExportSink = null; }
    return new TextDecoder().decode(fflate.unzipSync(new Uint8Array(await got.arrayBuffer()))['word/document.xml']);
  });
  return xml.replace(/<w:p[ >]/g, '\n$&').replace(/<[^>]+>/g, '');
}

/** Type into one cell of the n-th glossary table. */
async function cell(page, r, c, text, n = 0) {
  const ta = page.locator('#content-tables-glossary .content-table-widget').nth(n)
    .locator(`textarea[data-row="${r}"][data-col="${c}"]`);
  await ta.fill(text);
}

test('glossary: built in the References tab, saved, exported before the references', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
  await tab(page, 'references');
  await expect(page.locator('#glossary-title-display')).toHaveText('📖 Glossary of Terms');
  await page.locator('#btn-add-glossary-table').click();
  const t0 = page.locator('#content-tables-glossary .content-table-widget');
  await expect(t0).toHaveCount(1);
  await expect(t0.locator('textarea[data-row="0"][data-col="0"]')).toHaveValue('Term');
  await expect(t0.locator('textarea[data-row="0"][data-col="1"]')).toHaveValue('Definition');
  await cell(page, 1, 0, 'Multimeter');
  await cell(page, 1, 1, 'An instrument that measures voltage, current and resistance.');
  // a reference, so the order can be checked
  await page.locator('#references-list .ref-input').first().fill('Smith, J. (2020). Electrical Basics.');
  await page.waitForTimeout(900);

  await reopen(page);
  await tab(page, 'references');
  await expect(page.locator('#content-tables-glossary textarea[data-row="1"][data-col="0"]')).toHaveValue('Multimeter');

  const text = await docxText(page);
  const g = text.indexOf('\nGlossary of Terms');
  const r = text.lastIndexOf('\nReferences');
  expect(g).toBeGreaterThan(-1);
  expect(r).toBeGreaterThan(g);
  expect(text.slice(g, r)).toContain('Multimeter');

  // the model (PDF, HTML): the same glossary, heading in each language
  const m = await page.evaluate(() => ({
    en: mbBuildModuleModel('en').glossary, ar: mbBuildModuleModel('ar').glossary.title,
    fr: mbBuildModuleModel('fr').glossary.title }));
  expect(m.en.title).toBe('Glossary of Terms');
  expect(m.en.tables[0].cells[1]).toEqual(['Multimeter', 'An instrument that measures voltage, current and resistance.']);
  expect(m.ar).toBe('مسرد المصطلحات');
  expect(m.fr).toBe('Glossaire');
  expect(errors).toEqual([]);
});

test('glossary: removing its only table removes it from the export', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
  await tab(page, 'references');
  await page.locator('#btn-add-glossary-table').click();
  await cell(page, 1, 0, 'Fuse');
  await page.locator('#content-tables-glossary [data-act="ctRemove"]').click();
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => mbState.glossary.tables.length)).toBe(0);
  expect(await page.evaluate(() => mbBuildModuleModel('en').glossary.tables.length)).toBe(0);
  expect(errors).toEqual([]);
});

test('sheet type: chosen on the sheet, named in the export, renamed in Settings → Misc; time row', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
  await buildActivity(page);
  await tab(page, 'activity');
  await page.evaluate(() => { _applyLOSwitch(mbState.learningOutcomesData[0].id); mbState.currentActivitySheetIndex = 0; loadActivitySheetAtIndex(mbState.learningOutcomesData[0], 0); });
  await page.waitForTimeout(200);
  const sel = page.locator('#activity-sheet-type');
  await expect(sel).toHaveValue('activity');
  await expect(sel.locator('option')).toHaveText(['Activity/Job Sheet', 'Task Sheet', 'Job Sheet', 'Operation Sheet', '✏️ Custom name…']);   // 3.73.0: + custom
  await sel.selectOption('job');
  await page.locator('#duration').fill('30');
  await page.evaluate(() => saveCurrentSheetToLO());
  const sh = await page.evaluate(() => {
    const s = mbState.learningOutcomesData[0].activitySheets[0];
    return { type: s.sheetType, num: s.sheetNumber, title: s.title.en || s.title };
  });
  expect(sh.type).toBe('job');

  let text = await docxText(page);
  expect(text).toContain(`Job Sheet ${sh.num} / ${sh.title}`);
  expect(text).toContain('The activity was completed within the required time (30 minutes).');

  // Settings → Misc: rename the type, switch the time row off
  await openNav(page);                 // 3.81.1: on a phone the side navigation is a drawer
  await page.locator('#mb-settings-nav').click();
  const ov = page.locator('#ws-overlay');
  await ov.locator('.ws-nav-btn[data-ws-pane="misc"]').click();
  await expect(ov.locator('[data-pane="misc"]')).toBeVisible();
  await ov.locator('input[data-ws-label="en:job"]').fill('Practical Job Sheet');
  await ov.locator('input[data-ws-misc="checklistTime"]').uncheck();
  await ov.locator('#ws-save').click();
  await ov.locator('#ws-close').click();
  await expect(sel.locator('option[value="job"]')).toHaveText('Practical Job Sheet');

  text = await docxText(page);
  expect(text).toContain(`Practical Job Sheet ${sh.num} / ${sh.title}`);
  expect(text).not.toContain('within the required time');

  // kept after a reload, sheet and settings
  await page.waitForTimeout(900);
  await reopen(page);
  await tab(page, 'activity');
  await page.evaluate(() => { _applyLOSwitch(mbState.learningOutcomesData[0].id); mbState.currentActivitySheetIndex = 0; loadActivitySheetAtIndex(mbState.learningOutcomesData[0], 0); });
  await page.waitForTimeout(200);
  await expect(page.locator('#activity-sheet-type')).toHaveValue('job');
  expect(errors).toEqual([]);
});

test('untouched: Activity/Job Sheet heading as before, and no time row on a sheet without a duration', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
  await buildActivity(page);
  const text = await docxText(page);
  expect(text).toMatch(/Activity\/Job Sheet \d+-\d+ \//);
  expect(text).not.toContain('within the required time');
  expect(errors).toEqual([]);
});

test('Arabic, 360 px: the Misc pane and the glossary fit; Arabic names', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  const errors = await openApp(page, { lang: 'ar', contentLang: 'ar' });
  await tab(page, 'references');
  await expect(page.locator('#glossary-title-display')).toHaveText('📖 مسرد المصطلحات');
  await page.locator('#btn-add-glossary-table').click();
  await expect(page.locator('#content-tables-glossary textarea[data-row="0"][data-col="0"]')).toHaveValue('المصطلح');
  const noScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
  expect(await noScroll()).toBe(true);
  await openNav(page);                 // 360 px: the side navigation is a drawer
  await page.locator('#mb-settings-nav').click();
  const ov = page.locator('#ws-overlay');
  await ov.locator('.ws-nav-btn[data-ws-pane="misc"]').click();
  await expect(ov.locator('[data-pane="misc"]')).toContainText('أسماء الأوراق');
  await expect(ov.locator('input[data-ws-label="ar:task"]')).toHaveAttribute('placeholder', 'ورقة المهمة');
  expect(await noScroll()).toBe(true);
  expect(errors).toEqual([]);
});
