// 3.51.0: the rating scale and passing standard — optional on an
// activity sheet (instead of the trainee's Yes / No self-check) and on an
// assessment form (the trainer's rating of each criterion).
const { test, expect } = require('@playwright/test');
const { openApp, fixture, tab } = require('../helpers');

async function buildAll(page) {
  for (const k of ['info', 'activity', 'assessment']) {
    await tab(page, k);
    await page.evaluate((k) => { mbState.learningOutcomesData.forEach(lo => { _applyLOSwitch(lo.id); mbSpViewFilter(k, 'lo'); mbSpApproveMany(k, 'shown'); mbSpBuild(k, 'all'); }); _applyLOSwitch(mbState.learningOutcomesData[0].id); }, k);
  }
}
async function docxText(page) {
  const xml = await page.evaluate(async () => {
    let got = null;
    window.mbExportSink = { take: (b) => { got = b; return Promise.resolve(); }, skip: () => {}, fail: (e) => { throw e; } };
    try { await exportToDocx(); } finally { window.mbExportSink = null; }
    return new TextDecoder().decode(fflate.unzipSync(new Uint8Array(await got.arrayBuffer()))['word/document.xml']);
  });
  return xml.replace(/<w:p[ >]/g, '\n$&').replace(/<[^>]+>/g, '');
}

test('activity sheet: Yes / No by default; the scale replaces it on that sheet only, with the passing standard', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
  await buildAll(page);
  await tab(page, 'activity');
  await page.evaluate(() => { mbState.currentActivitySheetIndex = 0; loadActivitySheetAtIndex(mbState.learningOutcomesData[0], 0); });
  const tog = page.locator('#act-scale-host input[type="checkbox"]');
  await expect(tog).not.toBeChecked();
  let text = await docxText(page);
  expect(text).toContain('Yes');
  await tog.check();
  await expect(page.locator('#act-scale-host')).toContainText('Not yet · Acceptable · Proficient');
  await expect(page.locator('#act-scale-host')).toContainText('«Acceptable» or higher on every criterion');
  expect(await page.evaluate(() => mbState.learningOutcomesData[0].activitySheets[0].useScale)).toBe(true);
  // survives saving the sheet from the screen
  await page.evaluate(() => saveCurrentSheetToLO());
  expect(await page.evaluate(() => mbState.learningOutcomesData[0].activitySheets[0].useScale)).toBe(true);
  text = await docxText(page);
  expect(text).toContain('Proficient');
  expect(text).toContain('Passing standard: «Acceptable» or higher on every criterion.');
  const m = await page.evaluate(() => mbBuildModuleModel('ar').outcomes[0].activitySheets.map(s => s.criteria.scale));
  expect(m[0]).toEqual(['لم يُتقن بعد', 'مقبول', 'متقن']);
  expect(m.slice(1).every(x => x === null)).toBe(true);
  const html = await page.evaluate(() => mbBuildModuleHtml(mbBuildModuleModel('en')));
  expect(html).toContain('class="mx-tbl mx-scale"');
  expect(html).toMatch(/type="radio" name="[^"]+-s-0"/);
  expect(errors).toEqual([]);
});

test('assessment form: the trainer rates each criterion; scale changed to 0–3 with a typed standard', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
  await buildAll(page);
  await tab(page, 'assessment');
  const form = page.locator('#assessment-forms-list');
  await form.locator('.mb-scale-form input[type="checkbox"]').first().check();
  await expect(form.locator('.mb-scale-form').first()).toContainText('Not yet · Acceptable · Proficient');
  await form.locator('[data-act="mbScaleEdit"]').first().click();
  const ov = page.locator('#sc-overlay');
  await ov.locator('[data-preset="num"]').click();
  await ov.locator('#sc-pass').fill('At least 2 on every criterion, and 3 on safety.');
  await ov.locator('#sc-save').click();
  await expect(form.locator('.mb-scale-form').first()).toContainText('0 · 1 · 2 · 3');
  await expect(form.locator('.mb-scale-form').first()).toContainText('At least 2 on every criterion, and 3 on safety.');
  const text = await docxText(page);
  expect(text).toContain('Rating of the criteria');
  expect(text).toContain('At least 2 on every criterion, and 3 on safety.');
  expect(await page.evaluate(() => mbScalePass('fr'))).toBe('Critère de réussite : « 2 » ou plus pour chaque critère.');
  // kept with the project
  await page.evaluate(() => mbLibrarySave && mbLibrarySave());
  await page.waitForTimeout(600);
  await page.reload();
  await page.waitForFunction(() => window.mbLib && window.mbLib.booted === true);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => mbScaleLevels('en'))).toEqual(['0', '1', '2', '3']);
  expect(errors).toEqual([]);
});
