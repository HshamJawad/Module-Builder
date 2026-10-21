// 3.67.0: the «Learner guide» template — outcomes headed as learning
// units everywhere (named in Settings → Misc → «Learner guide names»),
// the optional objectives of a knowledge sheet behind one button, and
// the attached figures and tables card closed behind its title.
const { test, expect } = require('@playwright/test');
const { openApp, fixture, tab } = require('../helpers');

async function docxText(page) {
  const xml = await page.evaluate(async () => {
    let got = null;
    window.mbExportSink = { take: (b) => { got = b; return Promise.resolve(); }, skip: () => {}, fail: (e) => { throw e; } };
    try { await exportToDocx(); } finally { window.mbExportSink = null; }
    return new TextDecoder().decode(fflate.unzipSync(new Uint8Array(await got.arrayBuffer()))['word/document.xml']);
  });
  return xml.replace(/<w:p[ >]/g, '\n$&').replace(/<[^>]+>/g, '');
}

async function toGuide(page) {
  await page.evaluate(() => { const s = wsReadSettings(); s.templateConvert = true; wsWriteSettings(s); });
  await page.evaluate(() => mbSwitchTemplate('learnerGuide', { ask: false }));
  await page.waitForFunction(() => mbState.moduleTemplate === 'learnerGuide');
}

/** One knowledge sheet with a title and a content section, on screen. */
async function writeKnowledge(page, title, text) {
  await tab(page, 'info');
  await page.locator('#info-title').fill(title);
  await page.locator('#content-sections-container textarea').first().fill(text);
  await page.evaluate(() => { saveCurrentSheetToLO(); saveCurrentModuleLOData(); });
}

async function saveLgNames(page, names) {
  await page.locator('#mb-settings-nav').click();
  const ov = page.locator('#ws-overlay');
  await ov.locator('.ws-nav-btn[data-ws-pane="misc"]').click();
  await expect(ov.locator('#ws-lg-names tbody tr')).toHaveCount(5);
  for (const [k, v] of Object.entries(names)) await ov.locator(`input[data-ws-lglabel="${k}"]`).fill(v);
  await ov.locator('#ws-save').click();
  await ov.locator('#ws-close').click();
}

test('Arabic: «1- الوحدة التعلمية: …» on screen and in Word, renamed in Settings', async ({ page }) => {
  const errors = await openApp(page, { lang: 'ar', contentLang: 'ar', handoff: fixture('dacum-handoff-ar.json') });
  const loLabel = page.locator('#info-tab .mb-ctx-label[data-i18n="mbLearningOutcome"]');
  await tab(page, 'info');
  await expect(loLabel).toHaveText('📚 محصلة التعلم:');
  await toGuide(page);
  await expect(loLabel).toHaveText('📚 الوحدة التعلمية:');
  await writeKnowledge(page, 'المفكات', 'استخدم المقاس الصحيح.');
  const loTitle = await page.evaluate(() => mbLoPlainTitle(biGetStrict(mbState.learningOutcomesData[0].title, 'ar')));
  let t = await docxText(page);
  expect(t).toContain('1- الوحدة التعلمية: ' + loTitle);
  expect(t).not.toContain('محصلة التعلم 1: ' + loTitle);           // the overview too
  expect(t).toContain('1-1 المعرفة: المفكات');

  await saveLgNames(page, { 'ar:unit': 'الدرس', 'ar:info': 'المعارف' });
  await expect(loLabel).toHaveText('📚 الدرس:');
  await expect(page.locator('#mb-sidenav .tab[data-args=\'["info"]\']')).toHaveText('المعارف');
  t = await docxText(page);
  expect(t).toContain('1- الدرس: ' + loTitle);
  expect(t).toContain('1-1 المعارف: المفكات');
  // the standard template is not touched by these names
  await page.evaluate(() => mbSwitchTemplate('standard', { ask: false }));
  await expect(loLabel).toHaveText('📚 محصلة التعلم:');
  expect(errors).toEqual([]);
});

