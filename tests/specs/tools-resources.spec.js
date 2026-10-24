// 3.79.0: the Tools & Resources tab — one list per module, paste, insert from
// DACUM (task analysis + Additional Info), undo/redo, and its own page in the
// Word / PDF / HTML exports before the references.
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

function handoffWithTools() {
  const h = fixture('dacum-handoff.json');
  h.additionalInfoTools = ['Multimeter', 'Safety goggles'];
  return h;
}
const vals = (page) => page.evaluate(() => mbToolsList());

test('tools tab: add, edit, delete, clear', async ({ page }) => {
  const errors = await openApp(page, { handoff: handoffWithTools(), contentLang: 'en' });
  await tab(page, 'tools');
  await expect(page.locator('#tools-tab')).toHaveClass(/active/);
  await page.locator('[data-act="mbToolsAdd"]').click();
  await page.locator('#tools-list .tr-input').first().fill('Pliers');
  await page.locator('[data-act="mbToolsAdd"]').click();
  await page.locator('#tools-list .tr-input').nth(1).fill('Cable ties');
  expect(await vals(page)).toEqual(['Pliers', 'Cable ties']);
  await expect(page.locator('#tools-list .tr-num').nth(1)).toHaveText('2-');
  await page.locator('#tools-list [data-act="mbToolsDelete"]').first().click();
  expect(await vals(page)).toEqual(['Cable ties']);
  await page.locator('[data-act="mbToolsClear"]').click();
  await page.locator('.mb-dialog button.danger, .mb-dialog .mb-dlg-ok').first().click();
  await expect.poll(() => vals(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test('tools tab: paste box cleans lines, skips duplicates', async ({ page }) => {
  const errors = await openApp(page, { handoff: handoffWithTools(), contentLang: 'en' });
  await tab(page, 'tools');
  await page.evaluate(() => mbToolsPasteBox());
  await page.locator('#tr-paste-ta').fill('• Hammer\n2- 2-inch pipe\n3) Tape measure\n\n  Hammer  \n- Saw');
  await page.locator('[data-act="mbToolsPasteApply"]').click();
  expect(await vals(page)).toEqual(['Hammer', '2-inch pipe', 'Tape measure', 'Saw']);
  expect(errors).toEqual([]);
});

test('tools tab: insert from DACUM offers task analysis and Additional Info tools', async ({ page }) => {
  const errors = await openApp(page, { handoff: handoffWithTools(), contentLang: 'en' });
  await tab(page, 'tools');
  await page.locator('[data-act="mbToolsOpenDacum"]').click();
  const pick = page.locator('#tr-dacum-pick');
  await expect(pick).toBeVisible();
  const texts = await pick.locator('input[type=checkbox]').evaluateAll(l => l.map(x => x.dataset.text));
  expect(texts).toEqual(expect.arrayContaining(['Multimeter', 'Safety goggles']));
  const own = await page.evaluate(() => mbToolsDacumGroups(mbState.modulesData.find(m => m.id === mbState.currentModuleId)).flatMap(g => g.items));
  expect(own.length).toBeGreaterThanOrEqual(2);
  await page.locator('[data-act="mbToolsPickAll"]').click();
  await page.locator('[data-act="mbToolsApplyPick"]').click();
  const got = await vals(page);
  expect(got).toEqual(expect.arrayContaining(['Multimeter', 'Safety goggles']));
  // reopening shows them as already on the list
  await page.locator('[data-act="mbToolsOpenDacum"]').click();
  await expect(page.locator('#tr-dacum-pick .mb-pick-row.is-used').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('tools tab: undo and redo through the toolbar', async ({ page }) => {
  const errors = await openApp(page, { handoff: handoffWithTools(), contentLang: 'en' });
  await tab(page, 'tools');
  await page.evaluate(() => mbToolsPasteBox());
  await page.locator('#tr-paste-ta').fill('Hammer\nSaw');
  await page.locator('[data-act="mbToolsPasteApply"]').click();
  await page.waitForTimeout(100);
  expect(await vals(page)).toEqual(['Hammer', 'Saw']);
  await page.evaluate(() => mbUndo());
  await expect.poll(() => vals(page)).toEqual([]);
  await page.evaluate(() => mbRedo());
  await expect.poll(() => vals(page)).toEqual(['Hammer', 'Saw']);
  expect(errors).toEqual([]);
});

test('tools list is saved with the module and exported on its own page before the references', async ({ page }) => {
  const errors = await openApp(page, { handoff: handoffWithTools(), contentLang: 'en' });
  await tab(page, 'tools');
  await page.evaluate(() => mbToolsPasteBox());
  await page.locator('#tr-paste-ta').fill('Hammer\nSaw');
  await page.locator('[data-act="mbToolsPasteApply"]').click();
  await tab(page, 'references');
  await page.locator('#references-list .ref-input').first().fill('Smith, J. (2020). Electrical Basics.');
  await page.waitForTimeout(1000);
  await page.reload();
  await page.waitForFunction(() => window.mbLib && window.mbLib.booted === true);
  await page.waitForTimeout(500);
  expect(await vals(page)).toEqual(['Hammer', 'Saw']);

  const text = await docxText(page);
  const t = text.indexOf('\nTools, Equipment and Materials Required');
  const r = text.lastIndexOf('\nReferences');
  expect(t).toBeGreaterThan(-1);
  expect(r).toBeGreaterThan(t);
  expect(text.slice(t, r)).toContain('1- Hammer');
  expect(text.slice(t, r)).toContain('2- Saw');

  const m = await page.evaluate(() => ({ en: mbBuildModuleModel('en').toolsResources, ar: mbBuildModuleModel('ar').toolsResources.title }));
  expect(m.en.items).toEqual(['Hammer', 'Saw']);
  expect(m.ar).toBe('الأدوات والمعدات والمواد المطلوبة');
  const html = await page.evaluate(() => mbBuildModuleHtml(mbBuildModuleModel('en'), {}));
  expect(html).toContain('id="tools"');
  expect(html.indexOf('id="tools"')).toBeLessThan(html.indexOf('id="references"'));
  expect(html).toContain('1- Hammer');
  expect(errors).toEqual([]);
});

test('an empty tools list prints no page', async ({ page }) => {
  const errors = await openApp(page, { handoff: handoffWithTools(), contentLang: 'en' });
  const text = await docxText(page);
  expect(text).not.toContain('Tools, Equipment and Materials Required');
  expect(await page.evaluate(() => mbBuildModuleModel('en').toolsResources.items)).toEqual([]);
  expect(errors).toEqual([]);
});
