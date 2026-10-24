// 3.69.0: the module overview table of the Introduction Pages tab
// (src/intro_table.js); the Module tab without the performance criteria
// card; the Learner guide's learning unit card in Introduction Pages and
// its reflection in a Reflection tab of its own (src/learner_guide.js).
const { test, expect } = require('@playwright/test');
const { openApp, tab } = require('../helpers');

const HEADINGS_EN = ['Title', 'Subject', 'Level', 'Prerequisites', 'Duration', 'Purpose',
  'Learning Outcomes', 'Sources', 'Activities and Procedures', 'Assessment'];
const HEADINGS_AR = ['العنوان', 'الموضوع', 'المستوى', 'المتطلبات السابقة', 'المدة', 'الغرض',
  'محصلات التعلم', 'المصادر', 'الأنشطة والإجراءات', 'التقييم'];

/** word/document.xml of the Word export. */
async function docxXml(page) {
  return page.evaluate(async () => {
    const lo = mbState.learningOutcomesData[0];
    if (!lo.infoSheets.length) lo.infoSheets = [{ title: { en: 'Sheet', ar: 'ورقة', fr: '' }, contentSections: [] }];
    saveCurrentModuleLOData(); mbState.currentLOId = null; _applyLOSwitch(lo.id);
    let got = null;
    window.mbExportSink = { take: (b) => { got = b; return Promise.resolve(); }, skip: () => {}, fail: (e) => { throw e; } };
    try { await exportToDocx(); } finally { window.mbExportSink = null; }
    return new TextDecoder().decode(fflate.unzipSync(new Uint8Array(await got.arrayBuffer()))['word/document.xml']);
  });
}

async function buildGuide(page) {
  await page.evaluate(() => { const s = wsReadSettings(); s.templateConvert = true; wsWriteSettings(s); });
  await page.evaluate(() => mbSwitchTemplate('learnerGuide', { ask: false }));
  await page.waitForFunction(() => mbState.moduleTemplate === 'learnerGuide');
  await page.evaluate(() => {
    const P = (t) => ({ en: t, ar: '', fr: '' });
    const los = mbState.learningOutcomesData;
    los[0].title = P('Use hand tools');
    if (los.length < 2) los.push({ id: 'lo-test-2', title: P('Measure parts'), performanceCriteria: [], infoSheets: [], activitySheets: [] });
    saveCurrentModuleLOData(); renderLOSelector();
    mbState.currentLOId = null; _applyLOSwitch(los[0].id);
  });
}

test('the overview table: ten fixed headings, boxes that grow, kept after a reload, Word at 16 cm', async ({ page }) => {
  const errors = await openApp(page, { lang: 'en', contentLang: 'en' });
  await tab(page, 'intro');
  const card = page.locator('#intro-table-section');
  await expect(card).toBeVisible();
  expect(await card.locator('th').allTextContents()).toEqual(HEADINGS_EN);
  // nothing typed: no table in Word
  expect(await docxXml(page)).not.toContain('Activities and Procedures');

  await tab(page, 'intro');
  const box = card.locator('textarea[data-it-key="outcomes"]');
  const h0 = (await box.boundingBox()).height;
  await box.fill('Identify hand tools\nUse hand tools safely\nMaintain hand tools\nStore hand tools');
  const h1 = (await box.boundingBox()).height;
  expect(h1).toBeGreaterThan(h0 * 2);                                            // grows downwards
  expect(await box.evaluate(el => el.scrollHeight <= el.clientHeight + 2)).toBe(true);
  await card.locator('textarea[data-it-key="title"]').fill('Basic hand tools');
  expect(await page.evaluate(() => mbState.introTable.title.en)).toBe('Basic hand tools');

  await page.evaluate(() => mbLibrarySave({ force: true }));
  await page.reload();
  await page.waitForFunction(() => window.mbLib && mbLib.booted === true);
  await page.waitForTimeout(400);
  await tab(page, 'intro');
  await expect(page.locator('#intro-table-section textarea[data-it-key="title"]')).toHaveValue('Basic hand tools');
  expect(await page.locator('#intro-table-section textarea[data-it-key="outcomes"]').inputValue()).toContain('Store hand tools');

  const xml = await docxXml(page);
  for (const h of HEADINGS_EN) expect(xml, h).toContain(h);                     // all ten rows, the empty ones too
  expect(xml).toContain('Basic hand tools');
  expect(xml).toContain('Maintain hand tools');
  const tbl = xml.slice(xml.lastIndexOf('<w:tbl>', xml.indexOf('Activities and Procedures')), xml.indexOf('Activities and Procedures'));
  expect(tbl).toContain('<w:tblW w:type="dxa" w:w="9072"/>');                    // 16 cm
  expect(tbl).toMatch(/<w:gridCol w:w="2551"\/>\s*<w:gridCol w:w="6521"\/>/);

  // HTML follows Word
  const html = await page.evaluate(() => mbBuildModuleHtml(mbBuildModuleModel('en'), {}));
  expect(html).toContain('Activities and Procedures');
  expect(html).toContain('width:16cm');
  expect(errors).toEqual([]);
});

