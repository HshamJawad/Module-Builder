// 3.54.0: 📋 Paste QR code in the Video, Link & QR dialog of the
// Information and Activity sheets — beside Upload, and Ctrl+V in the
// dialog; the pasted code is stored on Save like an uploaded one.
const { test, expect } = require('@playwright/test');
const { openApp, fixture, tab } = require('../helpers');

// a 2×2 PNG
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR42mNkYGD4z8DAwMDAxMDAAAAeBQIBpVCrkAAAAABJRU5ErkJggg==';

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
  test(`${scope} sheet: paste a QR code with the button, then Save`, async ({ page }) => {
    const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
    await tab(page, scope);
    await page.evaluate(s => mbOpenLinkModal(s), scope);
    const ov = page.locator('#lm-overlay');
    await expect(ov.locator('#lm-qr-paste')).toHaveText('📋 Paste QR code');
    // the button opens the paste prompt (no clipboard permission in a test)
    await ov.locator('#lm-qr-paste').click();
    await expect(page.locator('.mb-paste-zone')).toBeVisible();
    await pasteImage(page, '.mb-paste-zone');
    await expect(page.locator('.mb-paste-zone')).toHaveCount(0);
    await expect(ov.locator('#lm-qr-preview img')).toHaveCount(1);
    await expect(ov).toBeVisible();                                  // the dialog stays open
    await ov.locator('#lm-save').click();
    const stored = await page.evaluate(s => s === 'info' ? mbState.infoQRImage : mbState.activityQRImage, scope);
    expect(stored).toMatch(/^data:image\/png/);
    expect(errors).toEqual([]);
  });
}

test('Ctrl+V in the dialog sets the QR code; Escape on the prompt keeps the dialog', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
  await tab(page, 'activity');
  await page.evaluate(() => mbOpenLinkModal('activity'));
  const ov = page.locator('#lm-overlay');
  await ov.locator('#lm-qr-paste').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.mb-paste-zone')).toHaveCount(0);
  await expect(ov).toBeVisible();
  await pasteImage(page, '#lm-overlay .ws-body');
  await expect(ov.locator('#lm-qr-preview img')).toHaveCount(1);
  await expect(ov.locator('#lm-save')).toBeEnabled();
  expect(errors).toEqual([]);
});

test('Arabic: the paste button reads in Arabic', async ({ page }) => {
  const errors = await openApp(page, { lang: 'ar' });
  await tab(page, 'activity');
  await page.evaluate(() => mbOpenLinkModal('activity'));
  await expect(page.locator('#lm-qr-paste')).toHaveText('📋 لصق رمز الاستجابة');
  expect(errors).toEqual([]);
});
