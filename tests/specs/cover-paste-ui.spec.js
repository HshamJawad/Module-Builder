const { test, expect } = require('@playwright/test');
const { openApp, tab } = require('../helpers');

test('cover tabs: one remove button (top), failed one-click paste opens no window, Ctrl+V pastes', async ({ page }) => {
  const errors = await openApp(page, { contentLang: 'en' });
  for (const [side, tabName] of [['front', 'covers'], ['back', 'back-cover']]) {
    await tab(page, tabName);
    await expect(page.locator(`#${side}-cover-delete-row`)).toHaveCount(0);
    // a single remove button: the icon one in the header
    await expect(page.locator(`#${side === 'front' ? 'covers' : 'back-cover'}-tab button[data-act^="delete"]`)).toHaveCount(1);
    await page.evaluate((s) => { window.isSecureContext; mbCoverPasteImage(s); }, side);
    await expect(page.locator('.mb-dialog-overlay')).toHaveCount(0);
    // pasting an image blob with Ctrl+V anywhere in the tab
    await page.evaluate(async (s) => {
      const c = document.createElement('canvas'); c.width = 40; c.height = 40;
      c.getContext('2d').fillRect(0, 0, 40, 40);
      const blob = await new Promise(r => c.toBlob(r, 'image/png'));
      const dt = new DataTransfer(); dt.items.add(new File([blob], 'a.png', { type: 'image/png' }));
      document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    }, side);
    await expect.poll(() => page.evaluate((s) => !!mbState[s + 'CoverImage'], side)).toBe(true);
    await expect(page.locator(`#${side}-cover-remove-top`)).toBeVisible();
    await page.locator(`#${side}-cover-remove-top`).click();
    expect(await page.evaluate((s) => mbState[s + 'CoverImage'], side)).toBeFalsy();
  }
  expect(errors).toEqual([]);
});
