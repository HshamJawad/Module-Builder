// 3.64.0: 🗺️ Coverage is a button at the top of the Information, Activity
// and Assessment tabs, and it chooses how items are distributed: by the
// defaults, by hand (the user ticks the cells), or as the AI suggests.
const { test, expect } = require('@playwright/test');
const { openApp, fixture, tab } = require('../helpers');

const HANDOFF = fixture('dacum-handoff.json');
const ov = (page) => page.locator('#mb-cov-overlay');
const rowsData = (page) => page.evaluate(() => {
  const m = mbState.modulesData.find(x => x.id === mbState.currentModuleId);
  return mbContentMapRows(m).map(r => ({ key: r.key, taskId: r.taskId, text: r.text, dests: r.dests, ok: r.ok }));
});

test('the Coverage button shows on the Information, Activity and Assessment tabs only', async ({ page }) => {
  const errors = await openApp(page, { handoff: HANDOFF });
  await expect(page.locator('#mb-tab-cov')).toBeHidden();
  for (const t of ['info', 'activity', 'assessment']) {
    await tab(page, t);
    await expect(page.locator('#mb-tab-cov')).toBeVisible();
  }
  await tab(page, 'references');
  await expect(page.locator('#mb-tab-cov')).toBeHidden();
  await tab(page, 'activity');
  await page.click('#mb-tab-cov');
  await expect(ov(page)).toBeVisible();
  await expect(ov(page).locator('.mb-cov-mode.is-on')).toHaveText('Default');
  expect(errors).toEqual([]);
});

test('manual distribution: nothing is sent until a cell is ticked; kept after reload', async ({ page }) => {
  const errors = await openApp(page, { handoff: HANDOFF });
  await tab(page, 'info');
  await page.click('#mb-tab-cov');
  await ov(page).locator('.mb-cov-mode', { hasText: 'Manual' }).click();
  await expect(ov(page).locator('.mb-cov-mode.is-on')).toHaveText('Manual');
  const pcKey = await page.evaluate(() => MB_LO_PC);
  let rows = (await rowsData(page)).filter(r => r.taskId !== pcKey);
  expect(rows.length).toBeGreaterThan(0);
  expect(rows.every(r => r.dests.length === 0)).toBe(true);
  // tick «Board types» → Information
  const cell = ov(page).locator('.mb-cov-row', { hasText: 'Board types' }).locator('.mb-cov-cell.is-pick').first();
  await cell.click();
  rows = await rowsData(page);
  expect(rows.find(r => r.text === 'Board types').dests).toEqual(['info']);
  await page.keyboard.press('Escape');
  await expect(page.locator('#mb-sp-info .mb-sp-row', { hasText: 'Board types' })).toBeVisible();
  await expect(page.locator('#mb-sp-info .mb-sp-row', { hasText: 'Component layout' })).toHaveCount(0);
  // saved with the project
  await page.waitForTimeout(600);
  await page.reload();
  await page.waitForFunction(() => window.mbLib && window.mbLib.booted === true);
  expect(await page.evaluate(() => mbCmMode())).toBe('manual');
  rows = await rowsData(page);
  expect(rows.find(r => r.text === 'Board types').dests).toEqual(['info']);
  expect(errors).toEqual([]);
});

test('AI distribution: the suggestion is applied; approved items keep their sheets', async ({ page }) => {
  const errors = await openApp(page, { handoff: HANDOFF });
  await tab(page, 'info');
  await page.locator('#mb-sp-info .mb-sp-row', { hasText: 'Component layout' }).locator('[data-act="mbSpApprove"]').click();
  let prompts = [];
  await page.route('**/api/generate-dacum', async route => {
    const prompt = JSON.parse(route.request().postData()).prompt;
    prompts.push(prompt);
    const d = {};
    for (let i = 1; i <= 80; i++) d[String(i)] = ['activity'];
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ d }) }] }) });
  });
  await page.click('#mb-tab-cov');
  await ov(page).locator('.mb-cov-mode', { hasText: 'AI' }).click();
  await ov(page).locator('#mb-cov-ai-btn').click();
  await expect(page.locator('#mb-cov-ai-btn')).toBeEnabled();
  expect(prompts.length).toBeGreaterThan(0);
  expect(prompts[0]).not.toContain('Component layout');                  // approved: not asked
  const pcKey = await page.evaluate(() => MB_LO_PC);
  const rows = await rowsData(page);
  expect(rows.find(r => r.text === 'Board types').dests).toEqual(['activity']);
  expect(rows.find(r => r.text === 'Component layout').dests).toEqual(['info']);
  expect(rows.filter(r => r.taskId !== pcKey && !r.ok.length).every(r => r.dests.join() === 'activity')).toBe(true);
  expect(errors).toEqual([]);
});

test('Arabic: the button and the distribution methods', async ({ page }) => {
  const errors = await openApp(page, { handoff: HANDOFF, lang: 'ar' });
  await tab(page, 'assessment');
  await expect(page.locator('#mb-tab-cov')).toContainText('التغطية');
  await page.click('#mb-tab-cov');
  await expect(ov(page).locator('.mb-cov-modes')).toContainText('طريقة التوزيع');
  await expect(ov(page).locator('.mb-cov-mode')).toHaveCount(3);
  expect(errors).toEqual([]);
});
