// 3.80.7: Learner guide — the default distribution covers its main sections only.
const { test, expect } = require('@playwright/test');
const { openApp } = require('../helpers');

test('Learner guide: Knowledge / Activity / Assessment by default, the rest optional; standard unchanged', async ({ page }) => {
  const errors = await openApp(page, { contentLang: 'en' });
  const std = await page.evaluate(() => ['safetyOSH', 'toolsEquipmentMaterials', 'workerBehaviours', 'requiredKnowledge'].map(g => mbCmFieldKinds(g)));
  expect(std).toEqual([['info', 'activity'], ['info', 'activity'], ['activity'], ['info']]);
  await page.evaluate(() => { const s = wsReadSettings(); s.templateConvert = true; wsWriteSettings(s); });
  await page.evaluate(() => mbSwitchTemplate('learnerGuide', { ask: false }));
  await page.waitForFunction(() => mbState.moduleTemplate === 'learnerGuide');
  const lg = await page.evaluate(() => ['performanceSteps', 'requiredSkills', 'requiredKnowledge', 'basicMath', 'cc', 'lopc',
    'safetyOSH', 'toolsEquipmentMaterials', 'workerBehaviours', 'performanceStandard'].map(g => mbCmFieldKinds(g)));
  expect(lg).toEqual([['activity'], ['activity'], ['info'], ['info'], ['assessment'], ['assessment'], [], [], [], []]);
  // the author's own Distribution settings still win
  expect(await page.evaluate(() => { mbState.cmDefaults = { safetyOSH: ['info'] }; return mbCmFieldKinds('safetyOSH'); })).toEqual(['info']);
  expect(await page.evaluate(() => { mbState.cmDefaults = {}; return _covAiPrompt([{ field: 'f', task: 't', text: 'x' }]).includes('LEARNER GUIDE'); })).toBe(true);
  expect(errors).toEqual([]);
});
