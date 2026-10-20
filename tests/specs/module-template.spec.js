// 3.59.0: the module template of a project — src/module_template.js.
const { test, expect } = require('@playwright/test');
const { openApp, tab } = require('../helpers');

test('a new start shows the template window; choosing Learner guide opens a project of that template', async ({ page }) => {
  const errors = await openApp(page, { chooser: true });
  const dlg = page.locator('.mb-tpl-dialog');
  await expect(dlg).toBeVisible();
  await expect(dlg.locator('.mb-tpl-card')).toHaveCount(3);
  await expect(dlg.locator('.mb-tpl-card[data-tpl-pick="lowLiteracy"]')).toBeDisabled();
  await dlg.locator('.mb-tpl-card[data-tpl-pick="learnerGuide"]').click();
  await expect(dlg).toHaveCount(0);
  await page.waitForFunction(() => mbState.moduleTemplate === 'learnerGuide');
  expect(await page.evaluate(() => document.body.classList.contains('mb-tpl-learnerGuide'))).toBe(true);
  expect(await page.evaluate(() => mbLib.project.template)).toBe('learnerGuide');
  // the standard-only fields are hidden
  await tab(page, 'info');
  await expect(page.locator('#self-check-content')).toBeHidden();
  await tab(page, 'activity');
  await expect(page.locator('#resources-table')).toBeHidden();
  await expect(page.locator('#criteria-section')).toBeHidden();
  expect(errors).toEqual([]);
});

test('switching opens another project; switching back finds the first one as it was', async ({ page }) => {
  const errors = await openApp(page);
  await expect(page.locator('.mb-tpl-dialog')).toHaveCount(0);
  const firstId = await page.evaluate(() => mbLib.project.id);
  await page.evaluate(() => { mbLib.project.name = 'Standard one'; return mbLibrarySave({ force: true }); });
  await page.locator('#mb-tpl-rail [data-tpl="learnerGuide"]').click();
  await page.locator('.mb-dialog-ok').click();
  await page.waitForFunction(() => mbState.moduleTemplate === 'learnerGuide');
  const secondId = await page.evaluate(() => mbLib.project.id);
  expect(secondId).not.toBe(firstId);
  await page.locator('#mb-tpl-rail [data-tpl="standard"]').click();
  await page.locator('.mb-dialog-ok').click();
  await page.waitForFunction(() => mbState.moduleTemplate === 'standard');
  expect(await page.evaluate(() => mbLib.project.id)).toBe(firstId);
  expect(await page.evaluate(() => mbLib.project.name)).toBe('Standard one');
  // the template survives a reload
  await page.locator('#mb-tpl-rail [data-tpl="learnerGuide"]').click();
  await page.locator('.mb-dialog-ok').click();
  await page.waitForFunction(() => mbState.moduleTemplate === 'learnerGuide');
  await page.reload();
  await page.waitForFunction(() => window.mbLib && mbLib.booted === true);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => [mbLib.project.id, mbState.moduleTemplate])).toEqual([secondId, 'learnerGuide']);
  expect(errors).toEqual([]);
});

test('with conversion allowed, switching converts the open project and keeps its data', async ({ page }) => {
  const errors = await openApp(page);
  await page.evaluate(() => { const s = wsReadSettings(); s.templateConvert = true; wsWriteSettings(s); });
  const id = await page.evaluate(() => mbLib.project.id);
  await page.locator('#mb-tpl-rail [data-tpl="learnerGuide"]').click();
  await page.locator('.mb-dialog-ok').click();
  await page.waitForFunction(() => mbState.moduleTemplate === 'learnerGuide');
  expect(await page.evaluate(() => mbLib.project.id)).toBe(id);
  // Low literacy is announced, not switchable
  await page.locator('#mb-tpl-rail [data-tpl="lowLiteracy"]').click();
  await page.locator('.mb-dialog-ok').click();
  expect(await page.evaluate(() => mbState.moduleTemplate)).toBe('learnerGuide');
  expect(errors).toEqual([]);
});

test('Settings → Misc shows the template buttons and the two options', async ({ page }) => {
  const errors = await openApp(page, { chooser: true });
  await page.keyboard.press('Escape');   // the startup window: continue as is
  await expect(page.locator('.mb-tpl-dialog')).toHaveCount(0);
  await page.evaluate(() => openWordSettings());
  await page.locator('[data-ws-pane="misc"]').first().click();
  await expect(page.locator('#ws-tpl-buttons .mb-tpl-btn')).toHaveCount(3);
  await expect(page.locator('[data-ws-misc="templateChooser"]')).toBeChecked();
  await expect(page.locator('[data-ws-misc="templateConvert"]')).not.toBeChecked();
  expect(errors).toEqual([]);
});

test('the template window is shown once per tab, not again after a reload', async ({ page }) => {
  const errors = await openApp(page, { chooser: true });
  await expect(page.locator('.mb-tpl-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.reload();
  await page.waitForFunction(() => window.mbLib && mbLib.booted === true);
  await page.waitForTimeout(1200);
  await expect(page.locator('.mb-tpl-dialog')).toHaveCount(0);
  expect(errors).toEqual([]);
});
