// 3.72.0: a content card's heading is typed straight into the card (no
// Rename), with an optional subheading (➕ Subheading); both are kept with
// the sheet and printed bold above the paragraph in Word, HTML and PDF —
// standard template and Learner guide.
const { test, expect } = require('@playwright/test');
const { openApp, fixture, tab } = require('../helpers');

async function wordXml(page) {
  return page.evaluate(async () => {
    saveCurrentSheetToLO();
    let got = null;
    window.mbExportSink = { take: (b) => { got = b; return Promise.resolve(); }, skip: () => {}, fail: (e) => { throw e; } };
    try { await exportToDocx(); } finally { window.mbExportSink = null; }
    return new TextDecoder().decode(fflate.unzipSync(new Uint8Array(await got.arrayBuffer()))['word/document.xml']);
  });
}
/** The run properties of the paragraph holding `text`. */
function runOf(xml, text) {
  const i = xml.indexOf(text);
  expect(i, text).toBeGreaterThan(-1);
  return xml.slice(xml.lastIndexOf('<w:r>', i), i);
}

for (const template of ['standard', 'learnerGuide']) {
  test(`${template}: heading typed in the card, an optional subheading, both printed bold above the paragraph`, async ({ page }) => {
    const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), lang: 'en', contentLang: 'en' });
    if (template === 'learnerGuide') {
      await page.evaluate(() => { const s = wsReadSettings(); s.templateConvert = true; wsWriteSettings(s); });
      await page.evaluate(() => mbSwitchTemplate('learnerGuide', { ask: false }));
      await page.waitForFunction(() => mbState.moduleTemplate === 'learnerGuide');
    }
    await tab(page, 'info');
    await page.locator('#info-title').fill('How to use a soldering iron');
    const card = page.locator('.content-section-item').first();
    await expect(card.locator('[data-act="renameContentSection"]')).toHaveCount(0);      // no Rename
    await expect(card.locator('.cs-sub-row')).toBeHidden();
    await card.locator('[data-cs-heading]').fill('1- Taking Protection Measures');
    await card.locator('.btn-cs-sub').click();
    await expect(card.locator('[data-cs-sub]')).toBeFocused();
    await card.locator('[data-cs-sub]').fill('Personal protective equipment');
    await card.locator('textarea[data-content-id]').fill('Wear safety glasses and gloves.');

    // kept after a reload, the subheading box shown because it has text
    await page.evaluate(() => { saveCurrentSheetToLO(); return mbLibrarySave({ force: true }); });
    await page.reload();
    await page.waitForFunction(() => window.mbLib && mbLib.booted === true);
    await page.waitForTimeout(400);
    await tab(page, 'info');
    const c2 = page.locator('.content-section-item').first();
    await expect(c2.locator('[data-cs-heading]')).toHaveValue('1- Taking Protection Measures');
    await expect(c2.locator('[data-cs-sub]')).toBeVisible();
    await expect(c2.locator('[data-cs-sub]')).toHaveValue('Personal protective equipment');

    // Word: heading (bold, heading colour), subheading (bold), then the paragraph
    const xml = await wordXml(page);
    const h = xml.indexOf('1- Taking Protection Measures'), s = xml.indexOf('Personal protective equipment'), p = xml.indexOf('Wear safety glasses');
    expect(h).toBeGreaterThan(-1);
    expect(h).toBeLessThan(s);
    expect(s).toBeLessThan(p);
    expect(runOf(xml, '1- Taking Protection Measures')).toContain('<w:b/>');
    expect(runOf(xml, 'Personal protective equipment')).toContain('<w:b/>');
    expect(xml).not.toContain('Content 1');
    // HTML too
    const html = await page.evaluate(() => mbBuildModuleHtml(mbBuildModuleModel('en'), {}));
    expect(html).toContain('1- Taking Protection Measures');
    expect(html).toContain('mx-sub2');

    // ➕ Subheading again removes it
    await c2.locator('.btn-cs-sub').click();
    await expect(c2.locator('.cs-sub-row')).toBeHidden();
    await page.evaluate(() => saveCurrentSheetToLO());
    expect(await page.evaluate(() => mbCurrentLOObject().infoSheets[mbState.currentInfoSheetIndex].contentSections[0].subheading.en)).toBe('');
    expect(errors).toEqual([]);
  });
}

test('a heading written before this release shows in the box; Arabic placeholders; each language keeps its own', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), lang: 'ar', contentLang: 'ar' });
  await page.evaluate(() => {
    const lo = mbCurrentLOObject() || mbState.learningOutcomesData[0];
    lo.infoSheets = [{ title: { en: 'Sheet', ar: 'ورقة', fr: '' }, contentSections: [
      { contentId: '1', uid: 'u1', heading: { en: 'Old heading', ar: 'عنوان قديم', fr: '' }, text: { en: 'x', ar: 'نص', fr: '' }, marks: [], tables: [] }] }];
    saveCurrentModuleLOData(); mbState.currentLOId = null; _applyLOSwitch(lo.id);
  });
  await tab(page, 'info');
  const card = page.locator('.content-section-item').first();
  await expect(card.locator('[data-cs-heading]')).toHaveValue('عنوان قديم');
  await expect(card.locator('[data-cs-heading]')).toHaveAttribute('placeholder', 'العنوان الرئيسي لهذه الفقرة (اختياري)…');
  await expect(card.locator('.btn-cs-sub')).toHaveText('➕ عنوان ثانوي');
  await card.locator('[data-cs-heading]').fill('عنوان جديد');
  await page.evaluate(() => saveCurrentSheetToLO());
  expect(await page.evaluate(() => mbCurrentLOObject().infoSheets[0].contentSections[0].heading))
    .toEqual({ en: 'Old heading', ar: 'عنوان جديد', fr: '' });
  await page.setViewportSize({ width: 360, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});
