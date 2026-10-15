// 3.50.0: the assessment form's «Result» — options shown as they print,
// not clickable; the project's own options (Pass / Not pass, a rubric …)
// per language; empty boxes in Word and PDF, real checkboxes in HTML.
// The form's cells grow with their text. Clear All offers to delete the
// sources kept on the device.
const { test, expect } = require('@playwright/test');
const { openApp, fixture, tab } = require('../helpers');

async function buildForms(page) {
  // sheets too: an outcome with no sheet is not exported, nor its form
  for (const k of ['info', 'activity']) {
    await tab(page, k);
    await page.evaluate((k) => { mbSpViewFilter(k, 'all'); mbSpApproveMany(k, 'shown'); mbSpBuild(k, 'all'); }, k);
  }
  await tab(page, 'assessment');
  await page.evaluate(() => {
    mbState.learningOutcomesData.forEach(lo => { _applyLOSwitch(lo.id); mbSpViewFilter('assessment', 'lo'); mbSpApproveMany('assessment', 'shown'); mbSpBuild('assessment', 'all'); });
    _applyLOSwitch(mbState.learningOutcomesData[0].id);
  });
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

test('result: shown as printed, no checkbox; options changed to a ready-made set, kept, exported', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
  await buildForms(page);
  const form = page.locator('#assessment-forms-list');
  await expect(form.locator('.mb-asm-opts').first()).toContainText('☐ Competent');
  await expect(form.locator('.mb-asm-opts').first()).toContainText('☐ Not Yet Competent');
  await expect(form.locator('[data-act="updateAssessmentResult"]')).toHaveCount(0);
  await form.locator('[data-act="mbAsmResultEdit"]').first().click();
  const ov = page.locator('#asm-overlay');
  await expect(ov.locator('#asm-text')).toHaveValue('Competent\nNot Yet Competent');
  await ov.locator('[data-preset="pass"]').click();
  await expect(ov.locator('#asm-text')).toHaveValue('Pass\nNot pass');
  await ov.locator('#asm-save').click();
  await expect(form.locator('.mb-asm-opts').first()).toHaveText(/☐ Pass\s*☐ Not pass/);
  expect(await page.evaluate(() => ['en', 'fr', 'ar'].map(l => mbAsmResultLabels(l)))).toEqual([['Pass', 'Not pass'], ['Réussi', 'Non réussi'], ['ناجح', 'غير ناجح']]);

  const text = await docxText(page);
  expect(text).toContain('☐ Pass');
  expect(text).toContain('☐ Not pass');
  expect(text).not.toContain('Not Yet Competent');
  const html = await page.evaluate(() => mbBuildModuleHtml(mbBuildModuleModel('en')));
  expect(html).toMatch(/<input type="checkbox" data-check="asm-0-r-0"[^>]*> Pass<\/label>/);
  const ar = await page.evaluate(() => mbBuildModuleModel('ar').assessment[0].results);
  expect(ar).toEqual(['ناجح', 'غير ناجح']);

  // kept with the project
  await page.waitForTimeout(900);
  await page.evaluate(() => mbLibrarySave && mbLibrarySave());
  await page.waitForTimeout(500);
  await page.reload();
  await page.waitForFunction(() => window.mbLib && window.mbLib.booted === true);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => mbAsmResultLabels('en'))).toEqual(['Pass', 'Not pass']);
  expect(errors).toEqual([]);
});

test('result options typed by hand for one language; Defaults restores', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
  await buildForms(page);
  await page.locator('[data-act="mbAsmResultEdit"]').first().click();
  const ov = page.locator('#asm-overlay');
  await ov.locator('#asm-text').fill('Exceeds standard\nMeets standard\n\nBelow standard');
  await ov.locator('#asm-save').click();
  expect(await page.evaluate(() => [mbAsmResultLabels('en'), mbAsmResultLabels('fr')])).toEqual([
    ['Exceeds standard', 'Meets standard', 'Below standard'], ['Compétent', 'Pas encore compétent']]);
  await page.locator('[data-act="mbAsmResultEdit"]').first().click();
  await ov.locator('#asm-def').click();
  await ov.locator('#asm-save').click();
  expect(await page.evaluate(() => mbState.assessmentResults)).toBeNull();
  expect(errors).toEqual([]);
});

test('form cells grow with their text and can be dragged taller', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
  await buildForms(page);
  const cell = page.locator('#assessment-forms-list textarea.mb-asm-cell').first();
  await expect(cell).toBeVisible();
  const long = 'Hand tools are used according to the manufacturer’s specifications and the workshop safety rules, and are cleaned and stored after use. '.repeat(3);
  await cell.fill(long);
  await cell.dispatchEvent('change');
  const m = await cell.evaluate(el => ({ h: el.clientHeight, sh: el.scrollHeight, resize: getComputedStyle(el).resize }));
  expect(m.resize).toBe('vertical');
  expect(m.h).toBeGreaterThan(60);                 // grown, not a one-line box
  expect(m.sh - m.h).toBeLessThan(4);              // the whole text is visible
  const stored = await page.evaluate(() => { const f = mbState.assessmentFormsData[mbState.learningOutcomesData[0].id]; const c = f.rows[0].criteria; return typeof c === 'string' ? c : c.en; });
  expect(stored).toBe(long);
  expect(errors).toEqual([]);
});

test('Clear All asks whether the sources kept on the device go too', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
  await page.evaluate(() => mbSrcAddText('Book to remove', 'text '.repeat(900)));
  await page.evaluate(() => { clearAll(); });
  const dlg = page.locator('.mb-dialog-overlay');
  await dlg.locator('button').last().click();                     // clear the project
  await expect(dlg).toContainText('1 source(s)');
  await dlg.locator('button').last().click();                     // and the sources
  await expect.poll(() => page.evaluate(async () => (await mbSources.list()).length)).toBe(0);
  expect(errors).toEqual([]);
});

test('typing your own options: selecting text and releasing outside the box keeps the dialog; saved options show and export', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
  await buildForms(page);
  await page.locator('[data-act="mbAsmResultEdit"]').first().click();
  const ov = page.locator('#asm-overlay');
  const ta = ov.locator('#asm-text');
  await ta.fill('Ready for work\nNeeds more practice');
  // drag-select from inside the box to the backdrop, as a user does
  const b = await ta.boundingBox();
  await page.mouse.move(b.x + 20, b.y + 12);
  await page.mouse.down();
  await page.mouse.move(5, 5, { steps: 5 });
  await page.mouse.up();
  await expect(ov).toBeVisible();
  // a click on the backdrop with unsaved typing does not close it either
  await page.mouse.click(5, 5);
  await expect(ov).toBeVisible();
  await ov.locator('#asm-save').click();
  await expect(ov).toHaveCount(0);
  await expect(page.locator('.mb-asm-opts').first()).toHaveText(/☐ Ready for work\s*☐ Needs more practice/);
  const text = await docxText(page);
  expect(text).toContain('☐ Ready for work');
  expect(text).toContain('☐ Needs more practice');
  expect(errors).toEqual([]);
});
