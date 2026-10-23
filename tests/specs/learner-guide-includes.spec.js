// 3.79.0: the learning unit card of the Introduction Pages tab (Learner guide) —
// «The learning outcomes for this guide are:» with its own heading and a numbering
// button, and the card «Each learning unit includes the following:».
const { test, expect } = require('@playwright/test');
const { openApp, tab } = require('../helpers');

async function docxText(page) {
  const xml = await page.evaluate(async () => {
    let got = null;
    window.mbExportSink = { take: (b) => { got = b; return Promise.resolve(); }, skip: () => {}, fail: (e) => { throw e; } };
    try { await exportToDocx(); } finally { window.mbExportSink = null; }
    return new TextDecoder().decode(fflate.unzipSync(new Uint8Array(await got.arrayBuffer()))['word/document.xml']);
  });
  return xml.replace(/<w:p[ >]/g, '\n$&').replace(/<[^>]+>/g, '');
}

/** A Learner guide project with one outcome that has a title and one knowledge sheet. */
async function buildGuide(page) {
  await page.evaluate(() => { const s = wsReadSettings(); s.templateConvert = true; wsWriteSettings(s); });
  await page.evaluate(() => mbSwitchTemplate('learnerGuide', { ask: false }));
  await page.waitForFunction(() => mbState.moduleTemplate === 'learnerGuide');
  await page.evaluate(() => {
    const P = (t) => ({ en: t, ar: '', fr: '' });
    const lo = mbState.learningOutcomesData[0];
    lo.title = P('Use hand tools');
    lo.infoSheets = [{ uid: 'i1', title: P('Screwdrivers'), objective: P(''),
      contentSections: [{ text: P('Use the right size.'), heading: P(''), contentId: 'c1', uid: 'u1', marks: [], tables: [] }] }];
    lo.activitySheets = [];
    saveCurrentModuleLOData();
    mbState.currentLOId = null;
    _applyLOSwitch(lo.id);
  });
}

test('the learning outcomes card: its own heading, the numbering button opposite it', async ({ page }) => {
  const errors = await openApp(page, { contentLang: 'en' });
  await buildGuide(page);
  await tab(page, 'intro');
  const card = page.locator('#lg-unit-section .lg-outcomes-card');
  await expect(card.locator('.lg-part-head > span:first-child')).toHaveText('The learning outcomes for this guide are:');
  await expect(page.locator('#lg-unit-section')).not.toContainText('You will learn how to');
  // the heading belongs to the card below it, not to the introduction card above
  const [intro, head] = await page.evaluate(() => {
    const body = document.querySelector('#lg-unit-section [data-lg-field="intro.body"]').closest('.mb-block');
    const h = document.querySelector('#lg-unit-section .lg-outcomes-card .lg-part-head');
    return [body.contains(h), h.closest('.mb-block') === h.closest('.lg-outcomes-card')];
  });
  expect(intro).toBe(false);
  expect(head).toBe(true);
  // the button sits at the far end of the heading's line
  const geo = await card.locator('.lg-part-head').evaluate(h => {
    const a = h.querySelector('span').getBoundingClientRect(), b = h.querySelector('.lg-num-btn').getBoundingClientRect();
    return { titleLeft: a.left < b.left, sameLine: Math.abs(a.top - b.top) < 30 };
  });
  expect(geo).toEqual({ titleLeft: true, sameLine: true });

  const box = card.locator('[data-lg-field="intro.items"]');
  await box.fill('To use hand tools\nTo assemble computer components\n\nTo install printers');
  await card.locator('.lg-num-btn').click();
  await expect(box).toHaveValue('1- To use hand tools\n2- To assemble computer components\n\n3- To install printers');
  expect(await page.evaluate(() => mbCurrentLOObject().lgIntro.items.en)).toBe('1- To use hand tools\n2- To assemble computer components\n\n3- To install printers');
  // a second press takes the numbers off again
  await card.locator('.lg-num-btn').click();
  await expect(box).toHaveValue('To use hand tools\nTo assemble computer components\n\nTo install printers');
  // numbered lines print once, numbered by the export
  await card.locator('.lg-num-btn').click();
  const t = await docxText(page);
  expect(t).toContain('1. To use hand tools');
  expect(t).not.toContain('1. 1-');
  expect(errors).toEqual([]);
});

