// 3.57.0: Assessment Unit — «Add more content» under the Assessment Content
// box (a title, a text, tables), kept with the project and printed after the
// first content in Word; and the form's column headings start on the side
// of the reading direction (right in Arabic).
const { test, expect } = require('@playwright/test');
const { openApp, fixture, tab } = require('../helpers');

async function docxText(page) {
  return page.evaluate(async () => {
    let got = null;
    window.mbExportSink = { take: (b) => { got = b; return Promise.resolve(); }, skip: () => {}, fail: (e) => { throw e; } };
    try { await exportToDocx(); } finally { window.mbExportSink = null; }
    const z = fflate.unzipSync(new Uint8Array(await got.arrayBuffer()));
    const xml = new TextDecoder().decode(z['word/document.xml']);
    return [...xml.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map(m => m[1]).join('|');
  });
}

test('more assessment content: added, typed, kept, exported after the first', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
  await tab(page, 'assessment');
  await page.fill('#assessment-simple-content', 'General instructions');
  await page.click('[data-act="addAssessmentBlock"]');
  const row = page.locator('#assessment-blocks-container .mb-block');
  await expect(row).toHaveCount(1);
  await row.locator('.mb-block-title').fill('Assessment methods');
  await row.locator('.mb-block-body').fill('Observation and oral questions');
  expect(await page.evaluate(() => mbState.assessmentBlocks[0].body.en)).toBe('Observation and oral questions');

  const text = await docxText(page);
  const a = text.indexOf('General instructions'), b = text.indexOf('Assessment methods'), c = text.indexOf('Observation and oral questions');
  expect(a).toBeGreaterThan(-1);
  expect(b).toBeGreaterThan(a);
  expect(c).toBeGreaterThan(b);

  // HTML and PDF too, before the forms (3.57.0).
  const out = await page.evaluate(() => {
    syncProjectTextFromDOM();
    const m = mbBuildModuleModel('en');
    const html = mbBuildModuleHtml(m, {});
    const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
    const lines = [];
    const orig = pdf.text.bind(pdf);
    pdf.text = function (txt) { lines.push(String(txt)); return orig.apply(pdf, arguments); };
    _pdfBuild(pdf, m, 'en');
    return { intro: m.assessmentIntro, html, pdf: lines.join('|') };
  });
  expect(out.intro.content).toBe('General instructions');
  expect(out.intro.blocks.map(b => b.title)).toEqual(['Assessment methods']);
  for (const doc of [out.html, out.pdf]) {
    const x = doc.indexOf('General instructions'), y = doc.indexOf('Assessment methods'), z = doc.indexOf('Observation and oral questions');
    expect(x).toBeGreaterThan(-1);
    expect(y).toBeGreaterThan(x);
    expect(z).toBeGreaterThan(y);
  }

  // Kept with the project (shared record) and painted back.
  const shared = await page.evaluate(() => mbCollectShared());
  expect(shared.assessmentBlocks[0].title.en).toBe('Assessment methods');
  await page.evaluate((d) => { mbState.assessmentBlocks = []; mbRenderBlocks('assessment'); mbApplyProjectShared(d); }, shared);
  await expect(page.locator('#assessment-blocks-container .mb-block-body')).toHaveValue('Observation and oral questions');
  expect(errors).toEqual([]);
});

test('Arabic: the button is translated and the form headings start on the right', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), lang: 'ar', contentLang: 'ar' });
  await tab(page, 'assessment');
  await expect(page.locator('[data-act="addAssessmentBlock"]')).toContainText('إضافة محتوى إضافي');
  await page.evaluate(() => { if (typeof addNewAssessmentForm === 'function' && !document.querySelector('#assessment-forms-list thead th')) addNewAssessmentForm(); });
  const th = page.locator('#assessment-forms-list thead th').first();
  await expect(th).toBeVisible();
  const align = await th.evaluate(e => getComputedStyle(e).textAlign);
  expect(['start', 'right']).toContain(align);
  // The text sits at the right edge of the cell.
  const pos = await th.evaluate(e => { const r = e.getBoundingClientRect(), s = e.querySelector('span').getBoundingClientRect(); return { gapRight: r.right - s.right, gapLeft: s.left - r.left }; });
  expect(pos.gapRight).toBeLessThan(pos.gapLeft);
  expect(errors).toEqual([]);
});