test('knowledge sheet: objectives hidden behind «🎯 الأهداف (اختياري)», saved, printed only when shown', async ({ page }) => {
  const errors = await openApp(page, { lang: 'ar', contentLang: 'ar', handoff: fixture('dacum-handoff-ar.json') });
  await toGuide(page);
  await writeKnowledge(page, 'المفكات', 'استخدم المقاس الصحيح.');
  const group = page.locator('#info-objective-group');
  const btn = page.locator('#lg-obj-toggle');
  await expect(group).toBeHidden();
  await expect(btn).toBeVisible();
  await expect(btn).toHaveText('🎯 الأهداف (اختياري)');
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
  let t = await docxText(page);
  expect(t).not.toContain('الأهداف:');
  expect(t).not.toContain('بعد دراستك');

  await btn.click();
  await expect(group).toBeVisible();
  await expect(page.locator('#info-objective')).toBeFocused();
  await expect(page.locator('label[for="info-objective"]')).toHaveText('الأهداف:');
  await page.locator('#info-objective').fill('تمييز أنواع المفكات');
  await page.evaluate(() => { saveCurrentSheetToLO(); saveCurrentModuleLOData(); mbLibrarySave(); });
  t = await docxText(page);
  expect(t).toContain('الأهداف:');
  expect(t).toContain('تمييز أنواع المفكات');
  const shown = await page.evaluate(() => mbBuildModuleModel('ar').outcomes[0].infoSheets[0]);
  expect(shown.objective).toBe('تمييز أنواع المفكات');
  expect(shown.objectiveLabel).toBe('الأهداف');

  // kept after a reload
  await page.waitForTimeout(800);
  await page.reload();
  await page.waitForFunction(() => window.mbLib && window.mbLib.booted === true);
  await tab(page, 'info');
  await expect(group).toBeVisible();
  await expect(page.locator('#info-objective')).toHaveValue('تمييز أنواع المفكات');

  // hidden again: the text is kept but not printed
  await btn.click();
  await expect(group).toBeHidden();
  t = await docxText(page);
  expect(t).not.toContain('تمييز أنواع المفكات');
  // HTML and PDF read the same model: neither the objectives nor their lead
  const sh = await page.evaluate(() => { saveCurrentSheetToLO(); return mbBuildModuleModel('ar').outcomes[0].infoSheets[0]; });
  expect(sh.objective).toBe('');
  expect(sh.objectiveLead).toBe('');
  await btn.click();
  await expect(page.locator('#info-objective')).toHaveValue('تمييز أنواع المفكات');

  // the standard template: the objective as always, no button
  await page.evaluate(() => mbSwitchTemplate('standard', { ask: false }));
  await expect(group).toBeVisible();
  await expect(btn).toBeHidden();
  await expect(page.locator('label[for="info-objective"]')).toHaveText('الهدف:');
  expect(errors).toEqual([]);
});

for (const lang of ['ar', 'en']) {
  test(`attached figures and tables: one click on the title opens the card with an item; the last removed closes it (${lang})`, async ({ page }) => {
    if (lang === 'ar') await page.setViewportSize({ width: 360, height: 800 });
    const errors = await openApp(page, { lang, contentLang: lang, handoff: fixture(lang === 'ar' ? 'dacum-handoff-ar.json' : 'dacum-handoff.json') });
    for (const kind of ['info', 'activity']) {
      await tab(page, kind);
      const card = page.locator(`#${kind}-attachments-card`);
      const head = card.locator('.mb-att-toggle');
      await expect(head).toHaveText(lang === 'ar' ? /أشكال وجداول ملحقة/ : /Attached figures and tables/);
      await expect(card.locator('.mb-att-card-body')).toBeHidden();
      await expect(head).toHaveAttribute('aria-expanded', 'false');
      await head.click();
      await expect(card.locator('.mb-att-card-body')).toBeVisible();
      await expect(card.locator('.mb-att-item')).toHaveCount(1);
      await expect(head).toHaveAttribute('aria-expanded', 'true');
      await expect(card.locator('.mb-att-count')).toHaveText('(1)');
      // fold and unfold a card that holds items
      await head.click();
      await expect(card.locator('.mb-att-card-body')).toBeHidden();
      await head.click();
      await expect(card.locator('.mb-att-card-body')).toBeVisible();
      await card.locator('[data-act="mbAttRemove"]').click();
      await page.locator('.mb-dialog-ok').click();
      await expect(card.locator('.mb-att-item')).toHaveCount(0);
      await expect(card.locator('.mb-att-card-body')).toBeHidden();
    }
    if (lang === 'ar') expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('attached item saved: the card opens on that sheet with its count, and stays closed on an empty one', async ({ page }) => {
  const errors = await openApp(page, { lang: 'en', contentLang: 'en', handoff: fixture('dacum-handoff.json') });
  await tab(page, 'info');
  await page.locator('#info-title').fill('Screwdrivers');
  await page.locator('#info-attachments-card .mb-att-toggle').click();
  await page.locator('#info-attachments-card [data-act="mbAttSetType"][data-args*="table"]').click();
  await page.evaluate(() => { saveCurrentSheetToLO(); saveCurrentModuleLOData(); });
  await page.evaluate(() => addNewInfoSheet());
  await expect(page.locator('#info-attachments-card')).toHaveClass(/is-collapsed/);
  await page.evaluate(() => prevInfoSheet());
  await expect(page.locator('#info-attachments-card')).not.toHaveClass(/is-collapsed/);
  await expect(page.locator('#info-attachments-card .mb-att-count')).toHaveText('(1)');
  expect(errors).toEqual([]);
});
