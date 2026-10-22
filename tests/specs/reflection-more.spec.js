// 3.75.0: «➕ Add more questions» in the Reflection tab (Learner guide) —
// the card repeated, each group with an optional subheading, its
// questions and its answer lines; kept, per language, and printed on the
// same Reflection page in Word, HTML and PDF.
const { test, expect } = require('@playwright/test');
const { openApp, fixture, tab } = require('../helpers');

async function guide(page) {
  await page.evaluate(() => { const s = wsReadSettings(); s.templateConvert = true; wsWriteSettings(s); });
  await page.evaluate(() => mbSwitchTemplate('learnerGuide', { ask: false }));
  await page.waitForFunction(() => mbState.moduleTemplate === 'learnerGuide');
  await page.evaluate(() => { const lo = mbState.learningOutcomesData[0]; mbState.currentLOId = null; _applyLOSwitch(lo.id); });
}
async function wordText(page) {
  const xml = await page.evaluate(async () => {
    let got = null;
    window.mbExportSink = { take: (b) => { got = b; return Promise.resolve(); }, skip: () => {}, fail: (e) => { throw e; } };
    try { await exportToDocx(); } finally { window.mbExportSink = null; }
    return new TextDecoder().decode(fflate.unzipSync(new Uint8Array(await got.arrayBuffer()))['word/document.xml']);
  });
  return xml.replace(/<w:p[ >]/g, '\n$&').replace(/<[^>]+>/g, '');
}

test('more groups of reflection questions: added, kept after a reload, printed on the one Reflection page', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), lang: 'en', contentLang: 'en' });
  await guide(page);
  await tab(page, 'reflection');
  const host = page.locator('#lg-reflection-section');
  await host.locator('[data-lg-field="refl.questions"]').fill('What did you learn?');
  await expect(host.locator('.lg-refl-more')).toHaveCount(0);

  await host.locator('.lg-refl-add').click();
  await expect(host.locator('.lg-refl-more')).toHaveCount(1);
  await expect(host.locator('.lg-refl-more .lg-part-head')).toContainText('More questions 2');
  const g1 = host.locator('.lg-refl-more').nth(0);
  await expect(g1.locator('textarea')).toBeFocused();
  await g1.locator('input.mb-block-title').fill('About safety');
  await g1.locator('textarea').fill('Which tool was the most dangerous?\nHow did you protect yourself?');
  await g1.locator('input.lg-lines').fill('3');
  await g1.locator('input.lg-lines').dispatchEvent('change');

  await host.locator('.lg-refl-add').click();
  const g2 = host.locator('.lg-refl-more').nth(1);
  await g2.locator('textarea').fill('What would you do differently?');

  await page.evaluate(() => mbLibrarySave({ force: true }));
  await page.reload();
  await page.waitForFunction(() => window.mbLib && mbLib.booted === true);
  await page.waitForTimeout(400);
  await tab(page, 'reflection');
  await expect(page.locator('#lg-reflection-section .lg-refl-more')).toHaveCount(2);
  await expect(page.locator('#lg-reflection-section .lg-refl-more').nth(0).locator('input.mb-block-title')).toHaveValue('About safety');
  await expect(page.locator('#lg-reflection-section .lg-refl-more').nth(0).locator('input.lg-lines')).toHaveValue('3');

  // Word: one page, the groups in order, the subheading above its questions, three lines under each of them
  const t = await wordText(page);
  const at = (s) => { const i = t.indexOf(s); expect(i, s).toBeGreaterThan(-1); return i; };
  const order = ['Reflection on learning unit 1', 'What did you learn?', 'About safety', 'Which tool was the most dangerous?',
                 'How did you protect yourself?', 'What would you do differently?'].map(at);
  expect([...order].sort((a, b) => a - b)).toEqual(order);
  const block = t.slice(at('Which tool was the most dangerous?'), at('How did you protect yourself?'));
  expect((block.match(/\.{50,}/g) || []).length).toBe(3);
  // HTML and PDF model
  const r = await page.evaluate(() => {
    const m = mbBuildModuleModel('en');
    const it = m.outcomes[0].sequence.find(x => x.kind === 'lgReflection');
    return { groups: it.reflection.groups.map(g => [g.title, g.questions.length, g.lines]),
             html: mbBuildModuleHtml(m, {}).includes('About safety') };
  });
  expect(r.groups).toEqual([['', 1, 2], ['About safety', 2, 3], ['', 1, 2]]);
  expect(r.html).toBe(true);

  // remove a group
  await page.locator('#lg-reflection-section .lg-refl-more').nth(1).locator('[data-act="mbLgReflMoreRemove"]').click();
  await page.locator('.mb-dialog-ok').click();   // it has questions: asked first
  await expect(page.locator('#lg-reflection-section .lg-refl-more')).toHaveCount(1);
  expect(await page.evaluate(() => mbCurrentLOObject().lgReflectionMore.length)).toBe(1);
  expect(errors).toEqual([]);
});

