// 3.33.0: "Suggested content" at the top of the Information, Activity
// and Assessment tabs — one source (the content map), approve / edit /
// move / also send / remove, build into sheets shown below, undo and
// redo, coverage view, distribution settings, old projects, Arabic.
const { test, expect } = require('@playwright/test');
const { openApp, fixture, tab, openModule } = require('../helpers');

const HANDOFF = fixture('dacum-handoff.json');
const panel = (page, kind) => page.locator(`#mb-sp-${kind}`);
const row = (page, kind, text) => panel(page, kind).locator('.mb-sp-row', { hasText: text });
const rowsData = (page) => page.evaluate(() => {
  const m = mbState.modulesData.find(x => x.id === mbState.currentModuleId);
  return mbContentMapRows(m).map(r => ({ key: r.key, field: r.field, text: r.text, lo: r.lo, dests: r.dests, ok: r.ok, built: r.built, edited: r.edited }));
});

async function reopen(page) {
  await page.reload();
  await page.waitForFunction(() => window.mbLib && window.mbLib.booted === true);
  await page.waitForTimeout(500);
}

test('everything DACUM sends arrives: basic skills, decisions table, category, entry requirements', async ({ page }) => {
  const errors = await openApp(page, { handoff: HANDOFF });
  const m = await openModule(page);
  const ta = m.taskAnalysisSource.taskAnalysis.duty_1_1;
  expect(ta.basicReading).toEqual(['Read the job card for duty_1_1']);
  expect(ta.decisionTable[0].cue).toBe('Visible wear in duty_1_1');
  expect(m.category).toEqual({ id: 'core', label: 'Core' });
  expect(m.dacumProgramme.entryQualifications).toEqual(['Grade 9']);
  expect(m.curriculum.entrySkills).toEqual(['Read simple texts']);
  // the module selector names the category
  await expect(page.locator('#info-module-selector option:checked')).toContainText('Core');
  // the cover's entry requirements: entry skills and entry qualifications
  const entry = await page.evaluate(() => (mbState.coverRows.find(r => r.seedKey === 'cvEntryReq' || r.field === 'cvEntryReq') || {}).value);
  expect(entry.en).toContain('Read simple texts');
  expect(entry.en).toContain('Grade 9');

  const rows = await rowsData(page);
  const by = f => rows.filter(r => r.field === f);
  expect(by('basicReading')[0].dests).toEqual(['info']);
  expect(by('basicMath')[0].dests).toEqual(['info', 'activity']);
  // 3.36.0: the assessment form takes criteria only
  expect(by('decisionsCriticalPoints')[0].dests).toEqual(['info', 'activity']);
  expect(by('safetyOSH')[0].dests).toEqual(['info', 'activity']);
  expect(by('performanceSteps')[0].dests).toEqual(['activity']);
  expect(by('requiredKnowledge')[0].dests).toEqual(['info']);
  expect(by('conditionsWorkEnvironment')[0].dests).toEqual(['activity']);
  expect(rows.filter(r => r.key.startsWith('__lopc__')).length).toBe(8);   // the outcomes' criteria
  expect(errors).toEqual([]);
});

test('panels: only empty fields are absent, each tab lists its own items, counters on the tabs', async ({ page }) => {
  const errors = await openApp(page, { handoff: HANDOFF });
  await tab(page, 'info');
  await expect(panel(page, 'info')).toContainText('Suggested content');
  await expect(row(page, 'info', 'Component layout')).toBeVisible();           // knowledge
  await expect(row(page, 'info', 'Repair or replace in duty_1_1')).toContainText('Cue: Visible wear');
  await expect(row(page, 'info', 'Prepare the workspace')).toHaveCount(0);      // steps → activity only
  await tab(page, 'activity');
  await expect(row(page, 'activity', 'Prepare the workspace')).toBeVisible();
  await expect(row(page, 'activity', 'Component layout')).toHaveCount(0);
  await tab(page, 'assessment');
  await expect(row(page, 'assessment', 'Work is checked against specifications 1').first()).toBeVisible();
  const badge = await page.locator('#mb-sidenav .tab[data-args=\'["info"]\']').getAttribute('data-sp-count');
  expect(Number(badge)).toBe(14);
  expect(errors).toEqual([]);
});

