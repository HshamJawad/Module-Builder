// 3.54.0 / 3.54.1: the QR code in the Video, Link & QR dialog of the
// Information and Activity sheets — 📋 Paste beside Upload, straight
// from the clipboard with no extra window; a large preview in the
// dialog; the link and QR code shown on the sheet under its steps.
const { test, expect } = require('@playwright/test');
const { openApp, fixture, tab } = require('../helpers');

// a 2×2 PNG
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR42mNkYGD4z8DAwMDAxMDAAAAeBQIBpVCrkAAAAABJRU5ErkJggg==';

/** Make navigator.clipboard.read() return an image, nothing, or refuse. */
async function mockClipboard(page, mode) {
  await page.evaluate(({ mode, b64 }) => {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const read = mode === 'image'
      ? () => Promise.resolve([{ types: ['image/png'], getType: () => Promise.resolve(new Blob([bytes], { type: 'image/png' })) }])
      : mode === 'empty'
        ? () => Promise.resolve([{ types: ['text/plain'], getType: () => Promise.resolve(new Blob(['hello'], { type: 'text/plain' })) }])
        : () => Promise.reject(new DOMException('denied', 'NotAllowedError'));
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { read } });
  }, { mode, b64: PNG });
}

/** Fire a real paste event carrying an image at `selector`. */
async function pasteImage(page, selector) {
  await page.evaluate(({ sel, b64 }) => {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], 'qr.png', { type: 'image/png' }));
    const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
    document.querySelector(sel).dispatchEvent(ev);
  }, { sel: selector, b64: PNG });
}

for (const scope of ['info', 'activity']) {
  test(`${scope} sheet: Paste puts the QR code in the dialog directly; Save shows it on the sheet`, async ({ page }) => {
    const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
    await tab(page, scope);
    await expect(page.locator(`#${scope}-link-summary .mb-link-summary-card`)).toHaveCount(0);
    await mockClipboard(page, 'image');
    await page.evaluate(s => mbOpenLinkModal(s), scope);
    const ov = page.locator('#lm-overlay');
    await expect(ov.locator('#lm-qr-preview')).toContainText('No QR code yet');
    await expect(ov.locator('#lm-qr-paste')).toHaveText('📋 Paste QR code');
    await ov.locator('#lm-qr-paste').click();
    await expect(ov.locator('#lm-qr-preview img')).toHaveCount(1);
    await expect(page.locator('.mb-paste-zone')).toHaveCount(0);       // no extra window
    await expect(ov.locator('#lm-msg')).toContainText('QR code pasted');
    // a large, clear preview
    const box = await ov.locator('#lm-qr-preview').boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(150);

    await ov.locator('#lm-url').fill('https://example.com/video');
    await ov.locator('#lm-save').click();
    const stored = await page.evaluate(s => s === 'info' ? mbState.infoQRImage : mbState.activityQRImage, scope);
    expect(stored).toMatch(/^data:image\/png/);
    await ov.locator('#lm-close').click();

    // on the sheet: the QR code and the link, with Edit reopening the dialog
    const card = page.locator(`#${scope}-link-summary .mb-link-summary-card`);
    await expect(card.locator('img.mb-ls-qr')).toHaveCount(1);
    await expect(card.locator('.mb-ls-url')).toHaveText('https://example.com/video');
    await card.locator('.mb-ls-edit').click();
    await expect(page.locator('#lm-overlay #lm-qr-preview img')).toHaveCount(1);
    expect(errors).toEqual([]);
  });
}

test('nothing to paste or no permission: a message in the dialog, no extra window', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
  await tab(page, 'activity');
  await page.evaluate(() => mbOpenLinkModal('activity'));
  const ov = page.locator('#lm-overlay');

  await mockClipboard(page, 'empty');
  await ov.locator('#lm-qr-paste').click();
  await expect(ov.locator('#lm-msg')).toContainText('No image on the clipboard');
  await expect(page.locator('.mb-paste-zone')).toHaveCount(0);

  await mockClipboard(page, 'denied');
  await ov.locator('#lm-qr-paste').click();
  await expect(ov.locator('#lm-msg')).toContainText('did not allow reading the clipboard');
  await expect(page.locator('.mb-paste-zone')).toHaveCount(0);
  await expect(ov.locator('#lm-qr-preview img')).toHaveCount(0);

  // Ctrl+V with an image still works inside the dialog
  await pasteImage(page, '#lm-overlay .ws-body');
  await expect(ov.locator('#lm-qr-preview img')).toHaveCount(1);
  await expect(ov.locator('#lm-save')).toBeEnabled();
  // Remove empties it again
  await ov.locator('#lm-qr-remove').click();
  await expect(ov.locator('#lm-qr-preview img')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('the card follows the open sheet: cleared when a sheet without a link is loaded', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
  await tab(page, 'activity');
  await page.evaluate(b64 => { mbState.activityQRImage = 'data:image/png;base64,' + b64; }, PNG);
  await expect(page.locator('#activity-link-summary img.mb-ls-qr')).toHaveCount(1);
  await page.evaluate(() => { mbState.activityQRImage = null; });
  await expect(page.locator('#activity-link-summary .mb-link-summary-card')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Arabic: the paste button and the empty preview read in Arabic', async ({ page }) => {
  const errors = await openApp(page, { lang: 'ar' });
  await tab(page, 'activity');
  await page.evaluate(() => mbOpenLinkModal('activity'));
  await expect(page.locator('#lm-qr-paste')).toHaveText('📋 لصق رمز الاستجابة');
  await expect(page.locator('#lm-qr-preview')).toContainText('لا يوجد رمز استجابة بعد');
  expect(errors).toEqual([]);
});
