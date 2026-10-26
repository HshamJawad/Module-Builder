// 3.80.6: the learning unit's card in the Knowledge tab (after «Suggested content») and the
// module-level introduction of the Learning unit tab — Learner guide template only.
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

async function buildGuide(page, lang = 'en') {
  await page.evaluate(() => { const s = wsReadSettings(); s.templateConvert = true; wsWriteSettings(s); });
  await page.evaluate(() => mbSwitchTemplate('learnerGuide', { ask: false }));
  await page.waitForFunction(() => mbState.moduleTemplate === 'learnerGuide');
  await page.evaluate((L) => {
    const P = (t) => ({ en: '', ar: '', fr: '', [L]: t });
    const los = mbState.learningOutcomesData;
    los[0].title = P('Use hand tools');
    los[0].infoSheets = [{ uid: 'i1', title: P('Screwdrivers'), objective: P(''),
      contentSections: [{ text: P('Use the right size.'), heading: P(''), contentId: 'c1', uid: 'u1', marks: [], tables: [] }] }];
    los[0].activitySheets = [];
    saveCurrentModuleLOData();
    mbState.currentLOId = null;
    _applyLOSwitch(los[0].id);
  }, lang);
}

test('the card sits after «Suggested content», follows the outcome, and is only in this template', async ({ page }) => {
  const errors = await openApp(page, { contentLang: 'en' });
  await page.evaluate(() => { const s = wsReadSettings(); s.templateConvert = true; wsWriteSettings(s); });
  await buildGuide(page);
  await tab(page, 'info');
  const card = page.locator('#lg-unit-card');
  await expect(card).toBeVisible();
  const ys = await page.evaluate(() => ['#mb-sp-info', '#lg-unit-card', '#info-title'].map(s => document.querySelector(s).getBoundingClientRect().top));
  expect(ys[0] <= ys[1] && ys[1] < ys[2]).toBe(true);
  // «1- Learning unit:» + the outcome's title, «1-1 Introduction:» + an empty title
  await expect(card.locator('.lg-ucard-lbl').nth(0)).toHaveText('1- Learning unit:');
  await expect(card.locator('[data-lg-field="unit.title"]')).toHaveValue('Use hand tools');
  await expect(card.locator('.lg-ucard-lbl').nth(1)).toHaveText('1-1 Introduction:');
  await expect(card.locator('[data-lg-field="unit.learnTitle"]')).toHaveValue('In this learning unit, you will learn how to:');
  // the tools: intro box has undo/redo/clear + paste; the learn box adds numbering and bullets
  await expect(card.locator('[data-lg-field="unit.intro"]')).toBeVisible();
  const introTools = await card.locator('.lg-ucard-row').nth(1).locator('.mb-icon-btn').evaluateAll(b => b.map(x => x.getAttribute('data-act')));
  expect(introTools).toEqual(['mbUndo', 'mbRedo', 'mbLgClearField']);
  const learnTools = await card.locator('.lg-ucard-learn .mb-icon-btn').evaluateAll(b => b.map(x => x.getAttribute('data-act')));
  expect(learnTools).toEqual(['mbUndo', 'mbRedo', 'mbLgClearField', 'mbLgNumberLines', 'mbLgBulletLines']);
  await expect(card.locator('[data-act="mbPasteText"]')).toHaveCount(2);

  await card.locator('[data-lg-field="unit.title"]').fill('Hand tools unit');
  await card.locator('[data-lg-field="unit.introTitle"]').fill('About this unit');
  await card.locator('[data-lg-field="unit.intro"]').fill('Tools matter.');
  await card.locator('[data-lg-field="unit.learn"]').fill('Choose a screwdriver\nTighten a screw');
  await card.locator('.lg-bul-btn').click();
  await expect(card.locator('[data-lg-field="unit.learn"]')).toHaveValue('• Choose a screwdriver\n• Tighten a screw');
  await card.locator('.lg-bul-btn').click();
  await card.locator('.lg-ucard-learn .lg-num-btn').click();
  await expect(card.locator('[data-lg-field="unit.learn"]')).toHaveValue('1- Choose a screwdriver\n2- Tighten a screw');
  // undo brings the bullets/numbers back
  await card.locator('.lg-ucard-learn .lg-hist-btn.lg-undo-btn').click();
  await expect(card.locator('[data-lg-field="unit.learn"]')).toHaveValue('Choose a screwdriver\nTighten a screw');
  await card.locator('.lg-ucard-learn .lg-hist-btn.lg-redo-btn').click();
  await expect(card.locator('[data-lg-field="unit.learn"]')).toHaveValue('1- Choose a screwdriver\n2- Tighten a screw');

  // the export: the unit's page is before the knowledge sheets, as typed
  const t = await docxText(page);
  const at = (s) => { const i = t.lastIndexOf(s); expect(i, s).toBeGreaterThan(-1); return i; };
  const order = ['1- Learning unit: Hand tools unit', '1-1 Introduction: About this unit', 'Tools matter.',
    'In this learning unit, you will learn how to:', '1- Choose a screwdriver', '2- Tighten a screw', '1-2 Knowledge: Screwdrivers'].map(at);
  expect([...order].sort((a, b) => a - b)).toEqual(order);

  // each language keeps its own default heading
  await page.evaluate(() => setContentLang('ar'));
  await expect(card.locator('[data-lg-field="unit.learnTitle"]')).toHaveValue('في هذه الوحدة التعلمية، ستتعلم كيف:');
  await expect(card.locator('[data-lg-field="unit.intro"]')).toHaveValue('');
  await page.evaluate(() => setContentLang('fr'));
  await expect(card.locator('[data-lg-field="unit.learnTitle"]')).toHaveValue('Dans cette unité d’apprentissage, vous apprendrez à :');
  await page.evaluate(() => setContentLang('en'));

  // not in the standard template
  await page.evaluate(() => mbSwitchTemplate('standard', { ask: false }));
  await page.waitForFunction(() => mbState.moduleTemplate === 'standard');
  await expect(card).toBeHidden();
  expect(await docxText(page)).not.toContain('Tools matter.');
  expect(errors).toEqual([]);
});

