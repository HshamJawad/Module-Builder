// 3.70.0: several links, each with its own QR code, from the same
// Video, Link & QR dialog (src/link_modal.js) — on Information
// (Knowledge) and Activity sheets; shown on the sheet, kept with the
// sheet, printed one row each in Word, HTML and PDF; each sheet with its
// OWN QR code in the export.
const { test, expect } = require('@playwright/test');
const { openApp, fixture, tab } = require('../helpers');

/** Paste a PNG of one colour into the open dialog (a real paste event). */
async function pasteColour(page, colour) {
  await page.evaluate(async (colour) => {
    const c = document.createElement('canvas'); c.width = c.height = 8;
    const g = c.getContext('2d'); g.fillStyle = colour; g.fillRect(0, 0, 8, 8);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    const dt = new DataTransfer();
    dt.items.add(new File([blob], 'qr.png', { type: 'image/png' }));
    document.querySelector('#lm-overlay').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, colour);
  await expect(page.locator('#lm-qr-preview img')).toHaveCount(1);
}

async function wordXml(page) {
  return page.evaluate(async () => {
    let got = null;
    window.mbExportSink = { take: (b) => { got = b; return Promise.resolve(); }, skip: () => {}, fail: (e) => { throw e; } };
    try { await exportToDocx(); } finally { window.mbExportSink = null; }
    const files = fflate.unzipSync(new Uint8Array(await got.arrayBuffer()));
    return { xml: new TextDecoder().decode(files['word/document.xml']), media: Object.keys(files).filter(k => k.startsWith('word/media/')).length };
  });
}

for (const scope of ['info', 'activity']) {
  test(`${scope} sheet: three links with their own QR codes from one dialog — shown, kept, printed`, async ({ page }) => {
    const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en', lang: 'en' });
    await tab(page, scope);
    await page.evaluate(s => mbOpenLinkModal(s), scope);
    const ov = page.locator('#lm-overlay');
    await expect(ov.locator('.lm-link-tab[data-lm-link]')).toHaveCount(1);
    await expect(ov.locator('#lm-link-remove')).toHaveCount(0);           // nothing to remove with one link

    const links = [['Soldering properly', 'https://youtu.be/p36LxtJJCjc', '#ff0000'],
                   ['Soldering electronic components', 'https://youtu.be/ccV2HyTJFqQ', '#00aa00'],
                   ['Safety sheet', 'https://example.com/safety', '#0000ff']];
    for (let i = 0; i < links.length; i++) {
      if (i) await ov.locator('#lm-link-add').click();
      await expect(ov.locator('.lm-link-tab.is-on')).toContainText('Link ' + (i + 1));
      await expect(ov.locator('#lm-subject')).toHaveValue('');
      await expect(ov.locator('#lm-qr-preview img')).toHaveCount(0);       // a new link starts empty
      await ov.locator('#lm-subject').fill(links[i][0]);
      await ov.locator('#lm-url').fill(links[i][1]);
      await pasteColour(page, links[i][2]);
    }
    // back to link 1: its own fields and code
    await ov.locator('[data-lm-link="0"]').click();
    await expect(ov.locator('#lm-subject')).toHaveValue('Soldering properly');
    // an empty fourth link is not kept
    await ov.locator('#lm-link-add').click();
    await ov.locator('#lm-save').click();
    await expect(ov.locator('.lm-link-tab[data-lm-link]')).toHaveCount(3);
    await ov.locator('#lm-close').click();
    await expect(ov).toHaveCount(0);

    // on the sheet: three cards, each with its code
    const cards = page.locator(`#${scope}-link-summary .mb-link-summary-card`);
    await expect(cards).toHaveCount(3);
    await expect(cards.nth(1)).toContainText('ccV2HyTJFqQ');
    await expect(cards.locator('img.mb-ls-qr')).toHaveCount(3);

    // ✏️ on the third card opens the dialog at the third link; remove it
    await cards.nth(2).locator('.mb-ls-edit').click();
    await expect(ov.locator('#lm-subject')).toHaveValue('Safety sheet');
    await ov.locator('#lm-link-remove').click();
    await expect(ov.locator('.lm-link-tab[data-lm-link]')).toHaveCount(2);
    await ov.locator('#lm-save').click();
    await ov.locator('#lm-close').click();
    await expect(cards).toHaveCount(2);

    // kept with the sheet, after a reload
    await page.evaluate(() => { saveCurrentSheetToLO(); return mbLibrarySave({ force: true }); });
    await page.reload();
    await page.waitForFunction(() => window.mbLib && mbLib.booted === true);
    await page.waitForTimeout(400);
    await tab(page, scope);
    await expect(page.locator(`#${scope}-link-summary .mb-link-summary-card`)).toHaveCount(2);
    const kept = await page.evaluate(s => {
      const lo = mbCurrentLOObject();
      const sh = s === 'info' ? lo.infoSheets[mbState.currentInfoSheetIndex] : lo.activitySheets[mbState.currentActivitySheetIndex];
      return [sh.linkUrl, (sh.extraLinks || []).map(x => x.url)];
    }, scope);
    expect(kept).toEqual(['https://youtu.be/p36LxtJJCjc', ['https://youtu.be/ccV2HyTJFqQ']]);

    // Word: one row per link, each with its picture
    await page.locator(scope === 'info' ? '#info-title' : '#title').fill('Soldering');
    await page.evaluate(() => saveCurrentSheetToLO());
    const { xml, media } = await wordXml(page);
    expect(xml).toContain('https://youtu.be/p36LxtJJCjc');
    expect(xml).toContain('https://youtu.be/ccV2HyTJFqQ');
    expect(xml.indexOf('p36LxtJJCjc')).toBeLessThan(xml.indexOf('ccV2HyTJFqQ'));
    expect(media).toBeGreaterThanOrEqual(2);
    // HTML follows
    const html = await page.evaluate(() => mbBuildModuleHtml(mbBuildModuleModel('en'), {}));
    expect(html).toContain('ccV2HyTJFqQ');
    expect(html).toContain('p36LxtJJCjc');
    expect(errors).toEqual([]);
  });
}

test('each sheet prints its own links and QR code; a new sheet starts with none', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en', lang: 'en' });
  await tab(page, 'info');
  await page.locator('#info-title').fill('Sheet one');
  await page.evaluate(() => mbOpenLinkModal('info'));
  await page.locator('#lm-url').fill('https://example.com/sheet-one');
  await pasteColour(page, '#ff0000');
  await page.locator('#lm-link-add').click();
  await page.locator('#lm-url').fill('https://example.com/sheet-one-b');
  await page.locator('#lm-save').click();
  await page.locator('#lm-close').click();
  await page.evaluate(() => addNewInfoSheet());
  await page.waitForTimeout(300);
  await expect(page.locator('#info-link-summary .mb-link-summary-card')).toHaveCount(0);
  expect(await page.evaluate(() => [mbState.infoQRImage, mbState.infoExtraLinks.length])).toEqual([null, 0]);
  await page.locator('#info-title').fill('Sheet two');
  await page.evaluate(() => mbOpenLinkModal('info'));
  await page.locator('#lm-url').fill('https://example.com/sheet-two');
  await pasteColour(page, '#0000ff');
  await page.locator('#lm-save').click();
  await page.locator('#lm-close').click();
  await page.evaluate(() => saveCurrentSheetToLO());
  const m = await page.evaluate(() => {
    const model = mbBuildModuleModel('en');
    const sheets = model.outcomes.flatMap(o => (o.infoSheets || []).filter(x => x.links));
    return sheets.filter(s => s.links.length).map(s => s.links.map(l => [l.url, (l.image || '').slice(0, 40)]));
  });
  const one = m.find(s => s[0][0] === 'https://example.com/sheet-one');
  const two = m.find(s => s[0][0] === 'https://example.com/sheet-two');
  expect(one.length).toBe(2);
  expect(two.length).toBe(1);
  expect(one[0][1]).toMatch(/^data:image\/png/);
  expect(two[0][1]).toMatch(/^data:image\/png/);
  expect(await page.evaluate(() => {
    const lo = mbCurrentLOObject();
    return lo.infoSheets[0].qrImage !== lo.infoSheets[lo.infoSheets.length - 1].qrImage;
  })).toBe(true);
  expect(errors).toEqual([]);
});

test('the dialog in Arabic: link tabs, add and remove', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'ar', lang: 'ar' });
  await tab(page, 'info');
  await page.evaluate(() => mbOpenLinkModal('info'));
  const ov = page.locator('#lm-overlay');
  await expect(ov).toHaveAttribute('dir', 'rtl');
  await expect(ov.locator('[data-lm-link="0"]')).toContainText('الرابط 1');
  await expect(ov.locator('#lm-link-add')).toHaveText('➕ إضافة رابط آخر');
  await ov.locator('#lm-link-add').click();
  await expect(ov.locator('#lm-link-remove')).toHaveText('🗑 حذف هذا الرابط');
  await page.setViewportSize({ width: 360, height: 800 });
  expect(await page.evaluate(() => document.querySelector('#lm-overlay .ws-modal').scrollWidth <= document.querySelector('#lm-overlay .ws-modal').clientWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});
