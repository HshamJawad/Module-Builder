// 3.64.0: 🗺️ Coverage chooses how items are distributed: by the defaults,
// by hand (the user ticks the cells), or as the AI suggests. 3.65.0: it
// opens from the «Suggested content» card only; «AI» and «Suggest» are
// one button; an AI failure shows the AI service warning.
const { test, expect } = require('@playwright/test');
const { openApp, fixture, tab } = require('../helpers');

const HANDOFF = fixture('dacum-handoff.json');
const ov = (page) => page.locator('#mb-cov-overlay');
const openCov = (page, kind) => page.locator(`#mb-sp-${kind} [data-act="mbCovOpen"]`).click();
const rowsData = (page) => page.evaluate(() => {
  const m = mbState.modulesData.find(x => x.id === mbState.currentModuleId);
  return mbContentMapRows(m).map(r => ({ key: r.key, taskId: r.taskId, text: r.text, dests: r.dests, ok: r.ok }));
});

test('Coverage opens from the Suggested content card only, not the tab title', async ({ page }) => {
  const errors = await openApp(page, { handoff: HANDOFF });
  for (const t of ['info', 'activity', 'assessment']) {
    await tab(page, t);
    await expect(page.locator('.mb-tab-title-bar [data-act="mbCovOpen"]')).toHaveCount(0);
    await expect(page.locator(`#mb-sp-${t} [data-act="mbCovOpen"]`)).toBeVisible();
  }
  await tab(page, 'activity');
  await openCov(page, 'activity');
  await expect(ov(page)).toBeVisible();
  await expect(ov(page).locator('.mb-cov-mode.is-on')).toHaveText('Default');
  await expect(ov(page).locator('.mb-cov-mode')).toHaveCount(3);
  await expect(ov(page).locator('#mb-cov-ai-btn')).toHaveText('🤖 Suggest the distribution with AI');
  expect(errors).toEqual([]);
});

test('manual distribution: nothing is sent until a cell is ticked; kept after reload', async ({ page }) => {
  const errors = await openApp(page, { handoff: HANDOFF });
  await tab(page, 'info');
  await openCov(page, 'info');
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
  await openCov(page, 'info');
  await ov(page).locator('#mb-cov-ai-btn').click();                       // one press: the method and the request
  await expect(page.locator('#mb-cov-ai-btn')).toBeEnabled();
  await expect(page.locator('#mb-cov-ai-btn')).toHaveClass(/is-on/);
  expect(await page.evaluate(() => mbCmMode())).toBe('ai');
  await expect(page.locator('#mb-ai-err')).toHaveCount(0);
  expect(prompts.length).toBeGreaterThan(0);
  expect(prompts[0]).not.toContain('Component layout');                  // approved: not asked
  const pcKey = await page.evaluate(() => MB_LO_PC);
  const rows = await rowsData(page);
  expect(rows.find(r => r.text === 'Board types').dests).toEqual(['activity']);
  expect(rows.find(r => r.text === 'Component layout').dests).toEqual(['info']);
  expect(rows.filter(r => r.taskId !== pcKey && !r.ok.length).every(r => r.dests.join() === 'activity')).toBe(true);
  expect(errors).toEqual([]);
});

test('the AI service is down: the warning modal, nothing changed', async ({ page }) => {
  const errors = await openApp(page, { handoff: HANDOFF });
  await tab(page, 'info');
  const before = await rowsData(page);
  await page.route('**/api/generate-dacum', r => r.abort('connectionrefused'));
  await openCov(page, 'info');
  await ov(page).locator('#mb-cov-ai-btn').click();
  const m = page.locator('#mb-ai-err');
  await expect(m).toBeVisible();
  await expect(m).toHaveAttribute('data-kind', 'offline');
  await expect(m).toContainText('AI service is not reachable');
  await expect(m).toContainText('Nothing in your project was changed.');
  await expect(m).toContainText('Choose «Manual»');
  expect(await rowsData(page)).toEqual(before);
  await m.locator('.mb-ai-err-ok').click();
  await expect(m).toHaveCount(0);
  await expect(ov(page)).toBeVisible();                                    // Coverage stays open
  await expect(page.locator('#mb-cov-ai-btn')).toBeEnabled();
  // out of credit → its own message
  await page.unroute('**/api/generate-dacum');
  await page.route('**/api/generate-dacum', r => r.fulfill({ status: 400, body: '{"error":"Your credit balance is too low"}' }));
  await ov(page).locator('#mb-cov-ai-btn').click();
  await expect(m).toHaveAttribute('data-kind', 'credit');
  await page.keyboard.press('Escape');
  await expect(m).toHaveCount(0);
  await expect(ov(page)).toBeVisible();
  expect(errors).toEqual([]);
});

test('Arabic: the distribution methods and the warning', async ({ page }) => {
  const errors = await openApp(page, { handoff: HANDOFF, lang: 'ar' });
  await tab(page, 'assessment');
  await openCov(page, 'assessment');
  await expect(ov(page).locator('.mb-cov-modes')).toContainText('طريقة التوزيع');
  await expect(ov(page).locator('#mb-cov-ai-btn')).toHaveText('🤖 اقتراح التوزيع بالذكاء الاصطناعي');
  await page.route('**/api/generate-dacum', r => r.fulfill({ status: 503, body: 'overloaded' }));
  await ov(page).locator('#mb-cov-ai-btn').click();
  await expect(page.locator('#mb-ai-err')).toContainText('خدمة الذكاء الاصطناعي مشغولة مؤقتاً');
  await expect(page.locator('#mb-ai-err')).toHaveAttribute('dir', 'rtl');
  expect(errors).toEqual([]);
});