test('added questions alone still make the Reflection page; Arabic, each language its own', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), lang: 'ar', contentLang: 'ar' });
  await guide(page);
  await tab(page, 'reflection');
  const host = page.locator('#lg-reflection-section');
  await expect(host.locator('.lg-refl-add')).toHaveText('➕ إضافة أسئلة أخرى');
  await host.locator('.lg-refl-add').click();
  const g = host.locator('.lg-refl-more').first();
  await expect(g.locator('input.mb-block-title')).toHaveAttribute('placeholder', 'عنوان فرعي لهذه الأسئلة (اختياري)…');
  await g.locator('textarea').fill('ما أصعب جزء في هذه الوحدة؟');
  expect(await page.evaluate(() => mbCurrentLOObject().lgReflectionMore[0].questions)).toEqual({ en: '', ar: 'ما أصعب جزء في هذه الوحدة؟', fr: '' });
  expect(await page.evaluate(() => mbLgReflectionFilled(mbCurrentLOObject()))).toBe(true);
  const t = await wordText(page);
  expect(t).toContain('ما أصعب جزء في هذه الوحدة؟');
  await page.setViewportSize({ width: 360, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});

// 3.76.0: «contributes to the assessment» on the Reflection heading's line;
// 📝 Paste text under each box of questions.
test('reflection: the contributes box beside the heading; Paste text under the questions, the first and an added group', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), lang: 'en', contentLang: 'en' });
  await guide(page);
  await tab(page, 'reflection');
  const host = page.locator('#lg-reflection-section');
  const head = host.locator('.lg-part').first().locator('.lg-part-head');
  await expect(head).toContainText('Reflection');
  await expect(head.locator('input[type="checkbox"]')).toHaveCount(1);
  const hb = await head.boundingBox(), cb = await head.locator('.lg-refl-contrib').boundingBox();
  expect(cb.x + cb.width).toBeGreaterThan(hb.x + hb.width - 4);               // at the far end of the line
  await head.locator('input[type="checkbox"]').check();
  expect(await page.evaluate(() => mbCurrentLOObject().lgReflection.contributes)).toBe('yes');

  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true,
    value: { readText: () => Promise.resolve('What was the hardest\npart, and why?\n- tools\n- safety') } }));
  await host.locator('.lg-part').first().locator('.btn-paste-text').click();
  await expect(host.locator('[data-lg-field="refl.questions"]')).toHaveValue('What was the hardest part, and why?\n- tools\n- safety');
  expect(await page.evaluate(() => mbCurrentLOObject().lgReflection.questions.en)).toBe('What was the hardest part, and why?\n- tools\n- safety');

  await host.locator('.lg-refl-add').click();
  await host.locator('.lg-refl-more').first().locator('.btn-paste-text').click();
  await expect(host.locator('.lg-refl-more textarea')).toHaveValue('What was the hardest part, and why?\n- tools\n- safety');
  expect(await page.evaluate(() => mbCurrentLOObject().lgReflectionMore[0].questions.en)).toContain('hardest part');
  expect(errors).toEqual([]);
});
