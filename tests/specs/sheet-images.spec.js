// 3.54.3: pictures pasted or uploaded on an information or activity sheet
// reach the Word file — after leaving the sheet and coming back (an empty
// section above no longer shifts them onto nothing), on a section or step
// with no text yet, at their own proportions, and in a format Word shows.
const { test, expect } = require('@playwright/test');
const { openApp, fixture, tab } = require('../helpers');

async function buildAll(page) {
  for (const k of ['info', 'activity']) {
    await tab(page, k);
    await page.evaluate((k) => { mbState.learningOutcomesData.forEach(lo => { _applyLOSwitch(lo.id); mbSpViewFilter(k, 'lo'); mbSpApproveMany(k, 'shown'); mbSpBuild(k, 'all'); }); _applyLOSwitch(mbState.learningOutcomesData[0].id); }, k);
  }
}

/** A real picture as a data URL, drawn in the page (`type` image/png, image/webp …). */
function picture(page, w, h, type = 'image/png') {
  return page.evaluate(([w, h, type]) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.fillStyle = '#3a7'; x.fillRect(0, 0, w, h);
    return c.toDataURL(type);
  }, [w, h, type]);
}

/** The Word file, as { xml, extents: [[w, h] px], media: [first bytes] }. */
async function docx(page) {
  return page.evaluate(async () => {
    let got = null;
    window.mbExportSink = { take: (b) => { got = b; return Promise.resolve(); }, skip: () => {}, fail: (e) => { throw e; } };
    try { await exportToDocx(); } finally { window.mbExportSink = null; }
    const z = fflate.unzipSync(new Uint8Array(await got.arrayBuffer()));
    const xml = new TextDecoder().decode(z['word/document.xml']);
    const extents = [...xml.matchAll(/<wp:extent cx="(\d+)" cy="(\d+)"/g)].map(m => [Math.round(m[1] / 9525), Math.round(m[2] / 9525)]);
    const media = Object.keys(z).filter(k => /^word\/media\/.+/.test(k)).map(k => Array.from(z[k].slice(0, 4)));
    return { xml, extents, media };
  });
}

test('information sheet: a picture below an empty section survives leaving the sheet, and reaches Word', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
  await tab(page, 'info');
  const img = await picture(page, 400, 200);
  const id = await page.evaluate((src) => {
    document.getElementById('info-title').value = 'Sheet with a picture';
    addContentSection(); addContentSection();               // two more; the first stays empty
    const tas = document.querySelectorAll('textarea[data-content-id]');
    const ta = tas[tas.length - 1];
    ta.value = 'Text beside the picture';
    const id = ta.dataset.contentId;
    mbState.contentSectionImages[id] = [src];
    renderContentImageGallery(id);
    return id;
  }, img);
  expect(id).toBe('3');
  expect((await docx(page)).extents).toEqual([[280, 140]]);

  // to another sheet and back: the empty sections are gone, the card is now #1
  await page.evaluate(() => addNewInfoSheet());
  await page.waitForTimeout(300);
  await page.evaluate(() => prevInfoSheet());
  await page.waitForTimeout(300);
  const card = page.locator('.content-section-item').filter({ has: page.locator('textarea[data-content-id="1"]') });
  await expect(page.locator('textarea[data-content-id="1"]')).toHaveValue('Text beside the picture');
  await expect(card.locator('.content-image-gallery img')).toHaveCount(1);
  expect((await docx(page)).extents).toEqual([[280, 140]]);

  // and once more, from the saved data
  await page.evaluate(() => { saveCurrentSheetToLO(); const lo = mbState.learningOutcomesData.find(l => l.id === mbState.currentLOId); loadInfoSheetAtIndex(lo, mbState.currentInfoSheetIndex); });
  await expect(card.locator('.content-image-gallery img')).toHaveCount(1);
  expect((await docx(page)).extents).toEqual([[280, 140]]);
  expect(errors).toEqual([]);
});

test('a section or a step with pictures and no text yet is kept and printed', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
  await buildAll(page);
  const img = await picture(page, 300, 600);

  await tab(page, 'info');
  await page.evaluate((src) => {
    mbState.currentInfoSheetIndex = 0; loadInfoSheetAtIndex(mbState.learningOutcomesData[0], 0);
    addContentSection();
    const tas = document.querySelectorAll('textarea[data-content-id]');
    const id = tas[tas.length - 1].dataset.contentId;
    mbState.contentSectionImages[id] = [src];
    renderContentImageGallery(id);
    saveCurrentSheetToLO();
  }, img);
  await tab(page, 'activity');
  await page.evaluate((src) => {
    mbState.currentActivitySheetIndex = 0; loadActivitySheetAtIndex(mbState.learningOutcomesData[0], 0);
    addStep();
    const tas = document.querySelectorAll('#steps-container textarea[data-step-id]');
    const id = tas[tas.length - 1].dataset.stepId;
    mbState.stepImages[id] = [src];
    renderStepImageGallery(id);
    saveCurrentSheetToLO();
  }, img);

  // both stored …
  const kept = await page.evaluate(() => {
    const lo = mbState.learningOutcomesData[0];
    const info = lo.infoSheets[0], act = lo.activitySheets[0];
    return {
      section: info.contentSections.some(cs => !(biGetStrict(cs.text, 'en') || '').trim() && (info.contentSectionImages[cs.contentId] || []).length),
      step: act.steps.some(s => !(biGetStrict(s.text, 'en') || '').trim() && (act.images[s.stepId] || []).length),
    };
  });
  expect(kept).toEqual({ section: true, step: true });
  // … and both in Word, tall pictures kept tall (300 × 600 → 200 × 400)
  expect((await docx(page)).extents).toEqual([[200, 400], [200, 400]]);
  expect(errors).toEqual([]);
});

test('a WebP picture is written as PNG; a picture that cannot be read is reported', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
  await buildAll(page);
  const webp = await picture(page, 400, 300, 'image/webp');
  expect(webp.startsWith('data:image/webp')).toBe(true);
  await tab(page, 'activity');
  await page.evaluate((src) => {
    mbState.currentActivitySheetIndex = 0; loadActivitySheetAtIndex(mbState.learningOutcomesData[0], 0);
    const id = document.querySelector('#steps-container textarea[data-step-id]').dataset.stepId;
    mbState.stepImages[id] = [src, 'data:image/png;base64,bm90IGEgcGljdHVyZQ=='];
    renderStepImageGallery(id);
  }, webp);
  const out = await docx(page);
  expect(out.extents).toEqual([[280, 210]]);
  expect(out.media).toEqual([[0x89, 0x50, 0x4e, 0x47]]);           // PNG signature
  await expect(page.locator('#status')).toContainText('1 picture(s) could not be put into the Word file');
  expect(errors).toEqual([]);
});