test('approve and build: one sheet per task, shown below, reusing the empty sheet; state is kept', async ({ page }) => {
  const errors = await openApp(page, { handoff: HANDOFF });
  await tab(page, 'info');
  await panel(page, 'info').locator('[data-act="mbSpApproveMany"]').click();
  await expect(panel(page, 'info').locator('summary')).toContainText('14 approved');
  await panel(page, 'info').locator('[data-act="mbSpBuild"][data-args*="all"]').click();
  await expect(panel(page, 'info').locator('summary')).toContainText('14 built');
  const lo1 = await openModule(page, m => m.learningOutcomes[0].infoSheets.map(s => ({
    t: s.title.en, secs: s.contentSections.map(c => [c.heading.en, c.text.en]) })));
  expect(lo1.map(s => s.t)).toEqual(['Perform task A1', 'Perform task B3']);   // the empty first sheet was used
  const a1 = Object.fromEntries(lo1[0].secs);
  expect(a1['Supporting skills']).toBe('Reading: Read the job card for duty_1_1\nMathematics: Calculate the time needed for duty_1_1');
  expect(a1['Repair or replace in duty_1_1']).toContain('If decided wrongly: Repeat failure in duty_1_1');
  expect(a1['Repair or replace in duty_1_1']).toContain('How an expert handles it: Checks the history first');
  // the sheet built last is open under the panel
  await expect(page.locator('#info-tab input[id*="title"]').first()).toHaveValue('Perform task B3');
  await expect(page.locator('#mb-sidenav .tab[data-args=\'["info"]\']')).not.toHaveAttribute('data-sp-count', /.+/);

  // activity: safety and conditions before the work, checkpoint and calculation
  await tab(page, 'activity');
  await row(page, 'activity', 'Prepare the workspace').locator('.mb-sp-check').check();
  await row(page, 'activity', 'Disconnect power').locator('.mb-sp-check').check();
  await row(page, 'activity', 'Repair or replace in duty_1_1').locator('.mb-sp-check').check();
  await row(page, 'activity', 'Screwdriver set').locator('.mb-sp-check').check();
  await panel(page, 'activity').locator('[data-act="mbSpBuild"][data-args*="selected"]').click();
  const act = await openModule(page, m => m.learningOutcomes[0].activitySheets[0]);
  expect(act.title.en).toBe('Perform task A1');
  expect(act.steps.map(s => s.text.en)).toEqual(['Safety: Disconnect power', 'Prepare the workspace',
    'Check: Repair or replace in duty_1_1 — Cue: Visible wear in duty_1_1']);
  expect(act.resources.map(r => r.name.en)).toEqual(['Screwdriver set']);

  // assessment: the outcome's criteria first, empty rows filled first
  await tab(page, 'assessment');
  await panel(page, 'assessment').locator('[data-act="mbSpApproveMany"]').click();
  await panel(page, 'assessment').locator('[data-act="mbSpBuild"][data-args*="all"]').click();
  // 3.34.0: each criterion is a { en, ar, fr } value (English only here)
  const form = await page.evaluate(() => mbState.assessmentFormsData[mbState.currentLOId].rows
    .map(r => typeof r.criteria === 'string' ? r.criteria : r.criteria.en));
  expect(form.slice(0, 3)).toEqual(['Work is checked against specifications 1', 'Work is checked against specifications 4',
    'Work is checked against specifications 3']);
  expect(form).toContain('Unit is inspected against the checklist');      // the task's own criterion
  expect(form).not.toContain('Critical: Repair or replace in duty_1_1');   // 3.36.0: criteria only
  expect(form).not.toContain('Mandatory: Disconnect power');
  expect(form.filter(t => t === '').length).toBe(0);

  // saved with the module: after a reload the items are still built
  await page.waitForTimeout(800);
  await reopen(page);
  await tab(page, 'info');
  await expect(panel(page, 'info').locator('summary')).toContainText('14 built');
  await tab(page, 'activity');
  await expect(row(page, 'activity', 'Prepare the workspace')).toContainText('Built');
  await expect(row(page, 'activity', 'Inspect the unit')).toContainText('Suggested');
  expect(errors).toEqual([]);
});

