// 3.43.0: the order and numbering inside a learning outcome (lo_sequence.js)
// — "1-1 Introduction, 1-2 Knowledge, 1-3 Learning Activity, … 1-6
// Reflection": sheets interleaved, one number sequence, outcome sections
// printed at the start or the end of their outcome.
const { test, expect } = require('@playwright/test');
const { openApp, fixture, tab } = require('../helpers');

async function buildAll(page, kind) {
  await tab(page, kind);
  await page.evaluate(k => { mbSpViewFilter(k, 'all'); mbSpApproveMany(k, 'shown'); mbSpBuild(k, 'all'); }, kind);
}

async function docxText(page) {
  const xml = await page.evaluate(async () => {
    let got = null;
    window.mbExportSink = { take: (b) => { got = b; return Promise.resolve(); }, skip: () => {}, fail: (e) => { throw e; } };
    try { await exportToDocx(); } finally { window.mbExportSink = null; }
    return new TextDecoder().decode(fflate.unzipSync(new Uint8Array(await got.arrayBuffer()))['word/document.xml']);
  });
  return xml.replace(/<w:p[ >]/g, '\n$&').replace(/<[^>]+>/g, '');
}

/** Two information and two activity sheets in outcome 1, titled. */
async function setup(page) {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
  await buildAll(page, 'info');
  await buildAll(page, 'activity');
  await page.evaluate(() => {
    const lo = mbState.learningOutcomesData[0];
    const t = (s) => ({ en: s, ar: '', fr: '' });
    lo.infoSheets = lo.infoSheets.slice(0, 2);
    lo.activitySheets = lo.activitySheets.slice(0, 2);
    while (lo.infoSheets.length < 2) lo.infoSheets.push({ title: t(''), contentSections: [] });
    while (lo.activitySheets.length < 2) lo.activitySheets.push({ title: t(''), steps: [], criteria: [] });
    lo.infoSheets[0].title = t('Quotations'); lo.infoSheets[1].title = t('Choosing an offer');
    lo.activitySheets[0].title = t('Bring quotations'); lo.activitySheets[1].title = t('Choose the offer');
    lo.blocks = [
      { uid: 'b1', title: t('Introduction'), body: t('What this outcome is about.'), tables: [], place: 'before' },
      { uid: 'b2', title: t('Reflection'), body: t('What are the sources of financing?'), tables: [], place: 'after' },
      { uid: 'b3', title: t('Conditions'), body: t('Classroom.'), tables: [] }
    ];
    saveCurrentModuleLOData();
    // the editor shows these sheets now, so its next save writes them back unchanged
    _applyLOSwitch(lo.id);
    loadCurrentLOSheets();
  });
  return errors;
}

const seqOf = (page) => page.evaluate(() => {
  const o = mbBuildModuleModel('en').outcomes[0];
  return o.sequence.map(it => it.kind === 'block'
    ? 'B:' + (it.block.number ? it.block.number + ' ' : '') + it.block.title
    : (it.kind === 'info' ? 'I:' : 'A:') + it.sheet.number + ' ' + it.sheet.title);
});

test('default: information sheets, then activity sheets; placed sections still in the outcome', async ({ page }) => {
  const errors = await setup(page);
  const seq = await seqOf(page);
  expect(seq.map(x => x.slice(0, 2))).toEqual(['B:', 'I:', 'I:', 'A:', 'A:', 'B:']);
  expect(seq[0]).toBe('B:Introduction');                    // not numbered without the setting
  // the overview page keeps only the unplaced section
  const ov = await page.evaluate(() => mbBuildModuleModel('en').outcomes[0].blocks.map(b => b.title));
  expect(ov).toEqual(['Conditions']);
  expect(errors).toEqual([]);
});

