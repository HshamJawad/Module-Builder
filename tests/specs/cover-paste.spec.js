// 3.81.0: Front / Back Cover — 📋 Paste Image in the card header, a 🗑 beside it
// once a picture is there, Ctrl+V on the tab, and Undo / Redo of the picture.
const { test, expect } = require('@playwright/test');
const { openApp, fixture, tab } = require('../helpers');

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

// A Ctrl+V of an image, as the browser delivers it.
async function pasteImage(page, selector) {
  await page.evaluate(({ sel, b64 }) => {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], 'clip.png', { type: 'image/png' }));
    document.querySelector(sel).dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, { sel: selector, b64: PNG });
}

for (const [side, tabName, card] of [['front', 'covers', '#front-cover-card'], ['back', 'back-cover', '#back-cover-card']]) {
  test(`${side} cover: paste, remove from the header, undo and redo`, async ({ page }) => {
    const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
    await tab(page, tabName);
    const key = side + 'CoverImage';
    const preview = page.locator(`#${side}-cover-preview`);
    const removeTop = page.locator(`#${side}-cover-remove-top`);
    await expect(page.locator(`#${side}-cover-paste-btn`)).toBeVisible();
    await expect(removeTop).toBeHidden();

    await pasteImage(page, card);                       // Ctrl+V inside the card
    await expect.poll(() => page.evaluate(k => !!mbState[k], key)).toBe(true);
    await expect(preview).toBeVisible();
    await expect(removeTop).toBeVisible();

    await removeTop.click();                            // 🗑 in the header
    expect(await page.evaluate(k => mbState[k], key)).toBeNull();
    await expect(removeTop).toBeHidden();

    await page.evaluate(() => mbUndo());                // the removal is undone
    await expect.poll(() => page.evaluate(k => !!mbState[k], key)).toBe(true);
    await expect(preview).toBeVisible();

    await page.evaluate(() => mbUndo());                // so is the paste
    await expect.poll(() => page.evaluate(k => mbState[k], key)).toBeNull();
    await expect(preview).toBeHidden();

    await page.evaluate(() => mbRedo());                // and it comes back
    await expect.poll(() => page.evaluate(k => !!mbState[k], key)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('Ctrl+V with nothing focused on the cover tab fills that cover', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
  await tab(page, 'back-cover');
  await pasteImage(page, 'body');
  await expect.poll(() => page.evaluate(() => !!mbState.backCoverImage)).toBe(true);
  expect(await page.evaluate(() => mbState.frontCoverImage)).toBeNull();
  expect(errors).toEqual([]);
});

test('Arabic: the paste button and its tip read in Arabic', async ({ page }) => {
  const errors = await openApp(page, { lang: 'ar' });
  await tab(page, 'covers');
  await expect(page.locator('#front-cover-paste-btn span')).toHaveText('لصق صورة');
  await page.evaluate(() => window.i18n.setLang('en'));
  await expect(page.locator('#front-cover-paste-btn span')).toHaveText('Paste Image');
  expect(errors).toEqual([]);
});
