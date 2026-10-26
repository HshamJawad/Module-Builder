// 3.59.0: the «Learner guide» template — src/learner_guide.js.
const { test, expect } = require('@playwright/test');
const { openApp, tab } = require('../helpers');

/** The Word export's text, one line per paragraph. */
async function docxText(page) {
  const xml = await page.evaluate(async () => {
    let got = null;
    window.mbExportSink = { take: (b) => { got = b; return Promise.resolve(); }, skip: () => {}, fail: (e) => { throw e; } };
    try { await exportToDocx(); } finally { window.mbExportSink = null; }
    return new TextDecoder().decode(fflate.unzipSync(new Uint8Array(await got.arrayBuffer()))['word/document.xml']);
  });
  return xml.replace(/<w:p[ >]/g, '\n$&').replace(/<[^>]+>/g, '');
}

/** A Learner guide project with one outcome written the way the guide is. */
async function buildGuide(page, lang = 'en') {
  await page.evaluate(() => { const s = wsReadSettings(); s.templateConvert = true; wsWriteSettings(s); });
  await page.evaluate(() => mbSwitchTemplate('learnerGuide', { ask: false }));
  await page.waitForFunction(() => mbState.moduleTemplate === 'learnerGuide');
  await page.evaluate((L) => {
    const P = (t) => ({ en: '', ar: '', fr: '', [L]: t });
    const lo = mbState.learningOutcomesData[0];
    lo.title = P('Use hand tools');
    lo.infoSheets = [
      { uid: 'i1', title: P('Screwdrivers'), objective: P(''), selfCheckContent: P('SELF CHECK TEXT'), answersKeyContent: P('ANSWER KEY TEXT'),
        contentSections: [{ text: P('Use the right size.'), heading: P(''), contentId: 'c1', uid: 'u1', marks: [], tables: [] }] },
      { uid: 'i2', title: P('Soldering iron'), objective: P(''), contentSections: [{ text: P('Heat the joint.'), heading: P(''), contentId: 'c2', uid: 'u2', marks: [], tables: [] }] }
    ];
    lo.activitySheets = [
      { title: P('Using hand tools'), sheetType: 'activity', afterInfo: 'i2', duration: '30',
        resources: [{ name: 'RESOURCE ROW', quantity: '1' }], criteria: [P('CRITERION ROW')],
        steps: [{ text: P('Discharge static.'), stepId: 's1', uid: 'st1' }] },
      { title: P('Dismantle a PC'), sheetType: 'job', afterInfo: 'i2', lgContributes: 'yes',
        steps: [{ text: P('Use the screwdrivers.'), stepId: 's2', uid: 'st2' }] }
    ];
    // 3.80.6: the module's introduction page, and the unit's own page of lines
    mbLgModuleOf().lgIntro = { body: P('This guide is about maintenance.'), items: P('Use screwdrivers\nUse a soldering iron') };
    lo.lgUnit = { intro: P('These tools help with maintenance.'), learn: P('1- Choose a screwdriver\n• Tighten a screw') };
    lo.lgReflection = { questions: P('Did you use different screwdrivers?\nWhat was most difficult?'), lines: 2 };
    mbState.includeLearningGuide = true;   // must not print in this template
    mbState.assessmentFormsData[lo.id] = { rows: [{ criteria: 'Use screwdrivers correctly', activities: '1-4 Learning activity', outcomes: 'Direct observation', verification: 'VERIFY COL', date: '' }],
      competent: false, notYetCompetent: false, teacherName: '', teacherSignature: '', teacherDate: '', learnerName: '', learnerSignature: '', learnerDate: '' };
    mbState.glossary = { title: null, tables: [{ rows: 2, cols: 2, cells: [['Term', 'Description'], ['CPU', 'Central Processing Unit']] }] };
    renderGlossary();
    saveCurrentModuleLOData();
    mbState.currentLOId = null;
    _applyLOSwitch(lo.id);
  }, lang);
}

