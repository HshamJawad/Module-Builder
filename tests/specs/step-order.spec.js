// 3.52.0: activity steps — a step added directly below another, moved up
// and down, dragged by its handle; the cards renumber, the order is what
// is saved and exported, undo puts it back, and each step's images stay
// with that step after a reload.
const { test, expect } = require('@playwright/test');
const { openApp, fixture, tab } = require('../helpers');

const cards = page => page.locator('#steps-container > .step-item');
const texts = page => page.evaluate(() =>
  [...document.querySelectorAll('#steps-container > .step-item textarea[data-step-id]')].map(t => t.value));

async function threeSteps(page) {
  await tab(page, 'activity');
  await page.evaluate(() => {
    document.getElementById('steps-container').innerHTML = '';
    mbState.stepCount = 0;
    addStep(); addStep();
    const tas = document.querySelectorAll('#steps-container textarea[data-step-id]');
    tas[0].value = 'A'; tas[1].value = 'C';
  });
  // ➕ on step 1 inserts below it, not at the end
  await cards(page).nth(0).locator('[data-act="insertStepAfter"]').click();
  await expect(cards(page)).toHaveCount(3);
  await expect(cards(page).nth(1).locator('textarea')).toBeFocused();
  await cards(page).nth(1).locator('textarea').fill('B');
}

test('insert below, move up / down, renumbered, saved in the new order', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
  await threeSteps(page);
  expect(await texts(page)).toEqual(['A', 'B', 'C']);
  await expect(cards(page).locator('.step-label')).toHaveText(['Step 1:', 'Step 2:', 'Step 3:']);

  // edges: the first cannot go up, the last cannot go down
  await expect(cards(page).nth(0).locator('[data-act="moveStepUp"]')).toBeDisabled();
  await expect(cards(page).nth(2).locator('[data-act="moveStepDown"]')).toBeDisabled();

  await cards(page).nth(2).locator('[data-act="moveStepUp"]').click();
  expect(await texts(page)).toEqual(['A', 'C', 'B']);
  await cards(page).nth(0).locator('[data-act="moveStepDown"]').click();
  expect(await texts(page)).toEqual(['C', 'A', 'B']);
  await expect(cards(page).locator('.step-label')).toHaveText(['Step 1:', 'Step 2:', 'Step 3:']);

  await page.evaluate(() => saveCurrentSheetToLO());
  const saved = await page.evaluate(() => {
    const lo = mbState.learningOutcomesData.find(l => l.id === mbState.currentLOId);
    return lo.activitySheets[mbState.currentActivitySheetIndex].steps.map(s => s.text.en || s.text);
  });
  expect(saved).toEqual(['C', 'A', 'B']);

  // undo puts the last move back
  await page.evaluate(() => mbUndo());
  await page.waitForTimeout(200);
  expect(await texts(page)).toEqual(['A', 'C', 'B']);

  // a deleted step renumbers the rest
  await cards(page).nth(1).locator('[data-act="removeStep"]').click();
  await page.locator('.mb-dialog-overlay .mb-dialog-ok').click();
  await expect(cards(page)).toHaveCount(2);
  await expect(cards(page).locator('.step-label')).toHaveText(['Step 1:', 'Step 2:']);
  expect(errors).toEqual([]);
});

test('drag by the handle reorders the steps', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
  await threeSteps(page);
  await cards(page).nth(2).locator('.mb-step-handle').dragTo(cards(page).nth(0), { targetPosition: { x: 40, y: 5 } });
  expect(await texts(page)).toEqual(['C', 'A', 'B']);
  await expect(cards(page).locator('.step-label')).toHaveText(['Step 1:', 'Step 2:', 'Step 3:']);
  await expect(cards(page).nth(0)).not.toHaveAttribute('draggable', 'true');
  expect(errors).toEqual([]);
});

test('a step keeps its own images after being moved and reloaded', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
  await threeSteps(page);
  const img = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  // the image belongs to step C (third card)
  await page.evaluate((src) => {
    const id = document.querySelectorAll('#steps-container textarea[data-step-id]')[2].dataset.stepId;
    mbState.stepImages[id] = [src];
    renderStepImageGallery(id);
  }, img);
  await cards(page).nth(2).locator('[data-act="moveStepUp"]').click();
  await cards(page).nth(1).locator('[data-act="moveStepUp"]').click();
  expect(await texts(page)).toEqual(['C', 'A', 'B']);

  // reload the sheet from the saved data: C is now card 1 and keeps the image
  await page.evaluate(() => {
    saveCurrentSheetToLO();
    const lo = mbState.learningOutcomesData.find(l => l.id === mbState.currentLOId);
    loadActivitySheetAtIndex(lo, mbState.currentActivitySheetIndex);
  });
  await page.waitForTimeout(200);
  expect(await texts(page)).toEqual(['C', 'A', 'B']);
  await expect(cards(page).nth(0).locator('.content-image-gallery img')).toHaveCount(1);
  await expect(cards(page).nth(1).locator('.content-image-gallery img')).toHaveCount(0);
  await expect(cards(page).nth(2).locator('.content-image-gallery img')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Arabic: the order buttons and the insert button read in Arabic', async ({ page }) => {
  const errors = await openApp(page, { lang: 'ar' });
  await tab(page, 'activity');
  const first = cards(page).first();
  await expect(first.locator('[data-act="insertStepAfter"] span')).toHaveText('إضافة خطوة أسفلها');
  await expect(first.locator('[data-act="moveStepUp"]')).toHaveAttribute('title', 'نقل الخطوة إلى الأعلى');
  await page.evaluate(() => window.i18n.setLang('en'));
  await expect(first.locator('[data-act="insertStepAfter"] span')).toHaveText('Add step below');
  expect(errors).toEqual([]);
});