test('the unit card: no explanatory line, no fill button, no print switch; icon-only numbering buttons', async ({ page }) => {
  const errors = await openApp(page, { contentLang: 'en' });
  await buildGuide(page);
  await tab(page, 'intro');
  const host = page.locator('#lg-unit-section');
  await expect(host.locator('.mb-blocks-note')).toHaveCount(0);
  await expect(host).not.toContainText('Empty parts are not exported');
  await expect(host.locator('[data-act="mbLgFillItems"]')).toHaveCount(0);
  await expect(host.locator('input[type="checkbox"]')).toHaveCount(0);
  const btns = host.locator('.lg-num-btn');
  await expect(btns).toHaveCount(1);                      // only the learning outcomes card has one
  await expect(host.locator('.lg-inc-card .lg-num-btn')).toHaveCount(0);
  await expect(host.locator('.lg-inc-card .lg-sub')).toHaveCount(0);
  for (let i = 0; i < 1; i++) {
    await expect(btns.nth(i)).toHaveClass(/mb-icon-btn/);
    await expect(btns.nth(i).locator('svg')).toHaveCount(1);
    expect((await btns.nth(i).innerText()).trim()).toBe('');
    await expect(btns.nth(i)).toHaveAttribute('aria-label', 'Numbering');
  }
  expect(errors).toEqual([]);
});

test('«Each learning unit includes the following:» — fixed paragraphs edited in place, own lines, printed with the introduction', async ({ page }) => {
  const errors = await openApp(page, { contentLang: 'en' });
  await buildGuide(page);
  await tab(page, 'intro');
  const card = page.locator('#lg-unit-section .lg-inc-card');
  await expect(card.locator('.lg-part-head > span:first-child')).toHaveText('Each learning unit includes the following:');
  const labels = await card.locator('.lg-inc-lbl').allTextContents();
  expect(labels).toEqual(['Introduction:', 'Knowledge:', 'Learning Activities:', 'Reflection:']);
  const vals = await card.locator('.lg-inc-input').evaluateAll(l => l.map(i => i.value));
  expect(vals).toEqual(['Introducing the subject', 'Things you need to know', 'Things to do', 'To reflect on what you have learned']);

  // nothing is stored until the card is edited; with no introduction the unit has no introduction page
  expect(await page.evaluate(() => mbCurrentLOObject().lgIncludes)).toBeUndefined();
  let t = await docxText(page);
  expect(t).not.toContain('Each learning unit includes');

  // an introduction brings the card with it, on the same page, with the tool's texts
  await page.locator('#lg-unit-section [data-lg-field="intro.body"]').fill('These tools help with maintenance.');
  t = await docxText(page);
  expect(t).toContain('Each learning unit includes the following:');
  expect(t).toContain('Learning Activities: Things to do');

  await card.locator('[data-lg-field="includes.activities"]').fill('Things to do and make');
  await card.locator('[data-lg-field="includes.items"]').fill('A competency assessment module');
  t = await docxText(page);
  const at = (s) => { const i = t.indexOf(s); expect(i, s).toBeGreaterThan(-1); return i; };
  const order = ['1-1 Introduction', 'These tools help with maintenance.', 'Each learning unit includes the following:',
    'Introduction: Introducing the subject', 'Knowledge: Things you need to know',
    'Learning Activities: Things to do and make', 'Reflection: To reflect on what you have learned',
    'A competency assessment module', '1-2 Knowledge: Screwdrivers'].map(at);
  expect([...order].sort((a, b) => a - b)).toEqual(order);

  // HTML and PDF read the same model
  const m = await page.evaluate(() => {
    const model = mbBuildModuleModel('en');
    const it = model.outcomes[0].sequence.find(x => x.kind === 'lgIntro');
    return { inc: it.intro.includes, html: mbBuildModuleHtml(model, {}) };
  });
  expect(m.inc.rows.map(r => r.label + ' ' + r.text)).toEqual(['Introduction: Introducing the subject',
    'Knowledge: Things you need to know', 'Learning Activities: Things to do and make', 'Reflection: To reflect on what you have learned']);
  expect(m.html).toContain('Each learning unit includes the following:');
  expect(m.html).toContain('A competency assessment module');

  // every language keeps its own default after the first edit
  await page.evaluate(() => setContentLang('ar'));
  expect(await page.evaluate(() => mbCurrentLOObject().lgIncludes.knowledge.ar)).toBe('أشياء تحتاج إلى معرفتها');
  // restore
  await page.evaluate(() => setContentLang('en'));
  await tab(page, 'basic-info');
  await tab(page, 'intro');
  await page.locator('#lg-unit-section .lg-inc-restore').click();
  await expect(card.locator('[data-lg-field="includes.activities"]')).toHaveValue('Things to do');
  expect(errors).toEqual([]);
});