test('the overview table in Arabic: Arabic headings, the Arabic side kept apart, an Arabic Word table', async ({ page }) => {
  const errors = await openApp(page, { lang: 'ar', contentLang: 'ar' });
  await tab(page, 'intro');
  const card = page.locator('#intro-table-section');
  expect(await card.locator('th').allTextContents()).toEqual(HEADINGS_AR);
  await card.locator('textarea[data-it-key="duration"]').fill('٤٠ ساعة');
  expect(await card.locator('textarea[data-it-key="duration"]').getAttribute('dir')).toBe('rtl');
  expect(await page.evaluate(() => [mbState.introTable.duration.ar, mbState.introTable.duration.en])).toEqual(['٤٠ ساعة', '']);
  const xml = await docxXml(page);
  for (const h of HEADINGS_AR) expect(xml, h).toContain(h);
  expect(xml).toContain('٤٠ ساعة');
  expect(errors).toEqual([]);
});

test('the Module tab no longer shows the performance criteria card; the criteria are kept', async ({ page }) => {
  const errors = await openApp(page, { lang: 'en', contentLang: 'en' });
  await page.evaluate(() => {
    const lo = mbState.learningOutcomesData[0];
    lo.performanceCriteria = [{ en: 'Selects the right screwdriver', ar: '', fr: '' }];
    saveCurrentModuleLOData(); mbState.currentLOId = null; _applyLOSwitch(lo.id);
  });
  await tab(page, 'basic-info');
  await expect(page.locator('#performance-criteria-panel')).toHaveCount(0);
  await expect(page.locator('#basic-info-tab')).not.toContainText('Performance Criteria for this Learning Outcome');
  await expect(page.locator('#lo-sheets-summary')).toBeVisible();
  expect(await page.evaluate(() => mbCurrentLOObject().performanceCriteria.length)).toBe(1);
  expect(errors).toEqual([]);
});

