// 3.81.14: DACUM Live Pro's CUR «Tools and resources» card (3.142+) —
// its one list joins the module's Tools & Resources, its recommended
// resources join the project's References; nothing written here is lost
// and a second transfer adds no duplicates.
const { test, expect } = require('@playwright/test');
const { fixture, openApp } = require('../helpers');

function withCur(extra) {
  const h = fixture('dacum-handoff.json');
  h.modules[0].curriculum = Object.assign({}, h.modules[0].curriculum || {}, extra);
  return h;
}

test('tools list and recommended resources reach Module Builder, once', async ({ page }) => {
  const h = withCur({ toolsText: '1- Multimeter\n2- Screwdriver set', resources: ['Learner guide: Core Work', 'Safety handbook'] });
  const errors = await openApp(page, { handoff: h });
  const read = () => page.evaluate(() => ({
    tools: mbState.modulesData.find(m => m.id === 'module_1').toolsText || '',
    refs: mbState.referencesData.map(r => r.value).filter(Boolean)
  }));
  let r = await read();
  expect(r.tools).toContain('Multimeter');
  expect(r.tools).toContain('Screwdriver set');
  expect(r.refs).toEqual(['Learner guide: Core Work', 'Safety handbook']);

  // A second transfer with one new item: only that one is added.
  h.modules[0].curriculum.toolsText += '\n3- Soldering iron';
  h.modules[0].curriculum.resources.push('Safety handbook');
  await page.evaluate(x => localStorage.setItem('dacum_modules_export', x), JSON.stringify(h));
  await page.reload();
  await page.waitForFunction(() => window.mbLib && window.mbLib.booted === true, null, { timeout: 30_000 });
  r = await read();
  expect(r.tools.match(/Multimeter/g).length).toBe(1);
  expect(r.tools).toContain('Soldering iron');
  expect(r.refs).toEqual(['Learner guide: Core Work', 'Safety handbook']);
  expect(errors).toEqual([]);
});