test('Learner guide: one numbered sequence, no self-check/resources/checklist, reflection, glossary, assessment unit', async ({ page }) => {
  const errors = await openApp(page, { contentLang: 'en' });
  await buildGuide(page);
  const t = await docxText(page);
  const at = (s) => { const i = s.startsWith('1- Learning unit') ? t.lastIndexOf(s) : t.indexOf(s); expect(i, s).toBeGreaterThan(-1); return i; };   // the overview names the unit first
  const order = [
    'This guide is about maintenance.', 'The learning outcomes for this guide are:', '1. Use screwdrivers',
    '1- Learning unit: Use hand tools',
    '1-1 Introduction', 'These tools help with maintenance.', 'In this learning unit, you will learn how to:', '1- Choose a screwdriver', '• Tighten a screw',
    '1-2 Knowledge: Screwdrivers',
    '1-3 Knowledge: Soldering iron',
    '1-4 Learning activity: Using hand tools',
    '1-5 Worksheet: Dismantle a PC',
    '1-6 Reflection on learning unit 1', 'Did you use different screwdrivers?',
    'Glossary of Terms', 'Central Processing Unit',
    '2- Assessment unit', '2-1 Introduction', '2-2 Work Record (Evidence Portfolio)', '2-3 Contents of the portfolio',
    '2-4 Assessment Tables', 'Learning outcome 1: Use hand tools', 'Use screwdrivers correctly'
  ];
  let last = -1;
  for (const s of order) { const i = at(s); expect(i, 'order: ' + s).toBeGreaterThan(last); last = i; }
  for (const gone of ['SELF CHECK TEXT', 'ANSWER KEY TEXT', 'RESOURCE ROW', 'CRITERION ROW', 'VERIFY COL']) expect(t, gone).not.toContain(gone);
  // the portfolio: activity and worksheet count, the reflection does not
  const pf = t.slice(t.indexOf('2-3 Contents of the portfolio'), t.indexOf('2-4 Assessment Tables')).replace(/\n/g, '');
  expect(pf).toContain('1-4 Learning activity: Using hand toolsDirect observationYes');
  expect(pf).toContain('1-5 Worksheet: Dismantle a PCWorksheetYes');
  expect(pf).toContain('1-6 Reflection on learning unit 1WorksheetNo');
  expect(errors).toEqual([]);
});

test('Learner guide in Arabic: headings and the tool\'s texts in the export language', async ({ page }) => {
  const errors = await openApp(page, { contentLang: 'ar' });
  await buildGuide(page, 'ar');
  const t = await docxText(page);
  for (const s of ['1- الوحدة التعلمية: Use hand tools'.replace('Use hand tools', ''), '1-1 المقدمة', 'محصلات التعلم لهذا الدليل هي:', 'في هذه الوحدة التعلمية، ستتعلم كيف:',
                   '1-2 المعرفة: Screwdrivers'.replace('Screwdrivers', ''), '1-4 النشاط التعلمي:', '1-5 ورقة العمل:',
                   '1-6 التأمل في الوحدة التعلمية 1', '2- وحدة التقييم', '2-2 سجل الأعمال (محفظة الأدلة)', 'يعتمد تقييم هذه الوحدة']) {
    expect(t, s).toContain(s);
  }
  expect(errors).toEqual([]);
});

test('the standard template is unchanged: self-check, resources and checklist still print', async ({ page }) => {
  const errors = await openApp(page, { contentLang: 'en' });
  await page.evaluate(() => {
    const P = (t) => ({ en: t, ar: '', fr: '' });
    const lo = mbState.learningOutcomesData[0];
    lo.infoSheets = [{ title: P('Screwdrivers'), selfCheckContent: P('SELF CHECK TEXT'), contentSections: [] }];
    lo.activitySheets = [{ title: P('Using tools'), resources: [{ name: 'RESOURCE ROW', quantity: '1' }], criteria: [P('CRITERION ROW')], steps: [] }];
    lo.lgIntro = { body: P('LG INTRO') };
    lo.lgUnit = { intro: P('LG UNIT INTRO') };
    saveCurrentModuleLOData(); mbState.currentLOId = null; _applyLOSwitch(lo.id);
  });
  const t = await docxText(page);
  for (const s of ['SELF CHECK TEXT', 'RESOURCE ROW', 'CRITERION ROW']) expect(t, s).toContain(s);
  expect(t).not.toContain('LG INTRO');
  expect(t).not.toContain('LG UNIT INTRO');
  expect(t).not.toContain('Learning unit');
  expect(errors).toEqual([]);
});

