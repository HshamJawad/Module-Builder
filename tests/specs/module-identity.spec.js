// 3.58.0: the Module Management card shows the module's category — an
// editable list, the same ids as DACUM Live Pro — and its full title. Both
// arrive from DACUM (3.131+), are editable here, kept with the project,
// and the full title is printed as the module's title.
const { test, expect } = require('@playwright/test');
const { openApp, fixture, tab } = require('../helpers');

function handoff(extra) {
  const h = fixture('dacum-handoff.json');
  h.modules[0].category = { id: 'core', label: 'Core' };
  h.modules[0].fullTitle = 'Installing and maintaining residential electrical systems';
  if (extra) extra(h);
  return h;
}

test('category and full title: from DACUM, edited in the card, printed', async ({ page }) => {
  const errors = await openApp(page, { handoff: handoff(h => { if (h.modules[1]) h.modules[1].category = { id: 'cat_5', label: 'Workplace practice' }; }), contentLang: 'en' });
  await tab(page, 'basic-info');
  const full = page.locator('#module-full-title');
  const cat = page.locator('#module-category');
  await expect(full).toHaveValue('Installing and maintaining residential electrical systems');
  await expect(cat).toHaveValue('core');
  await expect(cat.locator('option:checked')).toHaveText('Core');

  // A category DACUM uses that the default list lacks joins the list.
  const ids = await page.evaluate(() => mbModuleCategories().map(c => c.id));
  expect(ids.slice(0, 4)).toEqual(['basic', 'common', 'core', 'elective']);

  // Edited here.
  await cat.selectOption('basic');
  expect(await page.evaluate(() => mbState.modulesData.find(m => m.id === mbState.currentModuleId).category.id)).toBe('basic');
  await full.fill('Residential electrical installation');
  await full.press('Enter');
  expect(await page.evaluate(() => mbState.modulesData.find(m => m.id === mbState.currentModuleId).fullTitle)).toBe('Residential electrical installation');
  await expect(page.locator('#current-module-selector option:checked')).toContainText('Basic');

  // The cover's «Unit title», untouched, follows it.
  expect(await page.evaluate(() => _mbCoverRowByKey('cvUnitTitle').value.en)).toBe('Residential electrical installation');

  // Printed as the module title (model for HTML / PDF; Word's overview).
  expect(await page.evaluate(() => mbBuildModuleModel('en').title)).toBe('Residential electrical installation');

  // The categories editor: rename «Basic»; the module keeps it.
  await cat.selectOption('__edit');
  await expect(page.locator('#mb-cat-modal')).toBeVisible();
  const ta = page.locator('#mb-cat-lines');
  const lines = (await ta.inputValue()).split('\n');
  lines[0] = 'Foundation';
  await ta.fill(lines.join('\n'));
  await page.click('#mb-cat-modal [data-cat="save"]');
  await expect(page.locator('#module-category option:checked')).toHaveText('Foundation');
  expect(await page.evaluate(() => mbCollectShared().moduleCategories[0])).toEqual({ id: 'basic', label: 'Foundation' });
  expect(errors).toEqual([]);
});

test('Arabic labels; an empty full title falls back to the module name', async ({ page }) => {
  const errors = await openApp(page, { handoff: handoff(h => { delete h.modules[0].fullTitle; }), lang: 'ar', contentLang: 'ar' });
  await tab(page, 'basic-info');
  await expect(page.locator('#module-identity')).toContainText('العنوان الكامل للوحدة');
  await expect(page.locator('#module-identity')).toContainText('التصنيف');
  await expect(page.locator('#module-category option:checked')).toHaveText('تخصصية');
  await expect(page.locator('#module-full-title')).toHaveValue('');
  const t = await page.evaluate(() => { const m = mbState.modulesData.find(x => x.id === mbState.currentModuleId); return [mbModuleFullTitle(m), m.title]; });
  expect(t[0]).toBe(t[1]);
  expect(errors).toEqual([]);
});
