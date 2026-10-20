// 3.56.1: (1) switching the interface language, with no content language
// chosen, no longer writes the text on screen into the NEW language's side
// (the English «After studying this information sheet…» appeared in the
// Arabic side and stayed there); a lead already written that way is
// repaired. (2) The PDF covers fill the A4 page, as in Word.
const { test, expect } = require('@playwright/test');
const { openApp, fixture, tab } = require('../helpers');

test('interface EN → AR: each side keeps its own text; the poisoned lead is repaired', async ({ page }) => {
  const errors = await openApp(page, { lang: 'en', handoff: fixture('dacum-handoff.json') });
  await tab(page, 'info');
  await page.evaluate(() => { document.getElementById('info-title').value = 'English title'; });
  const lead = () => page.locator('#info-objective-lead');
  await expect(lead()).toHaveValue('After studying this information sheet, you will be able to:');

  await page.evaluate(() => document.querySelector('.mb-lang-opt[data-lang="ar"]').click());
  await page.waitForTimeout(600);
  await expect(lead()).toHaveValue('بعد دراستك ورقة المعلومات ستصبح قادرًا على:');
  await expect(page.locator('#info-title')).toHaveValue('');           // the Arabic side is empty
  const stored = await page.evaluate(() => {
    const lo = mbState.learningOutcomesData.find(l => l.id === mbState.currentLOId);
    const s = lo.infoSheets[0];
    return { title: s.title, lead: s.objectiveLead };
  });
  expect(stored.title.en).toBe('English title');
  expect(stored.title.ar || '').toBe('');
  expect(stored.lead.ar || '').not.toContain('After studying');

  // Back to English: the English text is still there.
  await page.evaluate(() => document.querySelector('.mb-lang-opt[data-lang="en"]').click());
  await page.waitForTimeout(600);
  await expect(page.locator('#info-title')).toHaveValue('English title');

  // A sheet saved by the old build, with the English line in the Arabic side.
  const healed = await page.evaluate(() => {
    const s = { objectiveLead: { en: 'After studying this information sheet, you will be able to:', ar: 'After studying this information sheet, you will be able to:', fr: '' } };
    mbSetSetting(MB_KEYS.contentLang, 'ar');
    mbSeedObjectiveLead(s, 'mbInfoObjectiveLead');
    return s.objectiveLead.ar;
  });
  expect(healed).toBe('بعد دراستك ورقة المعلومات ستصبح قادرًا على:');
  expect(errors).toEqual([]);
});

test('PDF: front and back covers fill the A4 page', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
  const placed = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 300; c.height = 500;
    c.getContext('2d').fillRect(0, 0, 300, 500);
    const src = c.toDataURL('image/png');
    const m = mbBuildModuleModel('en');
    m.cover.frontImage = src; m.cover.backImage = src;
    const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
    const calls = [];
    const orig = pdf.addImage.bind(pdf);
    pdf.addImage = function (d, f, x, y, w, h) { if (d === src) calls.push([x, y, Math.round(w), Math.round(h)]); return orig.apply(pdf, arguments); };
    _pdfBuild(pdf, m, 'en');
    return calls;
  });
  expect(placed).toEqual([[0, 0, 210, 297], [0, 0, 210, 297]]);
  expect(errors).toEqual([]);
});