test('edit, move, also send, remove, outcome — one row, every tab follows', async ({ page }) => {
  const errors = await openApp(page, { handoff: HANDOFF });
  await tab(page, 'info');
  // edit
  await row(page, 'info', 'Component layout').locator('[data-act="mbSpEdit"]').click();
  await panel(page, 'info').locator('textarea').fill('Layout of the main components');
  await panel(page, 'info').locator('[data-act="mbSpSaveEdit"]').click();
  await expect(row(page, 'info', 'Layout of the main components')).toBeVisible();
  // move knowledge to activity
  await row(page, 'info', 'Layout of the main components').locator('select.mb-sp-act').selectOption('move:activity');
  await expect(row(page, 'info', 'Layout of the main components')).toHaveCount(0);
  // also send a tool to the assessment
  await row(page, 'info', 'Screwdriver set').locator('select.mb-sp-act').selectOption('also:assessment');
  // remove a common error from the information sheet
  await row(page, 'info', 'Skipping the power check').locator('[data-act="mbSpRemove"]').click();
  let rows = await rowsData(page);
  const r = t => rows.find(x => x.text === t);
  expect(r('Component layout').dests).toEqual(['activity']);
  expect(r('Component layout').edited).toBe('Layout of the main components');
  expect(r('Screwdriver set').dests).toEqual(['info', 'activity', 'assessment']);
  expect(r('Skipping the power check').dests).toEqual(['activity']);
  await tab(page, 'activity');
  await expect(row(page, 'activity', 'Layout of the main components')).toBeVisible();
  await tab(page, 'assessment');
  await expect(row(page, 'assessment', 'Screwdriver set')).toBeVisible();

  // an item without an outcome is not built until it has one
  await page.evaluate(() => mbSpSetLo('assessment', mbContentMapRows(mbState.modulesData[0]).find(r => r.text === 'Screwdriver set').key, ''));
  await panel(page, 'assessment').locator('.mb-sp-filter').selectOption('all');
  await row(page, 'assessment', 'Screwdriver set').locator('.mb-sp-check').check();
  await panel(page, 'assessment').locator('[data-act="mbSpBuild"][data-args*="selected"]').click();
  await expect(page.locator('#status')).toContainText(/no learning outcome/i);
  await row(page, 'assessment', 'Screwdriver set').locator('select.mb-sp-lo').selectOption({ index: 1 });
  rows = await rowsData(page);
  expect(r('Screwdriver set').lo).toBe('lo-1');
  expect(errors).toEqual([]);
});

test('undo and redo cover approving, editing and building', async ({ page }) => {
  const errors = await openApp(page, { handoff: HANDOFF });
  await tab(page, 'info');
  await row(page, 'info', 'Component layout').locator('[data-act="mbSpApprove"]').click();
  await expect(row(page, 'info', 'Component layout')).toContainText('Approved');
  await panel(page, 'info').locator('[data-act="mbSpBuild"][data-args*="all"]').click();
  await expect(row(page, 'info', 'Component layout')).toContainText('Built');
  await page.click('#mb-undo-btn');
  await expect(row(page, 'info', 'Component layout')).toContainText('Approved');
  expect((await openModule(page, m => m.learningOutcomes[0].infoSheets[0].contentSections.length))).toBe(0);
  await page.click('#mb-undo-btn');
  await expect(row(page, 'info', 'Component layout')).toContainText('Suggested');
  await page.click('#mb-redo-btn');
  await expect(row(page, 'info', 'Component layout')).toContainText('Approved');
  await page.click('#mb-redo-btn');
  await expect(row(page, 'info', 'Component layout')).toContainText('Built');
  expect(errors).toEqual([]);
});

test('add to the open sheet', async ({ page }) => {
  const errors = await openApp(page, { handoff: HANDOFF });
  await tab(page, 'info');
  await row(page, 'info', 'Board types').locator('[data-act="mbSpAddToOpen"]').click();
  const s = await openModule(page, m => m.learningOutcomes[0].infoSheets.map(x => x.contentSections.map(c => c.heading.en)));
  expect(s).toEqual([['Board types']]);
  await expect(row(page, 'info', 'Board types')).toContainText('Built');
  expect(errors).toEqual([]);
});

