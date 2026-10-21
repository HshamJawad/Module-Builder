// 3.66.0: after a DACUM Live Pro handoff the status line says what
// arrived — one module by its code, or how many with the first three
// named — whether it was added or updated, and how many modules the
// library holds, so one module sent from its DACUM card is not taken for
// the whole library an earlier "send all" left.
const { test, expect } = require('@playwright/test');
const { fixture, openApp } = require('../helpers');

/** A handoff of `n` modules built from the fixture's one module. */
function handoffOf(base, nums) {
  const h = JSON.parse(JSON.stringify(base));
  const m0 = h.modules[0];
  h.modules = nums.map(i => ({ ...JSON.parse(JSON.stringify(m0)), moduleId: `module_${i}`, moduleCode: `CMT ${i}`, moduleNumber: `M${i}`, moduleTitle: `Module ${i}` }));
  return h;
}

async function sendAgain(page, h) {
  await page.evaluate(x => localStorage.setItem('dacum_modules_export', x), JSON.stringify(h));
  await page.reload();
  await page.waitForFunction(() => window.mbLib && window.mbLib.booted === true, null, { timeout: 30_000 });
}

const status = page => page.locator('#status');

for (const lang of ['ar', 'en']) {
  test(`DACUM receipt message: all, then one updated, then one added (${lang})`, async ({ page }) => {
    const base = fixture(lang === 'ar' ? 'dacum-handoff-ar.json' : 'dacum-handoff.json');
    const errors = await openApp(page, { handoff: handoffOf(base, [1, 2, 3, 4]), lang });
    const name = await page.evaluate(() => mbLib.project.name);
    await expect(status(page)).toHaveText(lang === 'ar'
      ? `استُلمت 4 وحدة من DACUM: CMT 1، CMT 2، CMT 3، … (أُضيفت 4، حُدِّثت 0). مشروع جديد «${name}» يضم 4 وحدة.`
      : `4 modules received from DACUM: CMT 1, CMT 2, CMT 3, … (4 added, 0 updated). New project «${name}» with 4 module(s).`);

    // One module from its DACUM card: named, updated, the library still 4.
    await sendAgain(page, { ...handoffOf(base, [2]), scope: 'module' });
    await expect(status(page)).toHaveText(lang === 'ar'
      ? `استُلمت وحدة واحدة من DACUM: CMT 2 (حُدِّثت). المكتبة «${name}» تضم 4 وحدة.`
      : `1 module received from DACUM: CMT 2 (updated). The library «${name}» holds 4 module(s).`);
    expect(await page.evaluate(() => mbState.modulesData.length)).toBe(4);
    expect(await page.evaluate(() => mbState.currentModuleId)).toBe('module_2');

    // A module the library does not have yet: added, the library 5.
    await sendAgain(page, { ...handoffOf(base, [7]), scope: 'module' });
    await expect(status(page)).toHaveText(lang === 'ar'
      ? `استُلمت وحدة واحدة من DACUM: CMT 7 (أُضيفت). المكتبة «${name}» تضم 5 وحدة.`
      : `1 module received from DACUM: CMT 7 (added). The library «${name}» holds 5 module(s).`);
    expect(errors).toEqual([]);
  });
}
