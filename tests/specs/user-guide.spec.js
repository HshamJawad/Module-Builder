// 3.80.10: module-builder-guide.html — the user guide in three languages.
// Same sections in every language, the right direction, and the version read from version.json.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ver = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'version.json'), 'utf8')).version;

test('user guide: same sections in en / fr / ar, direction, version from version.json', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/module-builder-guide.html');
  const ids = {};
  for (const lang of ['en', 'fr', 'ar']) {
    await page.click(`[data-lang="${lang}"]`);
    await expect(page.locator('html')).toHaveAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    ids[lang] = await page.$$eval('.section', els => els.map(e => e.id));
    expect(ids[lang].length).toBeGreaterThan(15);
    expect(await page.locator('#toc a').count()).toBe(ids[lang].length);
    // the version is the tool's own, never a hard-coded one
    const vers = await page.$$eval('.mb-ver', els => els.map(e => e.textContent));
    expect(vers.length).toBeGreaterThan(1);
    for (const v of vers) expect(v).toBe(ver);
    // no horizontal scroll
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
  expect(ids.fr).toEqual(ids.en);
  expect(ids.ar).toEqual(ids.en);
  expect(errors).toEqual([]);
});