test('interleaved + one sequence: 1-1 Introduction … 1-6 Reflection, in Word and the model', async ({ page }) => {
  const errors = await setup(page);
  await page.evaluate(() => {
    wsWriteSettings(Object.assign(wsReadSettings(), {
      sheetOrder: 'interleaved', unifiedNumbering: true,
      sheetLabels: { en: { info: 'Knowledge', activity: 'Learning Activity', task: '', job: '', operation: '' } }
    }));
    window.dispatchEvent(new CustomEvent('mb:settingschange'));
  });
  expect(await seqOf(page)).toEqual([
    'B:1-1 Introduction', 'I:1-2 Quotations', 'A:1-3 Bring quotations',
    'I:1-4 Choosing an offer', 'A:1-5 Choose the offer', 'B:1-6 Reflection']);

  const text = await docxText(page);
  const at = (s) => { const i = text.indexOf(s); expect(i, s).toBeGreaterThan(-1); return i; };
  const order = ['1-1 Introduction', 'Knowledge 1-2 / Quotations', 'Learning Activity 1-3 / Bring quotations',
                 'Knowledge 1-4 / Choosing an offer', 'Learning Activity 1-5 / Choose the offer', '1-6 Reflection'].map(at);
  expect([...order].sort((a, b) => a - b)).toEqual(order);
  expect(text).toContain('Performance Criteria Check List/ 1-3');

  // "Comes after": the first activity moved after the second information sheet
  await page.evaluate(() => {
    const lo = mbState.learningOutcomesData[0];
    lo.activitySheets[0].afterInfo = mbInfoSheetKey(lo.infoSheets[1]);
  });
  expect(await seqOf(page)).toEqual([
    'B:1-1 Introduction', 'I:1-2 Quotations', 'I:1-3 Choosing an offer',
    'A:1-4 Bring quotations', 'A:1-5 Choose the offer', 'B:1-6 Reflection']);
  expect(errors).toEqual([]);
});

test('editor: the number field shows the computed number, read-only; "Comes after" and section placement', async ({ page }) => {
  const errors = await setup(page);
  await page.evaluate(() => {
    wsWriteSettings(Object.assign(wsReadSettings(), { sheetOrder: 'interleaved', unifiedNumbering: true }));
    window.dispatchEvent(new CustomEvent('mb:settingschange'));
  });
  await tab(page, 'activity');
  await page.evaluate(() => { _applyLOSwitch(mbState.learningOutcomesData[0].id); mbState.currentActivitySheetIndex = 1; loadActivitySheetAtIndex(mbState.learningOutcomesData[0], 1); });
  await page.waitForTimeout(100);
  const num = page.locator('#sheet-number');
  await expect(num).toHaveValue('1-5');
  await expect(num).toHaveJSProperty('readOnly', true);
  await expect(page.locator('#activity-after-row')).toBeVisible();
  await expect(page.locator('#activity-after-info option')).toHaveCount(3);   // Automatic + 2 sheets
  await page.locator('#activity-after-info').selectOption({ index: 1 });      // after the first sheet
  await expect(num).toHaveValue('1-4');
  // 3.80.4: the «Learning Outcome Sections» card is gone from the Module tab; sections already
  // written keep their place and are still changed by the same function
  await tab(page, 'basic-info');
  await expect(page.locator('#lo-blocks-section')).toHaveCount(0);
  await page.evaluate(() => mbRenderBlocks('lo'));   // no card to paint: must not throw
  expect(await page.evaluate(() => mbState.learningOutcomesData[0].blocks[0].place)).toBe('before');
  await page.evaluate(() => mbBlockSetPlace(mbState.learningOutcomesData[0].blocks[2].uid, 'after'));
  expect(await page.evaluate(() => mbState.learningOutcomesData[0].blocks[2].place)).toBe('after');
  // switched off: the field is editable again
  await page.evaluate(() => {
    wsWriteSettings(Object.assign(wsReadSettings(), { sheetOrder: 'byType', unifiedNumbering: false }));
    window.dispatchEvent(new CustomEvent('mb:settingschange'));
  });
  await tab(page, 'activity');
  await expect(page.locator('#activity-after-row')).toBeHidden();
  await expect(num).toHaveJSProperty('readOnly', false);
  expect(errors).toEqual([]);
});

test('Settings → Misc: order and numbering fields, saved', async ({ page }) => {
  const errors = await openApp(page, { lang: 'ar' });
  await page.locator('#mb-settings-nav').click();
  const ov = page.locator('#ws-overlay');
  await ov.locator('.ws-nav-btn[data-ws-pane="misc"]').click();
  await expect(ov.locator('[data-pane="misc"]')).toContainText('الترتيب والترقيم داخل محصلة التعلم');
  await ov.locator('select[data-ws-misc="sheetOrder"]').selectOption('interleaved');
  await ov.locator('input[data-ws-misc="unifiedNumbering"]').check();
  await ov.locator('#ws-save').click();
  expect(await page.evaluate(() => { const s = wsReadSettings(); return [s.sheetOrder, s.unifiedNumbering]; }))
    .toEqual(['interleaved', true]);
  expect(errors).toEqual([]);
});
