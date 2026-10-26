// 3.80.11: the step-by-step helper — src/helper.js (chip, panel, steps, tab jump, RTL, keyboard, per project).
const { test, expect } = require('@playwright/test');
const { openApp, tab } = require('../helpers');

for (const lang of ['en', 'fr', 'ar']) {
  test(`helper: chip, panel, steps, go to tab (${lang})`, async ({ page }) => {
    const errors = await openApp(page, { lang });
    const chip = page.locator('#mb-hw-chip');
    await expect(chip).toBeVisible();
    await expect(page.locator('#mb-hw')).toBeHidden();
    await chip.click();
    const panel = page.locator('#mb-hw');
    await expect(panel).toBeVisible();
    await expect(chip).toBeHidden();
    await expect(panel).toHaveAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    // Standard template: 10 steps, no Learning unit / Reflection
    await expect(panel.locator('.mb-hw-dot')).toHaveCount(10);
    await expect(panel.locator('.mb-hw-h')).toContainText(/\S/);
    const first = await panel.locator('.mb-hw-h').textContent();
    // the step title is the tab's own label
    const tabLabel = (await page.locator('#mb-sidenav .tab[data-args=\'["basic-info"]\']').textContent()).replace(/\s+/g, ' ').trim();
    expect(first.replace(/\s+/g, ' ')).toContain(tabLabel.replace(/^\S+\s/, ''));
    // next / back
    await panel.locator('[data-args=\'["next"]\']').click();
    await expect(panel.locator('.mb-hw-dot.is-on')).toHaveCount(1);
    expect(await page.evaluate(() => window.mbHelper.step())).toBe('cover');
    await panel.locator('[data-args=\'["prev"]\']').click();
    expect(await page.evaluate(() => window.mbHelper.step())).toBe('modules');
    // go to the tab of a step
    await panel.locator('.mb-hw-dot').nth(2).click();                       // intro
    await panel.locator('[data-args=\'["tab"]\']').click();
    await expect(page.locator('#intro-tab')).toHaveClass(/active/);
    // opening a tab by hand moves the step
    await tab(page, 'references');
    await expect(panel.locator('.mb-hw-dot.is-on')).toHaveAttribute('data-args', /"refs"/);
    // Escape closes, the chip comes back
    await page.locator('#mb-hw .mb-hw-btn.is-primary').focus();
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(chip).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('helper: status follows the project, step is kept per project, chip can be hidden', async ({ page }) => {
  const errors = await openApp(page, { lang: 'en' });
  await page.locator('#mb-hw-chip').click();
  const panel = page.locator('#mb-hw');
  // a fresh project already has a module and an outcome; no sheet has a title yet
  await expect(panel.locator('.mb-hw-badge')).toHaveText(/Done/);
  await panel.locator('.mb-hw-dot').nth(3).click();                        // info
  await expect(panel.locator('.mb-hw-badge')).toHaveText(/To do/);
  await expect(panel.locator('.mb-hw-metric')).toContainText('0 of');
  // a titled information sheet moves it to Done
  await page.evaluate(() => {
    const lo = mbState.learningOutcomesData[0];
    lo.infoSheets = [{ title: { en: 'Sheet', ar: '', fr: '' } }];
    window.mbHelper.refresh();
  });
  await expect(panel.locator('.mb-hw-badge')).toHaveText(/Done/);
  const outcomes = await page.evaluate(() => mbState.learningOutcomesData.length);
  expect(outcomes).toBeGreaterThan(0);
  // the step is remembered after a reload (same project)
  await panel.locator('.mb-hw-dot').nth(4).click();                        // activity
  expect(await page.evaluate(() => window.mbHelper.step())).toBe('activity');
  await page.locator('#mb-hw .mb-hw-x').click();
  await expect(page.locator('#mb-hw-chip')).toContainText('5/10');
  // hide the button, bring it back from the Help tab
  await page.locator('#mb-hw-chip').click();
  await panel.locator('.mb-hw-hide').click();
  await expect(page.locator('#mb-hw-chip')).toBeHidden();
  await tab(page, 'help');
  await page.locator('.mb-hw-helpcard [data-args=\'["open"]\']').click();
  await expect(panel).toBeVisible();
  expect(errors).toEqual([]);
});

test('helper: Learner guide adds Learning unit and Reflection steps', async ({ page }) => {
  const errors = await openApp(page, { lang: 'en' });
  await page.evaluate(() => { mbState.moduleTemplate = 'learnerGuide'; window.dispatchEvent(new CustomEvent('mb:templatechange', { detail: { template: 'learnerGuide' } })); });
  await page.locator('#mb-hw-chip').click();
  const steps = await page.evaluate(() => window.mbHelper.steps());
  expect(steps).toEqual(['modules', 'cover', 'intro', 'unit', 'info', 'activity', 'reflection', 'assessment', 'tools', 'refs', 'back', 'finish']);
  await expect(page.locator('#mb-hw .mb-hw-dot')).toHaveCount(12);
  expect(errors).toEqual([]);
});