test('an edited «Each learning unit includes…» card makes the unit print even with no introduction text', async ({ page }) => {
  const errors = await openApp(page, { contentLang: 'en' });
  await buildGuide(page);
  await tab(page, 'intro');
  await page.locator('#lg-unit-section .lg-inc-card [data-lg-field="includes.items"]').fill('One more thing');
  const t = await docxText(page);
  expect(t).toContain('Each learning unit includes the following:');
  expect(t).toContain('One more thing');
  // old projects (no lgIncludes, no introduction) are unchanged
  await page.evaluate(() => { const lo = mbCurrentLOObject(); delete lo.lgIncludes; saveCurrentModuleLOData(); });
  expect(await docxText(page)).not.toContain('Each learning unit includes');
  expect(errors).toEqual([]);
});

test('the introduction page: the module title heads it (not the learning unit), the outcomes lead is the card title', async ({ page }) => {
  const errors = await openApp(page, { contentLang: 'en' });
  await buildGuide(page);
  await page.evaluate(() => {
    const m = mbState.modulesData.find(x => x.id === mbState.currentModuleId);
    m.fullTitle = { en: 'Computer hardware maintenance', ar: '', fr: '' };
    const lo = mbCurrentLOObject();
    lo.lgIntro = { body: { en: 'Welcome to the guide.', ar: '', fr: '' }, items: { en: 'To use hand tools', ar: '', fr: '' } };
    saveCurrentModuleLOData();
  });
  const t = await docxText(page);
  const at = (s) => { const i = t.indexOf(s); expect(i, s).toBeGreaterThan(-1); return i; };
  const order = ['Computer hardware maintenance', '1-1 Introduction', 'Welcome to the guide.',
    'The learning outcomes for this guide are:', '1. To use hand tools'].map(at);
  expect([...order].sort((a, b) => a - b)).toEqual(order);
  expect(t).not.toContain('In this learning unit you will learn how to');
  const m = await page.evaluate(() => { const model = mbBuildModuleModel('en'); return model.outcomes[0].pageHeading; });
  expect(m).toBe('Computer hardware maintenance');
  expect(errors).toEqual([]);
});

test('knowledge sheet list box: editable title, numbering, clear, undo/redo, 3 languages, export', async ({ page }) => {
  const errors = await openApp(page, { contentLang: 'en' });
  await buildGuide(page);
  await tab(page, 'info');
  const card = page.locator('#lg-know-card');
  await expect(card).toBeVisible();
  // placed after the title and before the objectives
  const order = await page.evaluate(() => {
    const y = (s) => document.querySelector(s).getBoundingClientRect().top;
    return [y('#info-title'), y('#lg-know-card'), y('#lg-obj-toggle')];
  });
  expect(order[0] < order[1] && order[1] < order[2]).toBe(true);
  await card.locator('#lg-know-title').fill('Safety rules');
  await card.locator('#lg-know-items').fill('Wear gloves\nKeep tools clean');
  await card.locator('.lg-num-btn').click();
  await expect(card.locator('#lg-know-items')).toHaveValue('1- Wear gloves\n2- Keep tools clean');
  await card.locator('#lg-know-items').dispatchEvent('input');
  await page.evaluate(() => saveCurrentSheetToLO());
  const st = await page.evaluate(() => { const s = mbCurrentLOObject().infoSheets[0]; return [s.lgListTitle.en, s.lgListItems.en]; });
  expect(st).toEqual(['Safety rules', '1- Wear gloves\n2- Keep tools clean']);
  // export
  const t = await docxText(page);
  expect(t.indexOf('Safety rules')).toBeGreaterThan(t.indexOf('Screwdrivers'));
  expect(t).toContain('1- Wear gloves');
  const html = await page.evaluate(() => mbBuildModuleHtml(mbBuildModuleModel('en'), {}));
  expect(html).toContain('Safety rules');
  // other languages keep their own side
  await page.evaluate(() => setContentLang('ar'));
  await expect(card.locator('#lg-know-title')).toHaveValue('');
  await card.locator('#lg-know-title').fill('قواعد السلامة');
  await card.locator('#lg-know-title').dispatchEvent('input');
  await page.evaluate(() => saveCurrentSheetToLO());
  expect(await page.evaluate(() => mbCurrentLOObject().infoSheets[0].lgListTitle.ar)).toBe('قواعد السلامة');
  expect(await card.locator('#lg-know-title').getAttribute('dir')).toBe('rtl');
  await page.evaluate(() => setContentLang('en'));
  await expect(card.locator('#lg-know-title')).toHaveValue('Safety rules');
  // clear
  await card.locator('.lg-clear-icon').click();
  await expect(card.locator('#lg-know-items')).toHaveValue('');
  // buttons exist on both cards
  await expect(card.locator('.lg-undo-btn svg')).toHaveCount(1);
  await expect(card.locator('.lg-redo-btn svg')).toHaveCount(1);
  await tab(page, 'intro');
  const u = page.locator('#lg-unit-section .lg-outcomes-card');
  for (const c of ['.lg-undo-btn', '.lg-redo-btn', '.lg-clear-icon', '.lg-num-btn']) await expect(u.locator(c)).toHaveCount(1);
  await u.locator('[data-lg-field="intro.items"]').fill('abc');
  await u.locator('.lg-clear-icon').click();
  await expect(u.locator('[data-lg-field="intro.items"]')).toHaveValue('');
  expect(errors).toEqual([]);
});