test('Learning unit tab: only the module in the bar; the card is the module\'s and old per-outcome data moves to it', async ({ page }) => {
  const errors = await openApp(page, { contentLang: 'en' });
  await buildGuide(page);
  // an older project: introductions written per outcome
  await page.evaluate(() => {
    const P = (t) => ({ en: t, ar: '', fr: '' });
    const los = mbState.learningOutcomesData;
    los[0].lgIntro = { body: P('Module welcome'), items: P('Goal one\nGoal two') };
    los[0].lgIncludes = { items: P('Extra line') };
    if (los[1]) los[1].lgIntro = { body: P('Second unit intro') };
    saveCurrentModuleLOData();
    const m = mbState.modulesData.find(x => x.id === mbState.currentModuleId);
    delete m.lgModMigrated;
  });
  await tab(page, 'unit');
  await expect(page.locator('#unit-tab .mb-ctx-bar select')).toHaveCount(1);
  await expect(page.locator('#unit-module-selector')).toBeVisible();
  await expect(page.locator('#unit-lo-selector')).toHaveCount(0);
  await expect(page.locator('#lg-unit-section [data-lg-field="intro.body"]')).toHaveValue('Module welcome');
  await expect(page.locator('#lg-unit-section [data-lg-field="intro.items"]')).toHaveValue('Goal one\nGoal two');
  const moved = await page.evaluate(() => {
    const los = mbState.learningOutcomesData;
    return { second: los[1] && los[1].lgUnit && los[1].lgUnit.intro && los[1].lgUnit.intro.en, kept: los[0].lgIntro.body.en };
  });
  expect(moved.kept).toBe('Module welcome');   // nothing is deleted
  if (moved.second !== undefined) expect(moved.second).toBe('Second unit intro');
  // the module's page is exported once, headed by the module's title, before the unit
  await page.evaluate(() => {
    const m = mbState.modulesData.find(x => x.id === mbState.currentModuleId);
    m.fullTitle = { en: 'Computer maintenance', ar: '', fr: '' };
  });
  const t = await docxText(page);
  const order = ['Computer maintenance', 'Module welcome', 'The learning outcomes for this guide are:', '1. Goal one', 'Extra line'].map(s => {
    const i = t.indexOf(s); expect(i, s).toBeGreaterThan(-1); return i;
  });
  expect([...order].sort((a, b) => a - b)).toEqual(order);
  expect(t.split('Module welcome').length - 1).toBe(1);
  // the same through the model (HTML and PDF read it)
  const m = await page.evaluate(() => { const model = mbBuildModuleModel('en'); return { h: model.lgModule.heading, n: model.lgModule.items.length, html: mbBuildModuleHtml(model, {}).includes('Module welcome') }; });
  expect(m).toEqual({ h: 'Computer maintenance', n: 2, html: true });
  expect(errors).toEqual([]);
});
