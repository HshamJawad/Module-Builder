// 3.56.0: «Attached figures and tables» on the information and activity
// sheets — a picture or a table that belongs to no single step or section,
// printed where the author places it (before / after a chosen step or
// section, at the start or the end), with no step number. And the optional
// numbering of every figure and table (Settings → Misc), including the
// pictures inside steps and sections, which now take a caption.
const { test, expect } = require('@playwright/test');
const { openApp, fixture, tab } = require('../helpers');

function picture(page, w, h) {
  return page.evaluate(([w, h]) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.fillStyle = '#37a'; x.fillRect(0, 0, w, h);
    return c.toDataURL('image/png');
  }, [w, h]);
}

async function docxXml(page) {
  return page.evaluate(async () => {
    let got = null;
    window.mbExportSink = { take: (b) => { got = b; return Promise.resolve(); }, skip: () => {}, fail: (e) => { throw e; } };
    try { await exportToDocx(); } finally { window.mbExportSink = null; }
    const z = fflate.unzipSync(new Uint8Array(await got.arrayBuffer()));
    const xml = new TextDecoder().decode(z['word/document.xml']);
    // The visible text, in order.
    return [...xml.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map(m => m[1]).join('|');
  });
}

function setNumbering(page, on, extra = {}) {
  return page.evaluate(([on, extra]) => {
    wsWriteSettings(Object.assign({}, wsReadSettings(), { figNumbering: on }, extra));
  }, [on, extra]);
}

/** Activity sheet with two steps; returns the uids of the step cards. */
async function twoSteps(page) {
  await tab(page, 'activity');
  return page.evaluate(() => {
    document.getElementById('title').value = 'Change a wheel';
    const tas = () => document.querySelectorAll('textarea[data-step-id]');
    tas()[0].value = 'Loosen the nuts';
    addStep();
    tas()[1].value = 'Lift the car';
    return [...document.querySelectorAll('#steps-container > .step-item')].map(e => e.dataset.uid);
  });
}

test('activity sheet: an attached picture prints after the chosen step, takes no number, and stays with its step', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
  const uids = await twoSteps(page);
  const img = await picture(page, 600, 300);

  // ➕ → Picture or diagram → picture, caption, source, «After Step 1».
  await page.click('[data-act="mbAttAdd"][data-args=\'["activity"]\']');
  const card = page.locator('#activity-attachments .mb-att-item');
  await expect(card).toHaveCount(1);
  await card.locator('[data-act="mbAttSetType"]').first().click();
  // The paste target, as a pasted picture reaches it.
  await page.evaluate((src) => { const id = document.querySelector('#activity-attachments .mb-att-item').getAttribute('data-att-id'); MB_PASTE_TARGETS.attach.put(id, src); }, img);
  await expect(card.locator('.mb-att-img img')).toHaveCount(1);
  await card.locator('.mb-att-caption').fill('Wheel nut pattern');
  await card.locator('.mb-att-source').fill('Workshop manual');
  await card.locator('.mb-att-at').selectOption('after');
  await expect(card.locator('.mb-att-ref')).toBeVisible();
  await card.locator('.mb-att-ref').selectOption(uids[0]);
  await expect(card.locator('.mb-att-ref option')).toHaveCount(2);

  // Numbering off: the caption alone, between the steps, no third step.
  let text = await docxXml(page);
  const iStep1 = text.indexOf('Loosen the nuts'), iCap = text.indexOf('Wheel nut pattern'), iStep2 = text.indexOf('Lift the car');
  expect(iStep1).toBeGreaterThan(-1);
  expect(iCap).toBeGreaterThan(iStep1);
  expect(iStep2).toBeGreaterThan(iCap);
  expect(text).toContain('Source: Workshop manual');
  expect(text).not.toContain('Step 3');
  expect(text).not.toContain('Figure');

  // Numbering on: «Figure 1-1-1: …».
  await setNumbering(page, true);
  text = await docxXml(page);
  expect(text).toMatch(/Figure \d+-\d+-1: Wheel nut pattern/);

  // Move step 2 above step 1: the picture follows ITS step (now step 2).
  await page.evaluate(() => { const items = document.querySelectorAll('#steps-container > .step-item'); moveStepUp(items[1].id.replace('step-', '')); });
  text = await docxXml(page);
  expect(text.indexOf('Lift the car')).toBeLessThan(text.indexOf('Loosen the nuts'));
  expect(text.indexOf('Wheel nut pattern')).toBeGreaterThan(text.indexOf('Loosen the nuts'));

  // Leave the sheet and come back: the card, its caption and place are kept.
  await page.evaluate(() => { addNewActivitySheet(); });
  await page.waitForTimeout(300);
  await expect(page.locator('#activity-attachments .mb-att-item')).toHaveCount(0);
  await page.evaluate(() => prevActivitySheet());
  await page.waitForTimeout(300);
  await expect(card).toHaveCount(1);
  await expect(card.locator('.mb-att-caption')).toHaveValue('Wheel nut pattern');
  await expect(card.locator('.mb-att-at')).toHaveValue('after');
  await expect(card.locator('.mb-att-img img')).toHaveCount(1);

  // The step it was placed by is deleted: printed at the end, and said so.
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('#steps-container > .step-item')].find(e => e.querySelector('textarea').value === 'Loosen the nuts');
    el.remove();
  });
  await card.locator('.mb-att-ref').focus();
  await expect(card.locator('.mb-att-warn')).toBeVisible();
  text = await docxXml(page);
  expect(text.indexOf('Wheel nut pattern')).toBeGreaterThan(text.indexOf('Lift the car'));
  expect(errors).toEqual([]);
});

