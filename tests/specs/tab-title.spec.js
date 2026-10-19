// 3.53.0: the heading above the tabs names the open tab, as the side
// navigation does; the tool's name and description are in the Help tab.
const { test, expect } = require('@playwright/test');
const { openApp, tab } = require('../helpers');

test('the heading follows the open tab, the language and the side navigation', async ({ page }) => {
  const errors = await openApp(page);
  const h = page.locator('#mb-tab-title');
  await expect(h).toHaveText('🏠 Basic Info');
  await tab(page, 'references');
  await expect(h).toHaveText('📚 References');
  // a dialog button (Settings) does not change it
  await page.locator('#mb-settings-nav').click();
  await page.keyboard.press('Escape');
  await expect(h).toHaveText('📚 References');
  await page.evaluate(() => window.i18n.setLang('ar'));
  await expect(h).toHaveText(await page.locator('#mb-sidenav .tab.active').innerText());
  await expect(h).toContainText('المراجع');
  // the old subtitle is no longer above the tabs
  await expect(page.locator('.mb-tab-title-bar p')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Help: the tool name and its description are at the top of the tab', async ({ page }) => {
  const errors = await openApp(page);
  await tab(page, 'help');
  await expect(page.locator('#mb-tab-title')).toHaveText('❓ Help');
  const head = page.locator('#help-tab .mb-help-app-title');
  await expect(head.locator('h1')).toHaveText('Module Builder');
  await expect(head.locator('p')).toContainText('competency-based training module');
  expect(errors).toEqual([]);
});