test('References tab (Learner guide): «Suggested resources…» heading, facilities, one table in Word, names in Settings', async ({ page }) => {
  const errors = await openApp(page, { contentLang: 'en' });
  await buildGuide(page);
  await tab(page, 'references');
  await expect(page.locator('#references-title-display')).toContainText('Suggested resources for this unit:');
  await expect(page.locator('#references-list .ref-input').first()).toHaveAttribute('placeholder', /web address/);
  const card = page.locator('#facilities-card');
  await expect(card).toContainText('Material facilities (for 15 learners) for this module:');
  await page.locator('#references-list .ref-input').first().fill('https://www.wikihow.com/Cut-Wire');
  await card.locator('.fac-qty').first().fill('1');
  await card.locator('.fac-input').first().fill('Classroom');
  await card.locator('.fac-add').click();
  await card.locator('.fac-qty').nth(1).fill('15');
  await card.locator('.fac-input').nth(1).fill('Computer laboratory');
  const t = await docxText(page);
  const at = (x) => { const i = t.indexOf(x); expect(i, x).toBeGreaterThan(-1); return i; };
  const order = ['Suggested resources for this unit:', 'https://www.wikihow.com/Cut-Wire', 'Number', 'Material facilities (for 15 learners) for this module:', 'Classroom', 'Computer laboratory'].map(at);
  expect([...order].sort((a, b) => a - b)).toEqual(order);
  // a link, not plain text
  const rels = await page.evaluate(async () => {
    let got = null;
    window.mbExportSink = { take: (b) => { got = b; return Promise.resolve(); }, skip: () => {}, fail: (e) => { throw e; } };
    try { await exportToDocx(); } finally { window.mbExportSink = null; }
    const z = fflate.unzipSync(new Uint8Array(await got.arrayBuffer()));
    return new TextDecoder().decode(z['word/_rels/document.xml.rels']);
  });
  expect(rels).toContain('https://www.wikihow.com/Cut-Wire');
  // the names are in Settings, with the old name beside the first
  await page.evaluate(() => { const s = wsReadSettings(); s.lgLabels = { en: { references: 'My resources' }, fr: {}, ar: {} }; wsWriteSettings(s); });
  await page.evaluate(() => renderReferences());
  await expect(page.locator('#references-title-display')).toContainText('My resources');
  // saved with the module
  expect(await page.evaluate(() => mbState.facilitiesData.map(f => f.qty + ':' + f.value))).toEqual(['1:Classroom', '15:Computer laboratory']);
  await page.locator('#facilities-card [data-act="deleteFacility"]').first().click();
  await expect(card.locator('.fac-input')).toHaveCount(1);
  expect(errors).toEqual([]);
});
