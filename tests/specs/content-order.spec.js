// 3.79.0: content cards on the Information sheet — a card added directly
// below another, moved up and down, dragged by its handle; the badges
// renumber, the order is what is saved, Undo puts it back, and a card keeps
// its own images after a move and a reload.
const { test, expect } = require('@playwright/test');
const { openApp, fixture, tab } = require('../helpers');

const cards = page => page.locator('#content-sections-container > .content-section-item');
const texts = page => page.evaluate(() =>
  [...document.querySelectorAll('#content-sections-container > .content-section-item textarea[data-content-id]')].map(t => t.value));

async function threeCards(page) {
  await tab(page, 'info');
  await page.evaluate(() => {
    document.getElementById('content-sections-container').innerHTML = '';
    mbState.contentSectionCount = 0;
    addContentSection(); addContentSection();
    const tas = document.querySelectorAll('#content-sections-container textarea[data-content-id]');
    tas[0].value = 'A'; tas[1].value = 'C';
  });
  // ➕ on card 1 inserts below it, not at the end
  await cards(page).nth(0).locator('[data-act="insertContentAfter"]').click();
  await expect(cards(page)).toHaveCount(3);
  await expect(cards(page).nth(1).locator('textarea')).toBeFocused();
  await cards(page).nth(1).locator('textarea').fill('B');
}

test('insert below, move up / down, renumbered, saved in the new order', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
  await threeCards(page);
  expect(await texts(page)).toEqual(['A', 'B', 'C']);
  await expect(cards(page).locator('.cs-num')).toHaveText(['1', '2', '3']);

  // edges: the first cannot go up, the last cannot go down
  await expect(cards(page).nth(0).locator('[data-act="moveContentUp"]')).toBeDisabled();
  await expect(cards(page).nth(2).locator('[data-act="moveContentDown"]')).toBeDisabled();

  await cards(page).nth(2).locator('[data-act="moveContentUp"]').click();
  expect(await texts(page)).toEqual(['A', 'C', 'B']);
  await cards(page).nth(0).locator('[data-act="moveContentDown"]').click();
  expect(await texts(page)).toEqual(['C', 'A', 'B']);
  await expect(cards(page).locator('.cs-num')).toHaveText(['1', '2', '3']);

  await page.evaluate(() => saveCurrentSheetToLO());
  const saved = await page.evaluate(() => {
    const lo = mbState.learningOutcomesData.find(l => l.id === mbState.currentLOId);
    return lo.infoSheets[mbState.currentInfoSheetIndex].contentSections.map(s => s.text.en || s.text);
  });
  expect(saved).toEqual(['C', 'A', 'B']);

  // undo puts the last move back
  await page.evaluate(() => mbUndo());
  await page.waitForTimeout(200);
  expect(await texts(page)).toEqual(['A', 'C', 'B']);

  // a deleted card renumbers the rest
  await cards(page).nth(1).locator('[data-act="removeContentSection"]').click();
  await page.locator('.mb-dialog-overlay .mb-dialog-ok').click();
  await expect(cards(page)).toHaveCount(2);
  await expect(cards(page).locator('.cs-num')).toHaveText(['1', '2']);
  expect(errors).toEqual([]);
});

test('drag by the handle reorders the content cards', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
  await threeCards(page);
  await cards(page).nth(2).locator('.mb-step-handle').dragTo(cards(page).nth(0), { targetPosition: { x: 40, y: 5 } });
  expect(await texts(page)).toEqual(['C', 'A', 'B']);
  await expect(cards(page).locator('.cs-num')).toHaveText(['1', '2', '3']);
  await expect(cards(page).nth(0)).not.toHaveAttribute('draggable', 'true');
  expect(errors).toEqual([]);
});

test('a card keeps its own images after being moved and reloaded', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
  await threeCards(page);
  const img = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  // the image belongs to card C (third)
  await page.evaluate((src) => {
    const id = document.querySelectorAll('#content-sections-container textarea[data-content-id]')[2].dataset.contentId;
    mbState.contentSectionImages[id] = [src];
    renderContentImageGallery(id);
  }, img);
  await cards(page).nth(2).locator('[data-act="moveContentUp"]').click();
  await cards(page).nth(1).locator('[data-act="moveContentUp"]').click();
  expect(await texts(page)).toEqual(['C', 'A', 'B']);

  // reload the sheet from the saved data: C is now card 1 and keeps the image
  await page.evaluate(() => {
    saveCurrentSheetToLO();
    const lo = mbState.learningOutcomesData.find(l => l.id === mbState.currentLOId);
    loadInfoSheetAtIndex(lo, mbState.currentInfoSheetIndex);
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
  await tab(page, 'info');
  const first = cards(page).first();
  await expect(first.locator('[data-act="insertContentAfter"] span')).toHaveText('إضافة محتوى أسفله');
  await expect(first.locator('[data-act="moveContentUp"]')).toHaveAttribute('title', 'نقل المحتوى إلى الأعلى');
  await page.evaluate(() => window.i18n.setLang('en'));
  await expect(first.locator('[data-act="insertContentAfter"] span')).toHaveText('Add content below');
  expect(errors).toEqual([]);
});
