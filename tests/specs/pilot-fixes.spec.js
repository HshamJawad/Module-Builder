// 3.35.0: what the pilot run (a real DACUM project, 16 modules) showed.
//  - Building every sheet at once kept the title of the sheet that was
//    on screen, instead of overwriting it with the empty field.
//  - Tools, safety rules and common errors are one listed section on an
//    information sheet, not a heading with no text per item.
//  - Word prints a section that has a heading and no text yet, keeps the
//    lines of a text, and does not repeat "LO1:" after "Learning Outcome 1:".
const { test, expect } = require('@playwright/test');
const { openApp, fixture, tab, openModule } = require('../helpers');

async function buildAll(page, kind) {
  await tab(page, kind);
  await page.evaluate(k => { mbSpViewFilter(k, 'all'); mbSpApproveMany(k, 'shown'); mbSpBuild(k, 'all'); }, kind);
}

test('building everything: every sheet keeps its title; lists are one section each', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
  await buildAll(page, 'info');
  await buildAll(page, 'activity');
  const m = await openModule(page, m => m.learningOutcomes.map(l => ({
    info: (l.infoSheets || []).map(s => ({ t: s.title.en, secs: s.contentSections.map(c => ({ h: c.heading.en, x: c.text.en })) })),
    act: (l.activitySheets || []).map(s => s.title.en) })));
  const info = m.flatMap(l => l.info);
  expect(info.length).toBeGreaterThan(0);
  for (const s of info) expect(s.t).not.toBe('');
  for (const t of m.flatMap(l => l.act)) expect(t).not.toBe('');
  const secs = info.flatMap(s => s.secs);
  expect(secs.find(c => c.h === 'Screwdriver set')).toBeUndefined();
  expect(secs.find(c => c.h === 'Tools, equipment and materials').x).toContain('Screwdriver set');
  expect(secs.find(c => c.h === 'Safety and health').x).toContain('Disconnect power');
  expect(secs.find(c => c.h === 'Common errors and how to avoid them').x).toContain('Skipping the power check');
  expect(secs.find(c => c.h === 'Component layout')).toMatchObject({ x: '' });   // a topic to write
  expect(errors).toEqual([]);
});

test('Word: topic headings printed, lines kept, no "LO1:" after "Learning Outcome 1:"', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
  await buildAll(page, 'info');
  const xml = await page.evaluate(async () => {
    let got = null;
    window.mbExportSink = { take: (b) => { got = b; return Promise.resolve(); }, skip: () => {}, fail: (e) => { throw e; } };
    try { await exportToDocx(); } finally { window.mbExportSink = null; }
    const files = fflate.unzipSync(new Uint8Array(await got.arrayBuffer()));
    return new TextDecoder().decode(files['word/document.xml']);
  });
  const text = xml.replace(/<w:p[ >]/g, '\n$&').replace(/<[^>]+>/g, '');
  expect(text).toContain('Component layout');
  expect(text).not.toMatch(/LO\d:/);
  expect(text).toContain('Learning Outcome 1: Perform outcome 0');
  expect(text).toMatch(/\nCue: Visible wear in duty_1_1\n/);                  // its own paragraph
  expect(errors).toEqual([]);
});

test('assessment form: each task criterion names the job sheet where it is practised', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
  await buildAll(page, 'activity');
  await buildAll(page, 'assessment');
  const rows = await page.evaluate(() => Object.values(mbState.assessmentFormsData).flatMap(f => f.rows)
    .map(r => ({ c: r.criteria && r.criteria.en, a: r.activities })));
  const safety = rows.find(r => r.c === 'Mandatory: Disconnect power');
  expect(safety.a).toMatch(/^\d+-\d+$/);
  const nums = await openModule(page, m => m.learningOutcomes.flatMap(l => (l.activitySheets || []).map(s => s.sheetNumber)));
  expect(nums).toContain(safety.a);
  expect(errors).toEqual([]);
});
