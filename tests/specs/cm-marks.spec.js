// 3.62.0: Task Analysis items written as marks (⛔ Warning …), and the
// project's own marks — src/custom_marks.js.
const { test, expect } = require('@playwright/test');
const { openApp, fixture, tab } = require('../helpers');

const HANDOFF = fixture('dacum-handoff.json');
const panel = (page, kind) => page.locator(`#mb-sp-${kind}`);

async function docxText(page) {
  const xml = await page.evaluate(async () => {
    let got = null;
    window.mbExportSink = { take: (b) => { got = b; return Promise.resolve(); }, skip: () => {}, fail: (e) => { throw e; } };
    try { await exportToDocx(); } finally { window.mbExportSink = null; }
    return new TextDecoder().decode(fflate.unzipSync(new Uint8Array(await got.arrayBuffer()))['word/document.xml']);
  });
  return xml.replace(/<w:p[ >]/g, '\n$&').replace(/<[^>]+>/g, '');
}

async function build(page, kind) {
  await tab(page, kind);
  await page.evaluate((k) => { mbSpViewFilter(k, 'all'); mbSpApproveMany(k, 'shown'); mbSpBuild(k, 'all'); }, kind);
  await page.waitForTimeout(300);
}

test('Distribution settings: a mark column; suggested marks; the items are built as marks', async ({ page }) => {
  const errors = await openApp(page, { handoff: HANDOFF, contentLang: 'en' });
  await page.evaluate(() => mbCovDefaults());
  const ov = page.locator('#mb-def-overlay');
  await expect(ov.locator('select[data-def-mark]')).toHaveCount(10);
  await expect(ov.locator('select[data-def-mark="safetyOSH"]')).toHaveValue('');      // as before by default
  await ov.locator('[data-act="mbCovMarksSuggest"]').click();
  await expect(ov.locator('select[data-def-mark="safetyOSH"]')).toHaveValue('warning');
  await expect(ov.locator('select[data-def-mark="commonErrorsTroubleshooting"]')).toHaveValue('attention');
  await ov.locator('[data-act="mbCovDefaultsSave"]').click();
  expect(await page.evaluate(() => mbState.cmMarks.workerBehaviours)).toBe('goodprac');

  await build(page, 'activity');
  const act = await page.evaluate(() => {
    const lo = mbState.learningOutcomesData.find(l => (l.activitySheets || []).some(s => (s.steps || []).some(st => (st.marks || []).length)));
    const sh = lo.activitySheets.find(s => (s.steps || []).some(st => (st.marks || []).length));
    return { steps: sh.steps.map(s => (s.text && s.text.en) || ''), marks: sh.steps.flatMap(s => s.marks || []) };
  });
  expect(act.marks).toContainEqual({ key: 'warning', text: 'Disconnect power' });          // no «Safety:» prefix
  expect(act.marks).toContainEqual({ key: 'attention', text: 'Skipping the power check' });
  expect(act.steps.join('\n')).not.toContain('Disconnect power');                          // not a step any more
  await build(page, 'info');
  const info = await page.evaluate(() => mbState.learningOutcomesData.flatMap(l => l.infoSheets || [])
    .flatMap(s => s.contentSections || []).flatMap(c => c.marks || []));
  expect(info).toContainEqual({ key: 'warning', text: 'Disconnect power' });
  const t = await docxText(page);
  expect(t).toContain('Warning');
  expect(t).toContain('Disconnect power');
  expect(errors).toEqual([]);
});

test('one item can be written as another mark, or as text', async ({ page }) => {
  const errors = await openApp(page, { handoff: HANDOFF, contentLang: 'en' });
  await page.evaluate(() => { mbState.cmMarks = { safetyOSH: 'warning' }; });
  await tab(page, 'activity');
  await page.evaluate(() => mbSpViewFilter('activity', 'all'));
  const sel = panel(page, 'activity').locator('.mb-sp-row', { hasText: 'Disconnect power' }).first().locator('select.mb-sp-mark');
  await expect(sel).toHaveValue('__default');
  await sel.selectOption('important');
  await page.evaluate(() => { mbSpApproveMany('activity', 'shown'); mbSpBuild('activity', 'all'); });
  await page.waitForTimeout(300);
  const marks = await page.evaluate(() => mbState.learningOutcomesData.flatMap(l => l.activitySheets || []).flatMap(s => s.steps || []).flatMap(s => s.marks || []));
  expect(marks).toContainEqual({ key: 'important', text: 'Disconnect power' });
  expect(errors).toEqual([]);
});

test('a custom mark: added from the sheet\'s mark menu, used, exported, kept after a reload', async ({ page }) => {
  const errors = await openApp(page, { lang: 'ar', contentLang: 'ar' });
  await page.evaluate(() => { _applyLOSwitch(mbState.learningOutcomesData[0].id); });
  await tab(page, 'activity');
  await page.locator('#steps-container [data-act="showAddMarkFor"]').first().click();
  await page.locator('.mark-dropdown-custom').click();
  await page.locator('#mb-cmk-name').fill('البيئة');
  await page.locator('.mb-cmk-pick[data-pick="icon"] .mb-cmk-opt').nth(1).click();
  await page.locator('[data-cmk="save"]').click();
  const mark = page.locator('#steps-container .mark-item').first();
  await expect(mark).toContainText('البيئة');
  await mark.locator('textarea').fill('تخلّص من البطاريات في الحاوية المخصصة');
  await page.locator('#title').fill('نشاط');
  await page.evaluate(() => saveCurrentSheetToLO());
  const key = await page.evaluate(() => mbState.customMarks[0].key);
  // the model (HTML, PDF) and Word print its name
  expect(await page.evaluate(() => mbBuildModuleModel('ar').outcomes[0].activitySheets[0].steps[0].marks[0].label)).toBe('البيئة');
  expect(await docxText(page)).toContain('البيئة');
  // in the Distribution settings list, and kept with the project
  await page.evaluate(() => mbLibrarySave({ force: true }));
  await page.reload();
  await page.waitForFunction(() => window.mbLib && mbLib.booted === true);
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => mbState.customMarks.map(m => m.key))).toEqual([key]);
  expect(await page.evaluate((k) => mbMarkOptionsHtml('').includes(k), key)).toBe(true);
  expect(errors).toEqual([]);
});