test('coverage view: counts, a mark opens the item in its tab; the old mapping tab is a workspace', async ({ page }) => {
  const errors = await openApp(page, { handoff: HANDOFF });
  await page.click('#mb-cov-nav');
  const ov = page.locator('#mb-cov-overlay');
  await expect(ov).toContainText('Coverage');
  await expect(ov.locator('.mb-cov-sum')).toContainText('0% built');
  await ov.locator('.mb-cov-row', { hasText: 'Board types' }).locator('.mb-cov-cell.is-new').click();
  await expect(ov).toHaveCount(0);
  await expect(page.locator('#info-tab')).toHaveClass(/active/);
  await expect(row(page, 'info', 'Board types')).toHaveClass(/is-flash/);
  // the workspace is still there
  await page.click('#mb-cov-nav');
  await page.locator('[data-act="mbCovWorkspace"]').click();
  await expect(page.locator('#mapping-tab')).toHaveClass(/active/);
  await expect(page.locator('#mb-ai-analyze-btn')).toBeVisible();
  expect(errors).toEqual([]);
});

test('distribution settings change the defaults; approved items keep their sheets; saved with the project', async ({ page }) => {
  const errors = await openApp(page, { handoff: HANDOFF });
  await tab(page, 'info');
  await row(page, 'info', 'Component layout').locator('[data-act="mbSpApprove"]').click();
  await panel(page, 'info').locator('[data-act="mbCovDefaults"]').click();
  const dlg = page.locator('#mb-def-overlay');
  await dlg.locator('input[data-def-group="requiredKnowledge"][data-def-kind="info"]').uncheck();
  await dlg.locator('input[data-def-group="requiredKnowledge"][data-def-kind="activity"]').check();
  await dlg.locator('[data-act="mbCovDefaultsSave"]').click();
  let rows = await rowsData(page);
  expect(rows.find(r => r.text === 'Component layout').dests).toEqual(['info']);   // approved: kept
  expect(rows.find(r => r.text === 'Board types').dests).toEqual(['activity']);    // follows the new default
  await page.waitForTimeout(800);
  await reopen(page);
  expect(await page.evaluate(() => mbState.cmDefaults)).toEqual({ requiredKnowledge: ['activity'] });
  // back to the defaults
  await tab(page, 'info');
  await panel(page, 'info').locator('[data-act="mbCovDefaults"]').click();
  await page.locator('#mb-def-overlay [data-act="mbCovDefaultsReset"]').click();
  await page.locator('#mb-def-overlay [data-act="mbCovDefaultsSave"]').click();
  rows = await rowsData(page);
  expect(rows.find(r => r.text === 'Board types').dests).toEqual(['info']);
  expect(errors).toEqual([]);
});

test('an older map (one destination per item) still opens as it was', async ({ page }) => {
  const errors = await openApp(page, { handoff: HANDOFF });
  await page.evaluate(() => {
    const m = mbState.modulesData.find(x => x.id === mbState.currentModuleId);
    const r = mbContentMapRows(m).find(x => x.text === 'Component layout');
    m.contentMap = { v: 1, rows: { [r.key]: { t: r.text, dest: 'activity' } } };
    const s = mbContentMapRows(m).find(x => x.text === 'Use a screwdriver');
    m.contentMap.rows[s.key] = { t: s.text, dest: 'none' };
    mbSpRefresh();
  });
  const rows = await rowsData(page);
  expect(rows.find(r => r.text === 'Component layout').dests).toEqual(['activity']);
  expect(rows.find(r => r.text === 'Use a screwdriver').dests).toEqual([]);
  expect(errors).toEqual([]);
});

test('Arabic, 360 px: panel and coverage translated, right to left, no horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  const errors = await openApp(page, { handoff: HANDOFF, lang: 'ar' });
  await tab(page, 'info');
  await expect(panel(page, 'info')).toContainText('المحتوى المقترح');
  await expect(panel(page, 'info')).toContainText('بانتظار المصادقة');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
  expect(await fits()).toBe(true);
  await row(page, 'info', 'Component layout').locator('[data-act="mbSpApprove"]').click();
  await expect(row(page, 'info', 'Component layout')).toContainText('مصادق عليها');
  await page.evaluate(() => mbCovOpen());
  await expect(page.locator('#mb-cov-overlay')).toContainText('التغطية');
  const box = await page.locator('.mb-cov-box').boundingBox();
  expect(box.width).toBeLessThanOrEqual(360);
  expect(await fits()).toBe(true);
  expect(errors).toEqual([]);
});