test('the editor: the unit card writes the outcome; the activity row is saved with the sheet', async ({ page }) => {
  const errors = await openApp(page, { contentLang: 'en' });
  await buildGuide(page);
  // 3.69.0: the introduction in Introduction Pages, the reflection in its own tab
  await tab(page, 'unit');
  await expect(page.locator('#lg-unit-section')).toBeVisible();
  await page.locator('#lg-unit-section [data-lg-field="intro.body"]').fill('Typed introduction');
  await tab(page, 'info');
  await page.locator('#lg-unit-card [data-lg-field="unit.intro"]').fill('Typed unit line');
  await tab(page, 'reflection');
  await expect(page.locator('#lg-reflection-section')).toBeVisible();
  await page.locator('#lg-reflection-section [data-lg-field="refl.questions"]').click();
  await page.keyboard.type('Typed question');
  expect(await page.evaluate(() => [mbLgModuleOf().lgIntro.body.en, mbCurrentLOObject().lgUnit.intro.en, mbCurrentLOObject().lgReflection.questions.en.endsWith('Typed question')]))
    .toEqual(['Typed introduction', 'Typed unit line', true]);
  await tab(page, 'activity');
  await expect(page.locator('#lg-act-row')).toBeVisible();
  // 3.80.8: the order follows the tabs (knowledge sheets, then activity sheets): no «Comes after»
  await expect(page.locator('#activity-after-row')).toBeHidden();
  await expect(page.locator('#resources-table')).toBeHidden();
  await page.locator('#lg-act-contributes').selectOption('no');
  await page.locator('#lg-act-product').fill('A photo of the work');
  await page.evaluate(() => saveCurrentSheetToLO());
  expect(await page.evaluate(() => { const a = mbCurrentLOObject().activitySheets[0]; return [a.lgContributes, a.lgProduct.en]; }))
    .toEqual(['no', 'A photo of the work']);
  // the kinds of this template in the type list (3.73.0: + Job Sheet, + custom name)
  expect(await page.locator('#activity-sheet-type option').evaluateAll(o => o.map(x => x.value))).toEqual(['activity', 'job', 'jobsheet', 'custom']);
  await tab(page, 'assessment');
  await expect(page.locator('#lg-portfolio-preview')).toContainText('A photo of the work');
  expect(errors).toEqual([]);
});

test('Learner guide: HTML and PDF follow the same structure as Word', async ({ page }) => {
  const errors = await openApp(page, { contentLang: 'en' });
  await buildGuide(page);
  const r = await page.evaluate(() => {
    const m = mbBuildModuleModel('en');
    const html = mbBuildModuleHtml(m, {});
    const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', compress: false });
    const texts = [];
    const orig = pdf.text.bind(pdf);
    pdf.text = function (s) { texts.push([].concat(s).join(' ')); return orig.apply(pdf, arguments); };
    _pdfBuild(pdf, m, 'en');
    return { template: m.template, seq: m.outcomes[0].sequence.map(x => x.kind), html: html.slice(html.indexOf('<main')), pdf: texts.join('\n') };
  });
  expect(r.template).toBe('learnerGuide');
  expect(r.seq).toEqual(['lgIntro', 'info', 'info', 'activity', 'activity', 'lgReflection']);
  // even when an activity names a sheet it "comes after" (an older project), the order is by tab
  expect(await page.evaluate(() => { const lo = mbState.learningOutcomesData[0]; lo.activitySheets[0].afterInfo = mbInfoSheetKey(lo.infoSheets[0]); return mbLoSequence(lo).map(x => x.kind); }))
    .toEqual(['lgIntro', 'info', 'info', 'activity', 'activity', 'lgReflection']);
  for (const doc of [r.html, r.pdf]) {
    let last = -1;
    for (const s of ['1- Learning unit: Use hand tools', '1-1 Introduction', '1-2 Knowledge: Screwdrivers', '1-4 Learning activity: Using hand tools',
                     '1-5 Worksheet: Dismantle a PC', '1-6 Reflection on learning unit 1', 'Central Processing Unit', '2- Assessment unit', '2-3 Contents of the portfolio']) {
      const i = doc.indexOf(s); expect(i, s).toBeGreaterThan(last); last = i;
    }
    for (const gone of ['SELF CHECK TEXT', 'ANSWER KEY TEXT', 'RESOURCE ROW', 'CRITERION ROW', 'VERIFY COL']) expect(doc, gone).not.toContain(gone);
  }
  expect(errors).toEqual([]);
});
