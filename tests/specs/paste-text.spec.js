// 3.74.0: 📝 Paste text — the clipboard's text into a content box, cleaned
// (src/paste_text.js): information sheet content, activity steps,
// self-check, assessment content, introduction details, sections.
const { test, expect } = require('@playwright/test');
const { openApp, fixture, tab } = require('../helpers');

const PDF_TEXT = 'Many of those who have never used a soldering iron fear dam-\nage to the electrical circuits they repair, but the most\nimportant thing is to keep the person working   protected.\n\n\n\n2- Choosing a Good Soldering Iron\nThe iron must be suitable:\n• low power\n• small tip';
const CLEAN = 'Many of those who have never used a soldering iron fear damage to the electrical circuits they repair, but the most important thing is to keep the person working protected.\n\n2- Choosing a Good Soldering Iron\nThe iron must be suitable:\n• low power\n• small tip';

async function clipboard(page, text, deny) {
  await page.evaluate(({ text, deny }) => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      readText: () => deny ? Promise.reject(new DOMException('denied', 'NotAllowedError')) : Promise.resolve(text) } });
  }, { text, deny: !!deny });
}

test('the cleaning: PDF line breaks joined, hyphenation undone, spaces collapsed, lists and headings kept; Arabic', async ({ page }) => {
  const errors = await openApp(page, { lang: 'en', contentLang: 'en' });
  expect(await page.evaluate(t => mbCleanPastedText(t), PDF_TEXT)).toBe(CLEAN);
  expect(await page.evaluate(() => mbCleanPastedText('يجب أن تكون   المكواة مناسبة من حيث\nاستهلاك الطاقة الكهربائيـــة. '))).toBe('يجب أن تكون المكواة مناسبة من حيث استهلاك الطاقة الكهربائية.');
  expect(await page.evaluate(() => mbCleanPastedText('1. First step is\nlong\n2. Second'))).toBe('1. First step is long\n2. Second');
  expect(await page.evaluate(() => mbCleanPastedText('soft­hyphen and zero​width\r\nline'))).toBe('softhyphen and zerowidth line');
  expect(errors).toEqual([]);
});

test('information sheet: 📝 fills an empty content box, then inserts at the cursor; kept with the sheet', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), lang: 'en', contentLang: 'en' });
  await tab(page, 'info');
  await page.locator('#info-title').fill('Soldering');
  const card = page.locator('.content-section-item').first();
  const box = card.locator('textarea[data-content-id]');
  const btn = card.locator('.btn-paste-text');
  await expect(btn).toHaveText('📝 Paste text');
  await clipboard(page, PDF_TEXT);
  await btn.click();
  await expect(box).toHaveValue(CLEAN);
  await expect(page.locator('#status')).toContainText('Text pasted and cleaned.');
  // with text in the box: at the cursor, on its own line, nothing lost
  await box.fill('First line.\nLast line.');
  await box.evaluate(el => { el.focus(); el.setSelectionRange(11, 11); });
  await clipboard(page, 'inserted\ntext');
  await btn.click();   // the cursor position kept from before the click
  await expect(box).toHaveValue('First line.\ninserted text\nLast line.');
  await page.evaluate(() => saveCurrentSheetToLO());
  expect(await page.evaluate(() => mbCurrentLOObject().infoSheets[mbState.currentInfoSheetIndex].contentSections[0].text.en))
    .toBe('First line.\ninserted text\nLast line.');
  expect(errors).toEqual([]);
});

test('steps, self-check, assessment content, introduction details and a section each have the button', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), lang: 'en', contentLang: 'en' });
  await clipboard(page, 'Discharge static\nelectricity first.');
  const want = 'Discharge static electricity first.';
  await tab(page, 'activity');
  await page.locator('.step-item .btn-paste-text, [data-act="mbPasteText"][data-args*="step"]').first().click();
  await expect(page.locator('textarea[data-step-id]').first()).toHaveValue(want);
  await tab(page, 'info');
  await page.locator('[data-act="mbPasteText"][data-args*="self-check-content"]').click();
  await expect(page.locator('#self-check-content')).toHaveValue(want);
  await tab(page, 'assessment');
  await page.locator('[data-act="mbPasteText"][data-args*="assessment-simple-content"]').click();
  await expect(page.locator('#assessment-simple-content')).toHaveValue(want);
  await tab(page, 'intro');
  await page.locator('[data-act="mbPasteText"][data-args*="intro-additional-details"]').click();
  await expect(page.locator('#intro-additional-details')).toHaveValue(want);
  await page.locator('[data-act="addIntroBlock"]').click();
  await page.locator('#intro-blocks-container .mb-block').last().locator('.btn-paste-text').click();
  await expect(page.locator('#intro-blocks-container .mb-block').last().locator('textarea.mb-block-body')).toHaveValue(want);
  expect(await page.evaluate(() => mbState.introBlocks[mbState.introBlocks.length - 1].body.en)).toBe(want);   // bound like typing
  expect(errors).toEqual([]);
});

test('clipboard refused: a message, the box focused for Ctrl+V, nothing changed; Arabic', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), lang: 'ar', contentLang: 'ar' });
  await tab(page, 'info');
  const card = page.locator('.content-section-item').first();
  await expect(card.locator('.btn-paste-text')).toHaveText('📝 لصق نص');
  await card.locator('textarea[data-content-id]').fill('نص موجود');
  await clipboard(page, '', true);
  await card.locator('.btn-paste-text').click();
  await expect(page.locator('#status')).toContainText('Ctrl+V');
  await expect(card.locator('textarea[data-content-id]')).toBeFocused();
  await expect(card.locator('textarea[data-content-id]')).toHaveValue('نص موجود');
  expect(errors).toEqual([]);
});