test('Learner guide: the unit card in Introduction Pages, the reflection in its own tab with the learning unit bar', async ({ page }) => {
  const errors = await openApp(page, { lang: 'en', contentLang: 'en' });
  await buildGuide(page);
  const reflBtn = page.locator('#mb-sidenav .tab[data-args=\'["reflection"]\']');
  await expect(reflBtn).toBeVisible();
  await expect(reflBtn).toHaveText('🪞 Reflection');

  // nothing of the card is left in the Module tab
  await tab(page, 'basic-info');
  expect(await page.evaluate(() => document.getElementById('lg-unit-section').closest('.tab-content').id)).toBe('unit-tab');

  // Introduction Pages: Work Team first … then the overview table; the learning unit card has its own tab after it
  await tab(page, 'intro');
  await expect(page.locator('#intro-blocks-section')).toBeHidden();
  const order = await page.evaluate(() => ['work-team-container', 'intro-additional-details', 'intro-table-section']
    .map(id => document.getElementById(id).getBoundingClientRect().top));
  expect([...order].sort((a, b) => a - b)).toEqual(order);
  await tab(page, 'unit');
  await expect(page.locator('#lg-unit-section')).toBeVisible();
  await expect(page.locator('#unit-tab .mb-ctx-bar')).toContainText('Learning unit');
  await expect(page.locator('#lg-unit-section [data-lg-field="refl.questions"]')).toHaveCount(0);
  await page.locator('#lg-unit-section [data-lg-field="intro.body"]').fill('Intro of unit 1');

  // Reflection tab: the title names it, the bar chooses the learning unit
  await tab(page, 'reflection');
  await expect(page.locator('#mb-tab-title')).toHaveText('🪞 Reflection');
  await expect(page.locator('#reflection-tab .mb-ctx-bar')).toBeVisible();
  await expect(page.locator('#lg-reflection-section [data-lg-field="intro.body"]')).toHaveCount(0);
  const q = page.locator('#lg-reflection-section [data-lg-field="refl.questions"]');
  await q.fill('What was hard in unit 1?');
  const ids = await page.evaluate(() => mbState.learningOutcomesData.map(l => l.id));
  await page.locator('#reflection-lo-selector').selectOption(ids[1]);
  await expect(q).toHaveValue('');
  await q.fill('What was hard in unit 2?');
  // every bar follows
  expect(await page.evaluate(() => ['current-lo-selector', 'unit-lo-selector', 'info-lo-selector'].map(i => document.getElementById(i).value)))
    .toEqual([ids[1], ids[1], ids[1]]);
  const saved = await page.evaluate(() => mbState.learningOutcomesData.map(l => l.lgReflection && l.lgReflection.questions && l.lgReflection.questions.en));
  expect(saved).toEqual(['What was hard in unit 1?', 'What was hard in unit 2?']);
  expect(await page.evaluate(() => mbState.learningOutcomesData[0].lgIntro.body.en)).toBe('Intro of unit 1');

  // the Activity tab's Proceed leads to Reflection, and Reflection's to Assessment
  await page.locator('#reflection-lo-selector').selectOption(ids[0]);
  await tab(page, 'activity');
  await page.locator('#activity-tab [data-act="proceedToTab"]:visible').click();
  await expect(page.locator('#reflection-tab')).toHaveClass(/active/);
  await page.locator('#reflection-tab [data-act="proceedToTab"]').click();
  await expect(page.locator('#assessment-tab')).toHaveClass(/active/);

  // still printed in Word, in its place at the end of the unit
  const xml = await docxXml(page);
  const t = xml.replace(/<w:p[ >]/g, '\n$&').replace(/<[^>]+>/g, '');
  expect(t).toContain('Intro of unit 1');
  expect(t).toContain('What was hard in unit 1?');
  expect(t.indexOf('Intro of unit 1')).toBeLessThan(t.indexOf('What was hard in unit 1?'));

  // back to the standard template: the tab goes, the page leaves it
  await tab(page, 'reflection');
  await page.evaluate(() => mbSwitchTemplate('standard', { ask: false }));
  await page.waitForFunction(() => mbState.moduleTemplate === 'standard');
  await expect(reflBtn).toBeHidden();
  await expect(page.locator('#basic-info-tab')).toHaveClass(/active/);
  expect(errors).toEqual([]);
});

test('Learner guide in Arabic: the Reflection tab and its bar', async ({ page }) => {
  const errors = await openApp(page, { lang: 'ar', contentLang: 'ar' });
  await buildGuide(page);
  await tab(page, 'reflection');
  await expect(page.locator('#mb-tab-title')).toHaveText('🪞 التأمل');
  await expect(page.locator('#reflection-tab .mb-ctx-bar')).toContainText('الوحدة التعلمية');
  await expect(page.locator('#lg-reflection-section')).toContainText('التأمل');
  await page.setViewportSize({ width: 360, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});

test('Learning unit tab (Learner guide): after Introduction Pages, bar names the module only with several', async ({ page }) => {
  const errors = await openApp(page, { lang: 'en', contentLang: 'en' });
  await buildGuide(page);
  const btn = page.locator('#mb-sidenav .tab[data-args=\'["unit"]\']');
  await expect(btn).toBeVisible();
  await expect(btn).toHaveText('🧭 Learning unit');
  const order = await page.evaluate(() => [...document.querySelectorAll('#mb-sidenav .tabs .tab')].filter(b => b.offsetParent).map(b => (JSON.parse(b.dataset.args || '[]'))[0]));
  expect(order.indexOf('unit')).toBe(order.indexOf('intro') + 1);
  await tab(page, 'intro');
  await expect(page.locator('#intro-tab #lg-unit-wrap')).toHaveCount(0);
  await page.locator('#intro-tab .mb-nav-next:visible').click();
  await expect(page.locator('#unit-tab')).toHaveClass(/active/);
  await expect(page.locator('#lg-unit-section')).toBeVisible();
  const many = await page.evaluate(() => mbState.modulesData.length > 1);
  await expect(page.locator('#unit-tab .mb-ctx-bar')).toHaveClass(many ? /^((?!mb-ctx-solo).)*$/ : /mb-ctx-solo/);
  await expect(page.locator('#unit-module-selector')).toBeVisible({ visible: many });
  await expect(page.locator('#unit-lo-selector')).toBeVisible();
  // standard template: no such tab
  expect(errors).toEqual([]);
});
