// 3.34.0: one language per text. DACUM's texts are written on the side
// of their own language with labels in that language; translations sent
// by DACUM fill the other sides; a text with no version in the content
// language is flagged, never written under another language's label;
// "✨ Translate" fills what is missing and the sheets already built.
const { test, expect } = require('@playwright/test');
const { openApp, fixture, tab, openModule } = require('../helpers');

const AR = fixture('dacum-handoff-ar.json');       // English texts + an Arabic version (one step untranslated)
const PLAIN = fixture('dacum-handoff.json');       // English only, no language field (older DACUM)
const panel = (page, kind) => page.locator(`#mb-sp-${kind}`);
const row = (page, kind, text) => panel(page, kind).locator('.mb-sp-row', { hasText: text });
const LATIN = /[A-Za-z]{3,}/;                      // a word in Latin script (codes like A1 are fine)

async function build(page, kind, texts) {
  await tab(page, kind);
  for (const t of texts) await row(page, kind, t).locator('.mb-sp-check').check();
  await panel(page, kind).locator('[data-act="mbSpBuild"][data-args*="selected"]').click();
}

test('Arabic content, English DACUM texts with an Arabic version: every side in its own language', async ({ page }) => {
  const errors = await openApp(page, { handoff: AR, contentLang: 'ar' });
  expect(await openModule(page, m => m.dacumLang)).toBe('en');

  await tab(page, 'activity');
  await expect(row(page, 'activity', 'تجهيز مكان العمل')).toBeVisible();          // shown in Arabic
  await expect(row(page, 'activity', 'Clean the contacts').locator('.mb-sp-lang')).toHaveText('EN');
  await expect(panel(page, 'activity').locator('.mb-sp-langbar')).toContainText('1 items have no Arabic text yet');

  await build(page, 'activity', ['تجهيز مكان العمل', 'Clean the contacts', 'فصل التيار الكهربائي', 'إصلاح القطعة أو استبدالها', 'حساب زمن الإصلاح']);
  const act = await openModule(page, m => m.learningOutcomes[0].activitySheets[0]);
  expect(act.title).toMatchObject({ en: 'Perform task A1', ar: 'أداء المهمة A1' });
  const steps = act.steps.map(s => ({ en: s.text.en, ar: s.text.ar }));
  expect(steps).toEqual([
    { en: 'Safety: Disconnect power', ar: 'السلامة: فصل التيار الكهربائي' },
    { en: 'Prepare the workspace', ar: 'تجهيز مكان العمل' },
    { en: 'Clean the contacts', ar: '' },                                          // no Arabic yet: left empty
    { en: 'Calculation: Calculate the repair time', ar: 'حساب: حساب زمن الإصلاح' },
    { en: 'Check: Repair or replace the part — Cue: Visible wear', ar: 'تحقّق: إصلاح القطعة أو استبدالها — المؤشر: تآكل ظاهر' },
  ]);
  for (const s of steps) expect(s.ar).not.toMatch(LATIN);
  await expect(page.locator('#status')).toContainText('1 of them have no Arabic text yet');

  // information sheet: supporting skills and the decision, in both languages
  await build(page, 'info', ['قراءة بطاقة العمل', 'حساب زمن الإصلاح', 'إصلاح القطعة أو استبدالها']);
  const secs = await openModule(page, m => m.learningOutcomes[0].infoSheets[0].contentSections.map(c => ({ h: c.heading, t: c.text })));
  const skills = secs.find(c => c.h.en === 'Supporting skills');
  expect(skills.h.ar).toBe('مهارات داعمة');
  expect(skills.t.ar).toBe('القراءة: قراءة بطاقة العمل\nالرياضيات: حساب زمن الإصلاح');
  const dec = secs.find(c => c.h.en === 'Repair or replace the part');
  expect(dec.t.ar).toBe('المؤشر: تآكل ظاهر\nعاقبة القرار الخاطئ: تكرار العطل\nكيف يتعامل الخبير معه: يراجع سجل الصيانة أولاً');
  expect(dec.t.en).toContain('If decided wrongly: Repeat failure');

  // assessment: one value per language; the form shows the content language's side
  await build(page, 'assessment', ['فصل التيار الكهربائي']);
  const crit = await page.evaluate(() => mbState.assessmentFormsData[mbState.currentLOId].rows.map(r => r.criteria)
    .find(c => c && c.en === 'Mandatory: Disconnect power'));
  expect(crit.ar).toBe('إلزامي: فصل التيار الكهربائي');
  await expect(page.locator('#assessment-forms-list input[value="إلزامي: فصل التيار الكهربائي"]')).toHaveCount(1);
  await page.evaluate(() => switchContentLang('en'));
  await expect(page.locator('#assessment-forms-list input[value="Mandatory: Disconnect power"]')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('✨ Translate fills what DACUM did not translate, also on sheets already built; kept after a reload', async ({ page }) => {
  const errors = await openApp(page, { handoff: AR, contentLang: 'ar' });
  let prompt = '';
  await page.route('**/api/generate-dacum', async route => {
    prompt = JSON.parse(route.request().postData()).prompt;
    const src = JSON.parse(prompt.split('\nSOURCE\n')[1].split('\n\nOUTPUT FORMAT')[0]);
    const t = Object.fromEntries(Object.entries(src).map(([k, v]) => [k, v === 'Clean the contacts' ? 'تنظيف نقاط التلامس' : 'ت ' + v]));
    await route.fulfill({ json: { content: [{ type: 'text', text: JSON.stringify({ t }) }] } });
  });
  await build(page, 'activity', ['Clean the contacts']);
  expect(await openModule(page, m => m.learningOutcomes[0].activitySheets[0].steps[0].text.ar)).toBe('');
  await panel(page, 'activity').locator('[data-act="mbSpTranslate"]').click();
  await expect(page.locator('#status')).toContainText('texts translated');
  expect(prompt).toContain('from English into Arabic');
  expect(prompt).toContain('Clean the contacts');
  expect(prompt).not.toContain('Prepare the workspace');                         // already translated by DACUM
  expect(await openModule(page, m => m.learningOutcomes[0].activitySheets[0].steps[0].text.ar)).toBe('تنظيف نقاط التلامس');
  await expect(row(page, 'activity', 'تنظيف نقاط التلامس')).toBeVisible();
  await expect(panel(page, 'activity').locator('.mb-sp-langbar')).toHaveCount(0);

  await page.waitForTimeout(800);
  await page.reload();
  await page.waitForFunction(() => window.mbLib && window.mbLib.booted === true);
  expect(await openModule(page, m => m.mbI18n.ar['Clean the contacts'])).toBe('تنظيف نقاط التلامس');
  expect(errors).toEqual([]);
});

test('exports put the labels in the export language too', async ({ page }) => {
  const errors = await openApp(page, { handoff: AR, contentLang: 'en' });
  const out = await page.evaluate(() => ({
    safety: mbDacumText('Safety: Disconnect power', 'ar'),
    check: mbDacumText('Check: Repair or replace the part', 'ar'),
    none: mbDacumText('Safety: Clean the contacts', 'ar'),                       // no Arabic: unchanged, one language
  }));
  expect(out).toEqual({ safety: 'السلامة: فصل التيار الكهربائي', check: 'تحقّق: إصلاح القطعة أو استبدالها', none: 'Safety: Clean the contacts' });
  expect(errors).toEqual([]);
});

test('an older handoff with no language field: the language is read from the texts, nothing is mixed', async ({ page }) => {
  const errors = await openApp(page, { handoff: PLAIN, contentLang: 'ar' });
  expect(await openModule(page, m => ({ has: 'dacumLang' in m }))).toEqual({ has: false });
  expect(await page.evaluate(() => mbDacumLang(mbState.modulesData[0]))).toBe('en');
  await tab(page, 'activity');
  await expect(panel(page, 'activity').locator('.mb-sp-langbar')).toBeVisible();
  await build(page, 'activity', ['Prepare the workspace', 'Disconnect power']);
  const steps = await openModule(page, m => m.learningOutcomes[0].activitySheets[0].steps.map(s => s.text));
  expect(steps.map(s => s.en)).toEqual(['Safety: Disconnect power', 'Prepare the workspace']);
  expect(steps.map(s => s.ar)).toEqual(['', '']);                                 // never "السلامة: Disconnect power"
  expect(errors).toEqual([]);
});

test('an item edited in Arabic is written on the Arabic side; the English side keeps DACUM’s text', async ({ page }) => {
  const errors = await openApp(page, { handoff: AR, contentLang: 'ar' });
  await tab(page, 'activity');
  await row(page, 'activity', 'Clean the contacts').locator('[data-act="mbSpEdit"]').click();
  await expect(panel(page, 'activity').locator('textarea')).toHaveAttribute('placeholder', 'Clean the contacts');
  await panel(page, 'activity').locator('textarea').fill('تنظيف الملامسات');
  await panel(page, 'activity').locator('[data-act="mbSpSaveEdit"]').click();
  await build(page, 'activity', ['تنظيف الملامسات']);
  const step = await openModule(page, m => m.learningOutcomes[0].activitySheets[0].steps[0].text);
  expect(step).toMatchObject({ en: 'Clean the contacts', ar: 'تنظيف الملامسات' });
  expect(errors).toEqual([]);
});

test('switching the content language keeps the rows not written in it yet', async ({ page }) => {
  const errors = await openApp(page, { handoff: PLAIN, contentLang: 'en' });
  await build(page, 'activity', ['Prepare the workspace', 'Screwdriver set']);
  await build(page, 'info', ['Component layout']);
  await page.evaluate(() => switchContentLang('ar'));
  await page.evaluate(() => { saveCurrentSheetToLO(); saveCurrentModuleLOData(); });
  await page.evaluate(() => switchContentLang('en'));
  await page.evaluate(() => { saveCurrentSheetToLO(); saveCurrentModuleLOData(); });
  const m = await openModule(page, m => ({
    steps: m.learningOutcomes[0].activitySheets[0].steps.map(s => s.text.en),
    res: m.learningOutcomes[0].activitySheets[0].resources.map(s => s.name.en),
    secs: m.learningOutcomes[0].infoSheets[0].contentSections.map(c => c.heading.en) }));
  expect(m).toEqual({ steps: ['Prepare the workspace'], res: ['Screwdriver set'], secs: ['Component layout'] });
  expect(errors).toEqual([]);
});