test('numbering covers the pictures of the steps and the tables, in printed order; per sheet or for the module', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
  await twoSteps(page);
  const img = await picture(page, 300, 200);
  await page.evaluate((src) => {
    // A picture with a caption in step 1, a table titled «Torque» in step 2.
    mbState.stepImages[1] = [src];
    mbImgCapsSet('activity', 1, ['Nut positions']);
    renderStepImageGallery(1);
    addContentTable('step-2', { rows: 2, cols: 2, cells: [['Size', 'Nm'], ['M12', '110']], title: 'Torque' });
  }, img);
  await expect(page.locator('#step-image-gallery-1 .mb-img-cap')).toHaveValue('Nut positions');

  // An attached table at the start of the sheet.
  await page.click('[data-act="mbAttAdd"][data-args=\'["activity"]\']');
  const card = page.locator('#activity-attachments .mb-att-item');
  await card.locator('[data-act="mbAttSetType"]').nth(1).click();
  await expect(card.locator('.content-table-widget')).toHaveCount(1);
  await card.locator('.ct-cap-main').fill('Tools');
  await card.locator('.content-table-widget textarea').first().fill('Wrench');
  await card.locator('.mb-att-at').selectOption('start');

  await setNumbering(page, true);
  let text = await docxXml(page);
  const t1 = text.search(/Table \d+-\d+-1: Tools/), f1 = text.search(/Figure \d+-\d+-1: Nut positions/), t2 = text.search(/Table \d+-\d+-2: Torque/);
  expect(t1).toBeGreaterThan(-1);
  expect(f1).toBeGreaterThan(t1);
  expect(t2).toBeGreaterThan(f1);

  // The same numbers in the model the HTML, PDF and PPTX exports read.
  const sh = await page.evaluate(() => {
    saveCurrentSheetToLO();
    const m = mbBuildModuleModel('en');
    const o = m.outcomes.find(x => x.activitySheets.length);
    const s = o.activitySheets[0];
    return { steps: s.steps.map(x => [x.index, x.imageCaps, x.tables.map(t => t.title)]), att: s.attachments.map(a => [a.slot, a.type, a.table && a.table.title]) };
  });
  expect(sh.steps[0][0]).toBe(1);
  expect(sh.steps[0][1][0]).toMatch(/^Figure \d+-\d+-1: Nut positions$/);
  expect(sh.steps[1][2][0]).toMatch(/^Table \d+-\d+-2: Torque$/);
  expect(sh.att).toEqual([[0, 'table', expect.stringMatching(/^Table \d+-\d+-1: Tools$/)]]);

  // One sequence for the module, and the user's own word.
  await setNumbering(page, true, { figScope: 'module', figWords: { en: { fig: 'Fig.', tab: '', src: '' }, fr: { fig: '', tab: '', src: '' }, ar: { fig: '', tab: '', src: '' } } });
  text = await docxXml(page);
  expect(text).toContain('Fig. 1: Nut positions');
  expect(text).toContain('Table 1: Tools');

  // Off again: captions as typed, no numbers.
  await setNumbering(page, false);
  text = await docxXml(page);
  expect(text).toContain('|Nut positions|');
  expect(text).toContain('|Torque|');
  expect(text).not.toMatch(/Fig\.|Figure \d|Table \d/);
  expect(errors).toEqual([]);
});

