// 3.62.2: the folder permission is a small toolbar button, not a bar
// across the page — src/folder_sync.js.
const { test, expect } = require('@playwright/test');
const { openApp } = require('../helpers');

test('a folder waiting for permission shows «📁 Allow» in the toolbar; pressing it asks the browser', async ({ page }) => {
  const errors = await openApp(page, { lang: 'ar' });
  const chip = page.locator('#mb-fld-chip');
  await expect(chip).toBeHidden();                                  // no folder linked
  await page.evaluate(() => {
    let asks = 0;
    const file = { createWritable: () => Promise.resolve({ write: () => Promise.resolve(), close: () => Promise.resolve() }) };
    const dir = { name: 'New folder', kind: 'directory',
      queryPermission: () => Promise.resolve(window.__granted ? 'granted' : 'prompt'),
      requestPermission: () => { asks++; window.__asks = asks; if (asks > 1) window.__granted = true; return Promise.resolve(window.__granted ? 'granted' : 'prompt'); },
      getFileHandle: () => Promise.resolve(file), getDirectoryHandle: function () { return Promise.resolve(dir); },
      removeEntry: () => Promise.resolve(), values: async function* () {} };
    return mbFolderSync.linkHandle(dir);
  });
  await expect(chip).toBeVisible();
  await expect(chip).toContainText('السماح');
  await expect(chip).toHaveAttribute('title', /New folder/);
  await expect(page.locator('.mb-fld-bar')).toHaveCount(0);          // the old bar is gone
  await chip.click();
  await page.waitForFunction(() => window.__asks === 2);
  await expect(chip).toBeHidden();
  expect(errors).toEqual([]);
});
