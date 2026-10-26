// Settings → Language → Translate content (src/content_translate.js).
// The AI backend is replaced by a stub that "translates" every text by
// prefixing it, so the tests check what is sent, what is stored, what is
// kept (manual edits) and that the exports read the translated side.
const { test, expect } = require('@playwright/test');
const { openApp, fixture, openModule } = require('../helpers');

const HANDOFF = fixture('dacum-handoff.json');

/** Stub /api/generate-dacum: answer {"t":{id: "[to] source"}} for the SOURCE of the prompt. */
async function stubAI(page, calls) {
  await page.route('**/api/generate-dacum', async (route) => {
    const prompt = JSON.parse(route.request().postData()).prompt;
    const to = /into (English|Arabic|French)\./.exec(prompt)[1];
    const tag = { English: 'EN', Arabic: 'AR', French: 'FR' }[to];
    const src = JSON.parse(prompt.split('SOURCE\n')[1].split('\n\nOUTPUT FORMAT')[0]);
    calls.push({ to, src });
    const t = {};
    Object.keys(src).forEach(k => { t[k] = `[${tag}] ${src[k]}`; });
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ t }) }] }) });
  });
}

async function openLanguagePane(page) {
  await page.evaluate(() => openWordSettings('lang'));
  await expect(page.locator('#mbtr-root')).toBeVisible();
}

/** An Arabic module: title, description (same words as an outcome title, to prove each text is sent once), a cover value. */
async function arabicModule(page) {
  await page.evaluate(() => {
    const m = mbState.modulesData.find(x => x.id === mbState.currentModuleId);
    m.title = { en: '', ar: 'أساسيات الكهرباء', fr: '' };
    m.description = { en: '', ar: 'قياس الجهد', fr: '' };
    m.learningOutcomes[0].title = { en: '', ar: 'قياس الجهد', fr: '' };
    mbState.coverRows[0].value = { en: '', ar: 'الكهرباء', fr: '' };
  });
}

test('translates the empty side of every text once, keeps manual edits, and the export side reads it', async ({ page }) => {
  const errors = await openApp(page, { handoff: HANDOFF, contentLang: 'ar' });
  const calls = [];
  await stubAI(page, calls);
  await arabicModule(page);
  await openLanguagePane(page);

  // The original language can be set until a translation exists; Arabic is the one shown.
  await page.selectOption('#mbtr-original', 'ar');
  const ar = page.locator('.mbtr-lang[data-lang="ar"]');
  await expect(ar).toContainText('Original');
  await expect(ar).toContainText('Shown');

  await page.selectOption('#mbtr-to', 'en');
  await page.click('[data-mbtr="go"]');
  await expect(page.locator('#mbtr-msg')).toContainText('Translated', { timeout: 15_000 });

  // Each distinct text was sent once: "قياس الجهد" is the outcome title and the description.
  const sent = calls.flatMap(c => Object.values(c.src));
  expect(sent.filter(s => s === 'قياس الجهد')).toHaveLength(1);
  expect(sent).toContain('أساسيات الكهرباء');

  const mod = await openModule(page, m => ({
    title: m.title, lo: m.learningOutcomes[0].title, desc: m.description, mbTr: m.mbTr,
    cover: null,
  }));
  expect(mod.title).toMatchObject({ ar: 'أساسيات الكهرباء', en: '[EN] أساسيات الكهرباء' });
  expect(mod.lo.en).toBe('[EN] قياس الجهد');
  expect(mod.desc.en).toBe('[EN] قياس الجهد');
  expect(await page.evaluate(() => mbState.coverRows[0].value.en)).toBe('[EN] الكهرباء');
  expect(Object.keys(mod.mbTr)).toEqual(['to_en']);                 // no key that reads as a language pair

  // The coverage meter on the card counts the new side.
  await expect(page.locator('.mbtr-lang[data-lang="en"] .mbtr-cov')).not.toContainText('0 of');

  // Nothing left to translate → nothing sent.
  const before = calls.length;
  await page.click('[data-mbtr="go"]');
  await expect(page.locator('#mbtr-msg')).toContainText('Nothing to translate');
  expect(calls.length).toBe(before);

  // A manual edit is kept by "re-translate"; an untouched AI text is translated again.
  await page.evaluate(() => {
    const m = mbState.modulesData.find(x => x.id === mbState.currentModuleId);
    m.title.en = 'Electricity basics (my wording)';
  });
  await page.check('[data-mbtr="retr"]');
  await page.click('[data-mbtr="go"]');
  await expect(page.locator('#mbtr-msg')).toContainText('Translated', { timeout: 15_000 });
  const after = await openModule(page, m => ({ title: m.title.en, lo: m.learningOutcomes[0].title.en }));
  expect(after.title).toBe('Electricity basics (my wording)');
  expect(after.lo).toBe('[EN] قياس الجهد');

  // The original language is now locked.
  await expect(page.locator('#mbtr-original')).toBeDisabled();

  // Showing the translation switches the content AND the export language.
  await page.click('.mbtr-lang[data-lang="en"]');
  expect(await page.evaluate(() => [contentLang(), exportLang()])).toEqual(['en', 'en']);
  const flat = await page.evaluate(() => {
    const m = mbState.modulesData.find(x => x.id === mbState.currentModuleId);
    return biFlattenDeep(m, exportLang()).learningOutcomes[0].title;
  });
  expect(flat).toBe('[EN] قياس الجهد');

  expect(errors).toEqual([]);
});

test('translating into the language on screen fills the fields and survives a save round-trip', async ({ page }) => {
  const errors = await openApp(page, { handoff: HANDOFF, contentLang: 'ar' });
  const calls = [];
  await stubAI(page, calls);
  await arabicModule(page);

  // Show French (empty), then translate Arabic → French while it is on screen.
  await page.evaluate(() => switchContentLang('fr'));
  await openLanguagePane(page);
  await page.selectOption('#mbtr-from', 'ar');
  await page.selectOption('#mbtr-to', 'fr');
  await page.click('[data-mbtr="go"]');
  await expect(page.locator('#mbtr-msg')).toContainText('Translated', { timeout: 15_000 });

  // A flush of the screen (what autosave does) must not wipe what was just translated.
  await page.evaluate(() => _mbLibFlush());
  const fr = await openModule(page, m => m.title.fr);
  expect(fr).toBe('[FR] أساسيات الكهرباء');

  // The library stores it (the translated side is an ordinary side of the pair).
  const saved = await page.evaluate(() => mbLibrarySave({ force: true }));
  expect(saved.changed).toBe(true);
  const back = await openModule(page, m => ({ fr: m.title.fr, ar: m.title.ar, mbTr: m.mbTr }));
  expect(back.ar).toBe('أساسيات الكهرباء');
  expect(Object.keys(back.mbTr)).toEqual(['to_fr']);
  expect(errors).toEqual([]);
});

test('a failing service keeps what was translated and warns', async ({ page }) => {
  const errors = await openApp(page, { handoff: HANDOFF, contentLang: 'ar' });
  await arabicModule(page);
  await page.route('**/api/generate-dacum', route => route.fulfill({ status: 500, body: 'boom' }));
  await openLanguagePane(page);
  await page.selectOption('#mbtr-to', 'en');
  await page.click('[data-mbtr="go"]');
  await expect(page.locator('#mb-ai-err')).toBeVisible({ timeout: 15_000 });
  const title = await openModule(page, m => m.title);
  expect(title.ar).toBe('أساسيات الكهرباء');
  expect(title.en || '').toBe('');
  expect(errors).toEqual([]);
});
