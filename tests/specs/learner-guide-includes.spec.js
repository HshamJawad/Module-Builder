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
  await tab(page, 'unit');
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
  expect(await page.evaluate(() => mbLgModuleOf().lgIntro.items.en)).toBe('1- To use hand tools\n2- To assemble computer components\n\n3- To install printers');
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
  await tab(page, 'unit');
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
  await tab(page, 'unit');
  const card = page.locator('#lg-unit-section .lg-inc-card');
  await expect(card.locator('.lg-part-head > span:first-child')).toHaveText('Each learning unit includes the following:');
  const labels = await card.locator('.lg-inc-lbl').allTextContents();
  expect(labels).toEqual(['Introduction:', 'Knowledge:', 'Learning Activities:', 'Reflection:']);
  const vals = await card.locator('.lg-inc-input').evaluateAll(l => l.map(i => i.value));
  expect(vals).toEqual(['Introducing the subject', 'Things you need to know', 'Things to do', 'To reflect on what you have learned']);

  // nothing is stored until the card is edited; with no introduction the module has no introduction page
  expect(await page.evaluate(() => mbLgModuleOf().lgIncludes)).toBeUndefined();
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
  const at = (s) => { const i = s.startsWith('1- Learning unit') ? t.lastIndexOf(s) : t.indexOf(s); expect(i, s).toBeGreaterThan(-1); return i; };   // the overview names the unit first
  const order = ['These tools help with maintenance.', 'Each learning unit includes the following:',
    'Introduction: Introducing the subject', 'Knowledge: Things you need to know',
    'Learning Activities: Things to do and make', 'Reflection: To reflect on what you have learned',
    'A competency assessment module', '1- Learning unit: Use hand tools', '1-1 Knowledge: Screwdrivers'].map(at);
  expect([...order].sort((a, b) => a - b)).toEqual(order);

  // HTML and PDF read the same model
  const m = await page.evaluate(() => {
    const model = mbBuildModuleModel('en');
    return { inc: model.lgModule.includes, html: mbBuildModuleHtml(model, {}) };
  });
  expect(m.inc.rows.map(r => r.label + ' ' + r.text)).toEqual(['Introduction: Introducing the subject',
    'Knowledge: Things you need to know', 'Learning Activities: Things to do and make', 'Reflection: To reflect on what you have learned']);
  expect(m.html).toContain('Each learning unit includes the following:');
  expect(m.html).toContain('A competency assessment module');

  // every language keeps its own default after the first edit
  await page.evaluate(() => setContentLang('ar'));
  expect(await page.evaluate(() => mbLgModuleOf().lgIncludes.knowledge.ar)).toBe('أشياء تحتاج إلى معرفتها');
  // restore
  await page.evaluate(() => setContentLang('en'));
  await tab(page, 'basic-info');
  await tab(page, 'unit');
  await page.locator('#lg-unit-section .lg-inc-restore').click();
  await expect(card.locator('[data-lg-field="includes.activities"]')).toHaveValue('Things to do');
  expect(errors).toEqual([]);
});

test('an edited «Each learning unit includes…» card makes the module page print even with no introduction text', async ({ page }) => {
  const errors = await openApp(page, { contentLang: 'en' });
  await buildGuide(page);
  await tab(page, 'unit');
  await page.locator('#lg-unit-section .lg-inc-card [data-lg-field="includes.items"]').fill('One more thing');
  const t = await docxText(page);
  expect(t).toContain('Each learning unit includes the following:');
  expect(t).toContain('One more thing');
  // old projects (no lgIncludes, no introduction) are unchanged
  await page.evaluate(() => { delete mbLgModuleOf().lgIncludes; saveCurrentModuleLOData(); });
  expect(await docxText(page)).not.toContain('Each learning unit includes');
  expect(errors).toEqual([]);
});

