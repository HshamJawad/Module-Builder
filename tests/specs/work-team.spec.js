// 3.78.0: the Work Team card as a table — a header row (Name, Task, Work
// location in EN / FR / AR) and boxes that grow downwards with long text;
// kept after a reload and printed in Word.
const { test, expect } = require('@playwright/test');
const { openApp, tab } = require('../helpers');

const LONG = 'National Consultant for Curriculum Development and Training of Trainers, Technical and Vocational Education';

for (const [lang, heads] of [['en', ['Name', 'Task', 'Work Location']], ['fr', ['Nom', 'Tâche', 'Lieu de travail']], ['ar', ['الاسم', 'المهمة', 'مكان العمل']]]) {
  test(`work team headings in ${lang}`, async ({ page }) => {
    const errors = await openApp(page, { lang, contentLang: lang });
    await tab(page, 'intro');
    await expect(page.locator('#work-team-container .team-head')).toHaveText(heads);
    expect(errors).toEqual([]);
  });
}

test('a long task grows its box, stays on one line of data, is kept and printed', async ({ page }) => {
  const errors = await openApp(page, { lang: 'en', contentLang: 'en' });
  await tab(page, 'intro');
  const row = page.locator('#work-team-container .team-member-row:not(.team-head-row)').first();
  const task = row.locator('textarea[id^="team-task-"]');
  const h0 = (await task.boundingBox()).height;
  await row.locator('textarea[id^="team-name-"]').fill('Husham Jawad');
  await task.click();
  await page.keyboard.press('Enter');                                        // no line break
  await task.fill(LONG);
  await task.dispatchEvent('input');
  const h1 = (await task.boundingBox()).height;
  expect(h1).toBeGreaterThan(h0 * 1.5);
  expect(await task.evaluate(el => el.scrollHeight <= el.clientHeight + 2)).toBe(true);   // nothing hidden
  expect(await task.inputValue()).not.toContain('\n');
  expect(await page.evaluate(() => mbState.teamMembers[0].task.en)).toBe(LONG);   // written as typed

  await page.evaluate(() => mbLibrarySave({ force: true }));
  await page.reload();
  await page.waitForFunction(() => window.mbLib && mbLib.booted === true);
  await page.waitForTimeout(400);
  await tab(page, 'intro');
  const t2 = page.locator('#work-team-container textarea[id^="team-task-"]').first();
  await expect(t2).toHaveValue(LONG);
  expect((await t2.boundingBox()).height).toBeGreaterThan(h0 * 1.5);

  const xml = await page.evaluate(async () => {
    let got = null;
    window.mbExportSink = { take: (b) => { got = b; return Promise.resolve(); }, skip: () => {}, fail: (e) => { throw e; } };
    try { await exportToDocx(); } finally { window.mbExportSink = null; }
    return new TextDecoder().decode(fflate.unzipSync(new Uint8Array(await got.arrayBuffer()))['word/document.xml']);
  });
  expect(xml).toContain(LONG);
  expect(xml).toContain('Husham Jawad');
  await page.setViewportSize({ width: 360, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});
