// 3.80.0: 💾 gives visible feedback — the notice floats in view (it used to
// sit below the page's disclaimer), and saving with no open module says so;
// the side-navigation tabs that had no icon now have one.
const { test, expect } = require('@playwright/test');
const { openApp, fixture } = require('../helpers');

test('the status notice floats in view and can be dismissed', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
  await page.evaluate(() => showStatus('Module saved: test.mbz (1 KB)', 'success'));
  const box = page.locator('#status');
  await expect(box).toBeVisible();
  await expect(box).toBeInViewport();
  await box.click();
  await expect(box).toBeHidden();
  expect(errors).toEqual([]);
});

test('saving with no open module says so', async ({ page }) => {
  const errors = await openApp(page, { lang: 'en' });
  await page.evaluate(() => { mbLib.openId = null; mbState.currentModuleId = null; });
  await page.evaluate(() => mbSaveModulePackage());
  await expect(page.locator('#status')).toHaveText('Please select a module first.');
  await expect(page.locator('#status')).toBeInViewport();
  expect(errors).toEqual([]);
});

test('every side-navigation tab shows an icon', async ({ page }) => {
  const errors = await openApp(page, { lang: 'en' });
  for (const tab of ['intro', 'info', 'activity', 'assessment']) {
    const icon = await page.locator(`#mb-sidenav .tab[data-args='["${tab}"]']`)
      .evaluate(el => getComputedStyle(el, '::before').content);
    expect(icon.replace(/"/g, '').length).toBeGreaterThan(0);
  }
  expect(errors).toEqual([]);
});