test('the introduction page: the module title heads the module page before the first unit, the outcomes lead is the card title', async ({ page }) => {
  const errors = await openApp(page, { contentLang: 'en' });
  await buildGuide(page);
  await page.evaluate(() => {
    const m = mbState.modulesData.find(x => x.id === mbState.currentModuleId);
    m.fullTitle = { en: 'Computer hardware maintenance', ar: '', fr: '' };
    mbLgModuleOf().lgIntro = { body: { en: 'Welcome to the guide.', ar: '', fr: '' }, items: { en: 'To use hand tools', ar: '', fr: '' } };
    saveCurrentModuleLOData();
  });
  const t = await docxText(page);
  const at = (s) => { const i = s.startsWith('1- Learning unit') ? t.lastIndexOf(s) : t.indexOf(s); expect(i, s).toBeGreaterThan(-1); return i; };   // the overview names the unit first
  const order = ['Computer hardware maintenance', 'Welcome to the guide.',
    'The learning outcomes for this guide are:', '1. To use hand tools', '1- Learning unit: Use hand tools'].map(at);
  expect([...order].sort((a, b) => a - b)).toEqual(order);
  expect(t).not.toContain('In this learning unit you will learn how to');
  const m = await page.evaluate(() => mbBuildModuleModel('en').lgModule.heading);
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
  await tab(page, 'unit');
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
  await expect(card).toContainText('Material facilities (for 15 learners) for this unit:');
  await page.locator('#references-list .ref-input').first().fill('https://www.wikihow.com/Cut-Wire');
  await card.locator('.fac-qty').first().fill('1');
  await card.locator('.fac-input').first().fill('Classroom');
  await card.locator('.fac-add').click();
  await card.locator('.fac-qty').nth(1).fill('15');
  await card.locator('.fac-input').nth(1).fill('Computer laboratory');
  const t = await docxText(page);
  const at = (x) => { const i = t.indexOf(x); expect(i, x).toBeGreaterThan(-1); return i; };
  const order = ['Suggested resources for this unit:', 'https://www.wikihow.com/Cut-Wire', 'Number', 'Material facilities (for 15 learners) for this unit:', 'Classroom', 'Computer laboratory'].map(at);
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
  // the facilities heading can be renamed; the quantity field has spinner arrows
  await expect(card.locator('.fac-qty').first()).toHaveAttribute('type', 'number');
  await page.evaluate(() => { biSet(mbState, 'facilitiesTitle', 'en', 'Equipment for 15 learners'); renderFacilities(); });
  await expect(card.locator('#facilities-title-display')).toContainText('Equipment for 15 learners');
  await expect(card.locator('[data-act="renameFacilitiesTitle"]')).toHaveCount(1);
  expect(await docxText(page)).toContain('Equipment for 15 learners');
  // the pale blue is offered for tables
  await page.evaluate(() => { const s = wsReadSettings(); s.tableHeaderColor = 'DEEBF6'; wsWriteSettings(s); });
  expect(await page.evaluate(() => wsReadSettings().tableHeaderColor)).toBe('DEEBF6');
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

test('Assessment tab (Learner guide): «Assessment Tables of (code)», Rename, default text, Work Record card with Rename/Delete, undo/redo', async ({ page }) => {
  const errors = await openApp(page, { contentLang: 'en' });
  await buildGuide(page);
  await page.evaluate(() => { const m = mbState.modulesData.find(x => x.id === mbState.currentModuleId); m.moduleCode = 'CMCN 1-1'; });
  await tab(page, 'assessment');
  await expect(page.locator('#asm-tables-title')).toHaveText('Assessment Tables of (CMCN 1-1)');
  await expect(page.locator('#assessment-tab')).not.toContainText('Instructions, criteria, guidelines');
  await expect(page.locator('#assessment-simple-content')).toHaveValue(/^The teacher will keep records of your achievements/);
  // rename
  await page.evaluate(() => { biSet(mbState.lgAsm, 'tablesTitle', 'en', 'My tables'); mbLgPaintTablesCard(); });
  await expect(page.locator('#asm-tables-title')).toHaveText('My tables');
  await expect(page.locator('#asm-content-label-lg [data-act="mbLgAsmRename"]')).toBeVisible();
  await expect(page.locator('#asm-content-label-lg .lg-undo-btn svg')).toHaveCount(1);
  await page.evaluate(() => { delete mbState.lgAsm.tablesTitle; mbLgPaintTablesCard(); });
  // Work Record card
  const card = page.locator('#lg-asm-section');
  await expect(card).toContainText('Work Record (Evidence Portfolio)');
  await expect(card).not.toContainText('Portfolio of evidence');
  await expect(card.locator('[data-act="mbLgAsmRename"]')).toHaveCount(1);
  await expect(card.locator('[data-act="mbLgAsmDelete"] svg')).toHaveCount(1);
  expect(await card.locator('.lg-undo-btn').count()).toBeGreaterThanOrEqual(2);
  // export: heading with the code, the text under it
  let t = await docxText(page);
  expect(t).toContain('Assessment Tables of (CMCN 1-1)');
  expect(t).toContain('The teacher will keep records of your achievements');
  expect(t).toContain('Work Record (Evidence Portfolio)');
  // delete the Work Record card: not exported; undo brings it back
  await card.locator('[data-act="mbLgAsmDelete"]').click();
  await expect(card.locator('[data-act="mbLgAsmUndelete"]')).toHaveCount(1);
  expect(await docxText(page)).not.toContain('Work Record (Evidence Portfolio)');
  await page.evaluate(() => mbUndo());
  await expect(card.locator('[data-act="mbLgAsmDelete"]')).toHaveCount(1);
  expect(await page.evaluate(() => !!mbState.lgAsm.portfolioDeleted)).toBe(false);
  // typing in the tables card is one undo step
  const ta = page.locator('#assessment-simple-content');
  await ta.click(); await ta.fill('Changed text'); await page.locator('#asm-tables-title').click();
  await page.evaluate(() => mbUndo());
  await expect(ta).toHaveValue(/^The teacher will keep records/);
  expect(errors).toEqual([]);
});

test('assessment form: «The learner is» before the result options; «Date» for both signatures', async ({ page }) => {
  const errors = await openApp(page, { contentLang: 'en' });
  await buildGuide(page);
  await page.evaluate(() => {
    const lo = mbCurrentLOObject();
    mbState.assessmentFormsData[lo.id] = { rows: [{ criteria: 'C1', activities: '1-1', outcomes: 'O', date: '' }], teacherName: '', learnerName: '' };
  });
  const t = await docxText(page);
  expect(t).toContain('The learner is:');
  expect(t).not.toContain('Result:');
  expect(t).toContain('☐ Competent');
  expect(t).toContain('☐ Not Yet Competent');
  for (const [lang, w] of [['en', 'Date'], ['fr', 'Date'], ['ar', 'التاريخ']]) {
    expect(await page.evaluate((l) => [i18n.tIn('dgTrainerDate', l), i18n.tIn('dgLearnerDate', l)], lang)).toEqual([w, w]);
  }
  expect(await page.evaluate(() => [i18n.tIn('expResult', 'fr'), i18n.tIn('expResult', 'ar')])).toEqual(['L’apprenant est :', 'المتعلم:']);
  expect(errors).toEqual([]);
});

test('assessment form: «The learner is» sits in the options row, before the boxes', async ({ page }) => {
  const errors = await openApp(page, { contentLang: 'en' });
  await buildGuide(page);
  await page.evaluate(() => { const lo = mbCurrentLOObject(); mbState.assessmentFormsData[lo.id] = { rows: [] }; renderAssessmentForms(); });
  await tab(page, 'assessment');
  const row = page.locator('.mb-asm-opts').first();
  await expect(row.locator('.mb-asm-lead')).toHaveText('The learner is');
  const sizes = await row.evaluate(r => [getComputedStyle(r.querySelector('.mb-asm-lead')).fontSize, getComputedStyle(r.querySelector('.mb-asm-opt')).fontSize]);
  expect(sizes[0]).toBe(sizes[1]);
  expect(await page.evaluate(() => i18n.tIn('expResultPlain', 'en'))).toBe('Result');
  expect(errors).toEqual([]);
});

test('assessment tab: no «Add Assessment Form» button — the chosen learning unit always has its form', async ({ page }) => {
  const errors = await openApp(page, { contentLang: 'en' });
  await buildGuide(page);
  await tab(page, 'assessment');
  await expect(page.locator('[data-act="addNewAssessmentForm"]')).toHaveCount(0);
  await expect(page.locator('#assessment-forms-list thead th').first()).toBeVisible();
  await expect(page.locator('#assessment-forms-list [data-act="deleteAssessmentForm"]')).toHaveCount(0);
  await expect(page.locator('#assessment-forms-list [data-act="clearAssessmentForm"]')).toHaveCount(1);
  // an untouched form is not exported
  expect(await docxText(page)).not.toContain('Learning outcome 1: Use hand tools');
  // typing in it makes it print
  const cell = page.locator('#assessment-forms-list textarea.mb-asm-cell').first();
  await cell.fill('Uses a screwdriver correctly');
  await cell.dispatchEvent('change');
  expect(await docxText(page)).toContain('Uses a screwdriver correctly');
  expect(errors).toEqual([]);
});

test('tabs: a small Back button opposite Proceed, light grey, going to the previous tab', async ({ page }) => {
  const errors = await openApp(page, { contentLang: 'en' });
  await buildGuide(page);
  const chain = [['covers', 'basic-info'], ['intro', 'covers'], ['unit', 'intro'], ['info', 'unit'], ['activity', 'info'],
                 ['reflection', 'activity'], ['assessment', 'reflection'], ['tools', 'assessment'], ['references', 'tools'], ['back-cover', 'references']];
  for (const [t, prev] of chain) {
    await tab(page, t);
    const back = page.locator(`#${t}-tab .mb-nav-back:visible`);
    await expect(back, t).toHaveCount(1);
    expect(await back.getAttribute('data-args'), t).toBe(JSON.stringify([prev]));
  }
  await tab(page, 'basic-info');
  await expect(page.locator('#basic-info-tab .mb-nav-back')).toHaveCount(0);
  // opposite sides, small, grey
  await tab(page, 'intro');
  const g = await page.evaluate(() => {
    const b = document.querySelector('#intro-tab .mb-nav-back'), n = [...document.querySelectorAll('#intro-tab .mb-nav-next')].find(x => x.offsetParent);
    const rb = b.getBoundingClientRect(), rn = n.getBoundingClientRect(), cs = getComputedStyle(b);
    return { backLeft: rb.left < rn.left, h: rb.height, bg: cs.backgroundImage + cs.backgroundColor, color: cs.color, nextSame: getComputedStyle(n).backgroundImage === cs.backgroundImage };
  });
  expect(g.backLeft).toBe(true);
  expect(g.h).toBeLessThan(44);
  expect(g.bg).not.toContain('118, 75, 162');
  expect(g.nextSame).toBe(true);
  await page.locator('#intro-tab .mb-nav-back').click();
  await expect(page.locator('#covers-tab')).toHaveClass(/active/);
  // standard template: the assessment tab goes back to the activity sheet
  await page.evaluate(() => mbSwitchTemplate('standard', { ask: false }));
  await tab(page, 'assessment');
  expect(await page.locator('#assessment-tab .mb-nav-back:visible').getAttribute('data-args')).toBe('["activity"]');
  expect(errors).toEqual([]);
});
