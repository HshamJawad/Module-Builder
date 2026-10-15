// 3.48.0: suggested content — the header counts follow what is shown,
// what waits in the module's other outcomes is said with a way to show
// it, and switching outcome repaints the panel and its buttons.
const { test, expect } = require('@playwright/test');
const { openApp, fixture, tab } = require('../helpers');

test('counts follow the view; other outcomes named; switching outcome repaints at once', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
  await tab(page, 'assessment');
  const los = await page.evaluate(() => mbState.learningOutcomesData.map(l => l.id));
  expect(los.length).toBeGreaterThan(1);
  await page.locator('#assessment-lo-selector').selectOption(los[0]);
  await page.evaluate(() => { mbSpView.assessment.open = true; mbSpRefresh(); });
  const host = page.locator('#mb-sp-assessment');
  const perLo = await page.evaluate((ids) => {
    const rows = _spRows(_spModule());
    return ids.map(id => rows.filter(r => r.dests.indexOf('assessment') !== -1 && (!r.lo || r.lo === id)).length);
  }, los);
  // approve and build this outcome
  await host.locator('[data-act="mbSpApproveMany"]').click();
  await host.locator('[data-act="mbSpBuild"]').last().click();
  await expect(host.locator('.mb-sp-count.is-new')).toHaveCount(0);           // nothing waits HERE
  await expect(host.locator('.mb-sp-others')).toContainText('other learning outcomes');
  // switching outcome: the panel shows the other outcome's items, buttons live
  await page.locator('#assessment-lo-selector').selectOption(los[1]);
  await expect(host.locator('.mb-sp-count.is-new')).toContainText(String(perLo[1]));
  await expect(host.locator('[data-act="mbSpApproveMany"]')).toBeEnabled();
  await expect(host.locator('[data-act="mbSpApproveMany"]')).toContainText(`(${perLo[1]})`);
  // «Show the whole module» from the line
  await page.locator('#assessment-lo-selector').selectOption(los[0]);
  await host.locator('.mb-sp-others [data-act="mbSpViewFilter"]').click();
  await expect(host.locator('select.mb-sp-filter')).toHaveValue('all');
  await expect(host.locator('.mb-sp-others')).toHaveCount(0);
  const tip = await page.locator('#mb-sidenav .tab[data-args=\'["assessment"]\']').getAttribute('title');
  expect(tip).toContain('in this module');
  expect(errors).toEqual([]);
});

test('Assessment: after building one outcome, the next outcome\'s items can be approved without anything else', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
  await tab(page, 'assessment');
  const los = await page.evaluate(() => mbState.learningOutcomesData.map(l => l.id));
  const host = page.locator('#mb-sp-assessment');
  for (const id of los) {
    await page.locator('#assessment-lo-selector').selectOption(id);
    await page.evaluate(() => { mbSpView.assessment.open = true; mbSpRefresh(); });
    const btn = host.locator('[data-act="mbSpApproveMany"]');
    if (await btn.isEnabled()) {
      await btn.click();
      await host.locator('[data-act="mbSpBuild"]').last().click();
    }
  }
  const left = await page.evaluate(() => { const rows = _spRows(_spModule()); return _spCounts(rows, 'assessment'); });
  expect(left.new).toBe(0);
  expect(left.ok).toBe(0);
  expect(errors).toEqual([]);
});
