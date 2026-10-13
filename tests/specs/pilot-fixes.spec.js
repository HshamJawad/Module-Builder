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

test('assessment form: the outcome\'s own criteria, each naming the job sheets of the outcome', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
  await buildAll(page, 'activity');
  await buildAll(page, 'assessment');
  const out = await page.evaluate(() => mbState.learningOutcomesData.map(lo => ({
    pcs: (lo.performanceCriteria || []).map(_mbPcText),
    acts: (lo.activitySheets || []).filter(_mbActivitySheetHasContent).map(s => s.sheetNumber),
    rows: ((mbState.assessmentFormsData[lo.id] || {}).rows || []).map(r => ({ c: r.criteria && (r.criteria.en || r.criteria), a: r.activities })) })));
  for (const lo of out) {
    expect(lo.rows.map(r => r.c)).toEqual(lo.pcs);                       // 3.37.0: nothing else
    if (lo.acts.length) for (const r of lo.rows) expect(r.a).toBe(lo.acts.join(', '));
  }
  expect(out.some(lo => lo.acts.length && lo.rows.length)).toBe(true);
  expect(errors).toEqual([]);
});

// 3.37.0: a module approved with the old defaults: its items follow the
// new ones, and the rows the tool wrote for them in the form go — not
// a row the user worked on, nor one the user sent there.
test('older module: items approved for the form under the old defaults leave it', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
  await buildAll(page, 'activity');
  const res = await page.evaluate(() => {
    const m = mbState.modulesData.find(x => x.id === mbState.currentModuleId);
    const rows = mbContentMapRows(m);
    const safety = rows.find(r => r.field === 'safetyOSH');
    const crit = rows.find(r => r.field === 'performanceCriteria' && r.taskId === 'duty_1_1');
    const beh = rows.find(r => r.field === 'workerBehaviours');
    // as 3.35.0 saved them
    m.contentMap.v = 2;
    m.contentMap.rows[safety.key] = { t: safety.text, d: ['info', 'activity', 'assessment'], ok: ['info', 'activity', 'assessment'] };
    m.contentMap.rows[crit.key] = { t: crit.text, d: ['assessment', 'activity'], ok: ['assessment', 'activity'] };
    m.contentMap.rows[beh.key] = { t: beh.text, d: ['assessment'], ok: ['assessment'] };   // the user's own choice
    const f = _spEnsureForm(safety.lo);
    f.rows = [{ criteria: { en: 'Mandatory: ' + safety.text }, activities: '1-1', outcomes: '', verification: '', date: '' },
              { criteria: { en: crit.text }, activities: '1-1', outcomes: 'Observation', verification: '', date: '' },
              { criteria: { en: 'Observed: ' + beh.text }, activities: '', outcomes: '', verification: '', date: '' }];
    const after = mbContentMapRows(m);
    return { v: m.contentMap.v, form: f.rows.map(r => r.criteria.en),
      dests: [safety, crit, beh].map(x => after.find(r => r.key === x.key).dests) };
  });
  expect(res.v).toBe(3);
  expect(res.dests).toEqual([['info', 'activity'], ['activity'], ['assessment']]);
  expect(res.form).toEqual([expect.stringContaining('inspected'), expect.stringMatching(/^Observed: /)]);
  expect(errors).toEqual([]);
});

// 3.36.0: outcomes whose criteria were written for a whole competency
// all trace to the same tasks. Each task goes to the outcome it matches
// best in words; one that matches none is left for the user to choose.
test('tasks shared by several outcomes are suggested by their words', async ({ page }) => {
  const errors = await openApp(page);
  const out = await page.evaluate(() => {
    const ids = ['t1', 't2', 't3', 't4'];
    const pc = (id, text) => ({ id, text, sourceTaskIds: ids });
    const m = { id: 'x', learningOutcomes: [
      { id: 'a', statement: 'Create text documents using MS Word or similar', performanceCriteria: [pc('1', 'Text document is created using Microsoft Office or similar')] },
      { id: 'b', statement: 'Create presentations using PowerPoint', performanceCriteria: [pc('2', 'Presentation is created using Microsoft PowerPoint')] },
      { id: 'c', statement: 'Use the internet and email to exchange information', performanceCriteria: [pc('3', 'Emails are sent and received')] }],
      taskAnalysisSource: { sourceTaskIds: ids, taskAnalysis: { t4: { performanceSteps: ['Open PowerPoint and add slides'] } },
        sourceTasks: [{ id: 't1', text: 'Use Microsoft Office to write documents' }, { id: 't2', text: 'Browse the internet and communicate by email' },
          { id: 't3', text: 'Work in a team' }, { id: 't4', text: 'Prepare a short talk' }] } };
    return _cmOwnerByTask(m, ids);
  });
  expect(out).toEqual({ t1: 'a', t2: 'c', t3: '', t4: 'b' });
  expect(errors).toEqual([]);
});
