// 3.73.0: activity-sheet types — the Job Sheet in the Learner guide (where
// 'job' is the Worksheet), and «✏️ Custom name…» in both templates: a name
// typed for that one sheet, kept with it, printed as its heading.
const { test, expect } = require('@playwright/test');
const { openApp, fixture, tab } = require('../helpers');

async function wordText(page) {
  const xml = await page.evaluate(async () => {
    saveCurrentSheetToLO();
    let got = null;
    window.mbExportSink = { take: (b) => { got = b; return Promise.resolve(); }, skip: () => {}, fail: (e) => { throw e; } };
    try { await exportToDocx(); } finally { window.mbExportSink = null; }
    return new TextDecoder().decode(fflate.unzipSync(new Uint8Array(await got.arrayBuffer()))['word/document.xml']);
  });
  return xml.replace(/<w:p[ >]/g, '\n$&').replace(/<[^>]+>/g, '');
}

async function learnerGuide(page) {
  await page.evaluate(() => { const s = wsReadSettings(); s.templateConvert = true; wsWriteSettings(s); });
  await page.evaluate(() => mbSwitchTemplate('learnerGuide', { ask: false }));
  await page.waitForFunction(() => mbState.moduleTemplate === 'learnerGuide');
}

test('Learner guide: Learning activity, Worksheet, Job Sheet and a custom name; the Job Sheet printed as such', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), lang: 'en', contentLang: 'en' });
  await learnerGuide(page);
  await tab(page, 'activity');
  const sel = page.locator('#activity-sheet-type');
  expect(await sel.locator('option').evaluateAll(o => o.map(x => [x.value, x.textContent])))
    .toEqual([['activity', 'Learning activity'], ['job', 'Worksheet'], ['jobsheet', 'Job Sheet'], ['custom', '✏️ Custom name…']]);
  await expect(page.locator('#activity-sheet-type-name')).toBeHidden();
  await page.locator('#title').fill('Soldering a joint');
  await sel.selectOption('jobsheet');
  const t = await wordText(page);
  expect(t).toMatch(/Job Sheet: Soldering a joint/);
  expect(errors).toEqual([]);
});

for (const template of ['standard', 'learnerGuide']) {
  test(`${template}: a custom name typed for one sheet — shown on the sheet, kept, printed`, async ({ page }) => {
    const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), lang: 'en', contentLang: 'en' });
    if (template === 'learnerGuide') await learnerGuide(page);
    await tab(page, 'activity');
    const sel = page.locator('#activity-sheet-type');
    if (template === 'standard') {
      expect(await sel.locator('option').evaluateAll(o => o.map(x => x.value))).toEqual(['activity', 'task', 'job', 'operation', 'custom']);
    }
    await page.locator('#title').fill('Measuring parts');
    await sel.selectOption('custom');
    const box = page.locator('#activity-sheet-type-name');
    await expect(box).toBeVisible();
    await expect(box).toHaveAttribute('placeholder', 'Type the name of this sheet…');
    await box.fill('Practical Exercise');
    await expect(page.locator('[data-i18n="mbActivitySheetTitle"]')).toContainText('Practical Exercise');   // the title field's label follows
    await page.evaluate(() => { saveCurrentSheetToLO(); return mbLibrarySave({ force: true }); });
    await page.reload();
    await page.waitForFunction(() => window.mbLib && mbLib.booted === true);
    await page.waitForTimeout(400);
    await tab(page, 'activity');
    await expect(page.locator('#activity-sheet-type')).toHaveValue('custom');
    await expect(page.locator('#activity-sheet-type-name')).toHaveValue('Practical Exercise');
    const t = await wordText(page);
    expect(t).toContain('Practical Exercise');
    expect(t).toMatch(/Practical Exercise[^\n]*Measuring parts/);
    const html = await page.evaluate(() => mbBuildModuleHtml(mbBuildModuleModel('en'), {}));
    expect(html).toContain('Practical Exercise');
    // back to a listed type: the box goes, the type's own name is printed
    await page.locator('#activity-sheet-type').selectOption('activity');
    await expect(page.locator('#activity-sheet-type-name')).toBeHidden();
    expect(await wordText(page)).not.toContain('Practical Exercise');
    expect(errors).toEqual([]);
  });
}

test('a custom name per language: the Arabic name kept apart from the English one', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), lang: 'ar', contentLang: 'ar' });
  await tab(page, 'activity');
  await page.locator('#title').fill('قياس القطع');
  await page.locator('#activity-sheet-type').selectOption('custom');
  await expect(page.locator('#activity-sheet-type option[value="custom"]')).toHaveText('✏️ اسم مخصص…');
  await page.locator('#activity-sheet-type-name').fill('تمرين عملي');
  await page.evaluate(() => saveCurrentSheetToLO());
  expect(await page.evaluate(() => mbCurrentLOObject().activitySheets[mbState.currentActivitySheetIndex].sheetTypeName))
    .toEqual({ en: '', ar: 'تمرين عملي', fr: '' });
  await page.setViewportSize({ width: 360, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});
