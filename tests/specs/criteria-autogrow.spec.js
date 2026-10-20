// 3.61.0: a performance criterion box grows with its text — src/criteria.js.
const { test, expect } = require('@playwright/test');
const { openApp, tab } = require('../helpers');

const LONG = 'Tightens every screw of the case to the torque given in the manufacturer’s manual, in the order shown, without damaging the thread or the panel, and checks that no screw is left loose. '.repeat(3);

for (const oldChrome of [false, true]) {
  test(`a long criterion is shown whole${oldChrome ? ' (no field-sizing, as in Chrome 109 on Windows 7)' : ''}`, async ({ page }) => {
    const errors = await openApp(page, { contentLang: 'en' });
    if (oldChrome) await page.addStyleTag({ content: 'textarea { field-sizing: fixed !important; }' });
    await page.evaluate(() => { _applyLOSwitch(mbState.learningOutcomesData[0].id); });
    await tab(page, 'activity');
    const box = page.locator('#criteria-tbody textarea.criteria-text').first();
    await expect(box).toBeVisible();
    const h0 = (await box.boundingBox()).height;
    await box.click();
    await page.keyboard.press('Enter');                 // one criterion per row: no line break
    await box.fill(LONG);
    await box.dispatchEvent('input');
    const h1 = (await box.boundingBox()).height;
    expect(h1).toBeGreaterThan(h0 * 2);
    expect(await box.evaluate(el => el.scrollHeight <= el.clientHeight + 2)).toBe(true);   // nothing hidden
    expect(await box.inputValue()).not.toContain('\n');
    // saved with the sheet, and shown whole again when the sheet comes back
    await page.evaluate(() => saveCurrentSheetToLO());
    expect(await page.evaluate(() => mbCurrentLOObject().activitySheets[0].criteria[0].en)).toBe(LONG);
    await tab(page, 'info');
    await page.evaluate(() => loadCurrentLOSheets());
    await tab(page, 'activity');
    const h2 = (await page.locator('#criteria-tbody textarea.criteria-text').first().boundingBox()).height;
    expect(Math.abs(h2 - h1)).toBeLessThan(4);
    expect(errors).toEqual([]);
  });
}
