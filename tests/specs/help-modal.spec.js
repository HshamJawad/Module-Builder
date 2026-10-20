// 3.60.0: the «?» help button of the Information, Activity and Assessment tabs — src/help_modal.js.
const { test, expect } = require('@playwright/test');
const { openApp, tab } = require('../helpers');

for (const lang of ['en', 'fr', 'ar']) {
  test(`help button and modal (${lang})`, async ({ page }) => {
    const errors = await openApp(page, { lang });
    const btn = page.locator('#mb-tab-help');
    await expect(btn).toBeHidden();                       // Basic Info has no guide
    await expect(page.locator('details.mb-guide')).toHaveCount(0);
    for (const t of ['info', 'activity', 'assessment']) {
      await tab(page, t);
      await expect(btn).toBeVisible();
      // in the title bar, at the far end from the title
      const [b, h] = await Promise.all([btn.boundingBox(), page.locator('#mb-tab-title').boundingBox()]);
      if (lang === 'ar') expect(b.x).toBeLessThan(h.x); else expect(b.x).toBeGreaterThan(h.x + h.width);
      await btn.click();
      const m = page.locator('#mb-help-modal');
      await expect(m).toBeVisible();
      await expect(m).toHaveAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
      if (t === 'assessment') await expect(m.locator('.mb-hlp-head')).toHaveCount(4);
      await page.keyboard.press('Escape');
      await expect(m).toHaveCount(0);
    }
    await tab(page, 'covers');
    await expect(btn).toBeHidden();
    expect(errors).toEqual([]);
  });
}

test('the guide follows the template: no self-check line in the Learner guide', async ({ page }) => {
  const errors = await openApp(page, { lang: 'en' });
  await tab(page, 'info');
  await page.locator('#mb-tab-help').click();
  await expect(page.locator('#mb-help-modal')).toContainText('self-check');
  await page.locator('[data-hlp-close]').click();
  await page.evaluate(() => { const s = wsReadSettings(); s.templateConvert = true; wsWriteSettings(s); return mbSwitchTemplate('learnerGuide', { ask: false }); });
  await tab(page, 'info');
  await page.locator('#mb-tab-help').click();
  await expect(page.locator('#mb-help-modal')).not.toContainText('self-check');
  await page.locator('#mb-help-modal').click({ position: { x: 5, y: 5 } });   // the backdrop closes it
  await expect(page.locator('#mb-help-modal')).toHaveCount(0);
  await tab(page, 'assessment');
  await page.locator('#mb-tab-help').click();
  await expect(page.locator('#mb-help-modal')).toContainText('Learner guide:');
  await expect(page.locator('#mb-help-modal')).toContainText('Direct observation');
  expect(errors).toEqual([]);
});