test('information sheet: an attached picture before a chosen section; HTML and PDF export it', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
  await tab(page, 'info');
  const img = await picture(page, 500, 250);
  const uid2 = await page.evaluate(() => {
    document.getElementById('info-title').value = 'Wheels';
    addContentSection();
    const tas = document.querySelectorAll('textarea[data-content-id]');
    tas[0].value = 'About rims'; tas[1].value = 'About tyres';
    return document.querySelectorAll('#content-sections-container > .content-section-item')[1].dataset.uid;
  });
  await page.click('[data-act="mbAttAdd"][data-args=\'["info"]\']');
  const card = page.locator('#info-attachments .mb-att-item');
  await card.locator('[data-act="mbAttSetType"]').first().click();
  await page.evaluate((src) => MB_PASTE_TARGETS.attach.put(document.querySelector('#info-attachments .mb-att-item').getAttribute('data-att-id'), src), img);
  await card.locator('.mb-att-caption').fill('Tyre markings');
  await card.locator('.mb-att-at').selectOption('before');
  await card.locator('.mb-att-ref').selectOption(uid2);

  const text = await docxXml(page);
  expect(text.indexOf('About rims')).toBeLessThan(text.indexOf('Tyre markings'));
  expect(text.indexOf('Tyre markings')).toBeLessThan(text.indexOf('About tyres'));

  const out = await page.evaluate(() => {
    saveCurrentSheetToLO();
    const m = mbBuildModuleModel('en');
    const o = m.outcomes.find(x => x.infoSheets.some(s => s.title === 'Wheels'));
    const s = o.infoSheets.find(s => s.title === 'Wheels');
    return { att: s.attachments.map(a => [a.slot, a.caption]) };
  });
  expect(out.att).toEqual([[1, 'Tyre markings']]);

  // HTML: the figure between the two sections; PDF: built, with the picture in it.
  const res = await page.evaluate(() => {
    const m = mbBuildModuleModel('en');
    const html = mbBuildModuleHtml(m, {});
    const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', compress: true });
    const before = pdf.internal.getNumberOfPages();
    _pdfBuild(pdf, m, 'en');
    const out = pdf.output();
    return { html, images: (out.match(/\/Subtype \/Image/g) || []).length, pages: pdf.internal.getNumberOfPages() - before };
  });
  const iR = res.html.indexOf('About rims'), iF = res.html.indexOf('<figure class="mx-fig"'), iT = res.html.indexOf('About tyres');
  expect(iF).toBeGreaterThan(iR);
  expect(iT).toBeGreaterThan(iF);
  expect(res.html).toContain('<figcaption>Tyre markings</figcaption>');
  expect(res.images).toBeGreaterThan(0);

  // PowerPoint: the attached picture gets a slide of its own.
  const slides = await page.evaluate(async () => {
    const P = await _pxLoadLib();
    const m = mbBuildModuleModel('en');
    const count = (deck) => deck._slides.length;
    const a = count(mbBuildPptxDeck(m, pxReadSettings(), P));
    m.outcomes.forEach(o => o.infoSheets.forEach(s => { s.attachments = []; }));
    return a - count(mbBuildPptxDeck(m, pxReadSettings(), P));
  });
  expect(slides).toBe(1);
  expect(errors).toEqual([]);
});

test('Arabic interface: the card, the place list and the settings group', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), lang: 'ar', contentLang: 'ar' });
  await tab(page, 'activity');
  await expect(page.locator('#activity-attachments-card .mb-att-card-head')).toContainText('أشكال وجداول ملحقة');
  await page.click('[data-act="mbAttAdd"][data-args=\'["activity"]\']');
  const card = page.locator('#activity-attachments .mb-att-item');
  await expect(card.locator('.mb-att-choose')).toContainText('صورة أو مخطط');
  await card.locator('[data-act="mbAttSetType"]').first().click();
  await expect(card.locator('.mb-att-at option[value="after"]')).toHaveText('بعد');
  await expect(card.locator('.mb-att-caption')).toHaveAttribute('placeholder', 'عنوان الشكل (اختياري)');

  await page.evaluate(() => openWordSettings('misc'));
  const pane = page.locator('#ws-overlay [data-pane="misc"]');
  await expect(pane).toContainText('ترقيم الأشكال والجداول');
  await pane.locator('[data-ws-misc="figNumbering"]').check();
  await expect(page.locator('#ws-fig-example')).toContainText('الشكل 1-2-1');
  await pane.locator('[data-ws-figword="ar:fig"]').fill('شكل');
  await expect(page.locator('#ws-fig-example')).toContainText('شكل 1-2-1');
  await page.click('#ws-save');
  expect(await page.evaluate(() => wsReadSettings().figNumbering)).toBe(true);
  expect(await page.evaluate(() => mbFigLabel('fig', '2-1', 3, 'ar'))).toBe('شكل 2-1-3');
  expect(errors).toEqual([]);
});
