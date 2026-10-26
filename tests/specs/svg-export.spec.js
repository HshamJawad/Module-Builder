// 3.81.1: pictures pasted from Word are SVG. They must reach the PDF, and an
// SVG front / back cover must reach the Word file (it used to be written as
// an unreadable "JPEG" and came out as an empty frame).
const { test, expect } = require('@playwright/test');
const { openApp, fixture, tab } = require('../helpers');

const svg = (w, h, fill) => 'data:image/svg+xml;base64,' + Buffer.from(
  `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect width="${w}" height="${h}" fill="${fill}"/><circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) / 4}" fill="#fff"/></svg>`).toString('base64');

async function seed(page) {
  await tab(page, 'info');
  await page.evaluate(([cover, back, pic]) => {
    document.getElementById('info-title').value = 'Sheet with an SVG picture';
    addContentSection();
    const ta = document.querySelector('textarea[data-content-id]');
    ta.value = 'Text beside the picture';
    mbState.contentSectionImages[ta.dataset.contentId] = [pic];
    renderContentImageGallery(ta.dataset.contentId);
    saveCurrentSheetToLO(); saveCurrentModuleLOData();
    mbState.frontCoverImage = cover;
    mbState.backCoverImage = back;
  }, [svg(595, 842, '#0a5'), svg(595, 842, '#a50'), svg(300, 200, '#36c')]);
}

test('Word: SVG front and back covers are written as PNG pages', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
  await seed(page);
  const out = await page.evaluate(async () => {
    let got = null;
    window.mbExportSink = { take: (b) => { got = b; return Promise.resolve(); }, skip: () => {}, fail: (e) => { throw e; } };
    try { await exportToDocx(); } finally { window.mbExportSink = null; }
    const z = fflate.unzipSync(new Uint8Array(await got.arrayBuffer()));
    const png = [137, 80, 78, 71];
    const media = Object.keys(z).filter(k => /^word\/media\/.+/.test(k))
      .map(k => ({ k, png: png.every((b, i) => z[k][i] === b) }));
    const xml = new TextDecoder().decode(z['word/document.xml']);
    return { media, pageExtents: [...xml.matchAll(/<wp:extent cx="(\d+)" cy="(\d+)"/g)].map(m => [Math.round(m[1] / 9525), Math.round(m[2] / 9525)]) };
  });
  // two covers + the sheet picture, all real PNG bytes
  expect(out.media.length).toBeGreaterThanOrEqual(3);
  expect(out.media.every(m => m.png)).toBe(true);
  expect(out.pageExtents.filter(e => e[0] === 794 && e[1] === 1123)).toHaveLength(2);
  expect(errors).toEqual([]);
});

test('PDF: SVG pictures are placed as PNG, SVG covers as JPEG', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
  await seed(page);
  const placed = await page.evaluate(async () => {
    const API = window.jspdf.jsPDF.API;
    const calls = [];
    const origAdd = API.addImage, origSave = API.save;
    API.addImage = function (d, f, x, y, w, h) { calls.push({ fmt: f, svg: /^data:image\/svg/.test(String(d)), full: w > 200 && h > 290 }); return origAdd.apply(this, arguments); };
    API.save = function () { return this; };
    try { await mbExportToPdf(); } finally { API.addImage = origAdd; API.save = origSave; }
    return calls;
  });
  expect(placed.some(c => c.svg)).toBe(false);
  expect(placed.filter(c => c.full).every(c => c.fmt === 'JPEG')).toBe(true);   // covers: light, opaque
  expect(placed.filter(c => !c.full).every(c => c.fmt === 'PNG')).toBe(true);
  expect(placed.filter(c => c.full)).toHaveLength(2);           // front + back cover
  expect(placed.length).toBeGreaterThanOrEqual(3);              // + the sheet picture
  expect(errors).toEqual([]);
});

// 3.80.2: a step / section picture sits in the second column of a two-column
// row, like Word's table — at most 280 px (74 mm) wide; mirrored in Arabic.
for (const lang of ['en', 'ar']) {
  test(`PDF (${lang}): the picture is in its own column beside the text, no wider than Word's`, async ({ page }) => {
    const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: lang, lang });
    await seed(page);
    const placed = await page.evaluate(async () => {
      const API = window.jspdf.jsPDF.API;
      const calls = [];
      const origAdd = API.addImage, origSave = API.save;
      API.addImage = function (d, f, x, y, w, h) { calls.push({ x, y, w, h, full: w > 200 && h > 290 }); return origAdd.apply(this, arguments); };
      API.save = function () { return this; };
      try { await mbExportToPdf(); } finally { API.addImage = origAdd; API.save = origSave; }
      return calls.filter(c => !c.full);
    });
    expect(placed).toHaveLength(1);
    const c = placed[0];
    expect(c.w).toBeLessThanOrEqual(74.3);
    // page 210 mm, margin 18, columns of 87: the picture lies wholly in the right column (en) or the left one (ar)
    if (lang === 'en') expect(c.x).toBeGreaterThanOrEqual(105 - 0.01);
    else expect(c.x + c.w).toBeLessThanOrEqual(105 + 0.01);
    expect(errors).toEqual([]);
  });
}
