// 3.80.3: (1) the cards of «Attached figures and tables» are reordered like
// the content cards and the steps — ▲ / ▼ and the ⠿ handle — and the order
// on screen is the order in the document; (2) in the PDF a section's heading
// stays with its text and picture instead of ending a page alone.
const { test, expect } = require('@playwright/test');
const { openApp, fixture, tab } = require('../helpers');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function threeItems(page) {
  await tab(page, 'activity');
  await page.evaluate((png) => {
    document.getElementById('title').value = 'Sheet';
    document.querySelectorAll('textarea[data-step-id]')[0].value = 'Only step';
    ['A', 'B', 'C'].forEach((cap) => {
      mbAttAdd('activity');
      const cards = document.querySelectorAll('#activity-attachments .mb-att-item');
      const card = cards[cards.length - 1];
      const id = card.getAttribute('data-att-id');
      mbAttSetType(id, 'image');
      MB_PASTE_TARGETS.attach.put(id, png);
      card.querySelector('.mb-att-caption').value = cap;
    });
  }, PNG);
}
const items = (page) => page.locator('#activity-attachments .mb-att-item');
const caps = (page) => page.evaluate(() => [...document.querySelectorAll('#activity-attachments .mb-att-caption')].map(e => e.value));

test('attached items: ▲ / ▼ move them, the ends are disabled, the order is the stored and printed one', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
  await threeItems(page);
  await expect(items(page).first().locator('[data-act="mbAttMoveUp"]')).toBeDisabled();
  await expect(items(page).last().locator('[data-act="mbAttMoveDown"]')).toBeDisabled();
  await expect(items(page).nth(1).locator('[data-act="mbAttMoveUp"]')).toBeEnabled();

  await items(page).nth(2).locator('[data-act="mbAttMoveUp"]').click();        // A C B
  expect(await caps(page)).toEqual(['A', 'C', 'B']);
  await items(page).nth(0).locator('[data-act="mbAttMoveDown"]').click();      // C A B
  expect(await caps(page)).toEqual(['C', 'A', 'B']);
  await expect(items(page).last().locator('[data-act="mbAttMoveDown"]')).toBeDisabled();

  // stored in that order, and printed in it
  const stored = await page.evaluate(() => {
    saveCurrentSheetToLO();
    const lo = mbState.learningOutcomesData.find(l => l.id === mbState.currentLOId);
    const sh = lo.activitySheets[mbState.currentActivitySheetIndex || 0];
    return sh.attachments.map(a => (typeof a.caption === 'object' ? a.caption.en : a.caption));
  });
  expect(stored).toEqual(['C', 'A', 'B']);
  const model = await page.evaluate(() => {
    const m = mbBuildModuleModel('en');
    const out = [];
    (function walk(v) { if (!v || typeof v !== 'object') return; if (v.type === 'image' && 'caption' in v) out.push(v.caption); Object.values(v).forEach(walk); })(m);
    return out;
  });
  expect(model.filter(Boolean).slice(0, 3)).toEqual(['C', 'A', 'B']);   // the model lists them once per place they are reachable from
  expect(errors).toEqual([]);
});

test('attached items: drag by the ⠿ handle reorders; the handle shows on every card', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
  await threeItems(page);
  await expect(items(page).locator('.mb-step-handle')).toHaveCount(3);
  await items(page).nth(2).locator('.mb-step-handle').dragTo(items(page).nth(0), { targetPosition: { x: 40, y: 5 } });
  expect(await caps(page)).toEqual(['C', 'A', 'B']);
  await expect(items(page).nth(0)).not.toHaveAttribute('draggable', 'true');
  await expect(items(page).nth(0).locator('[data-act="mbAttMoveUp"]')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('PDF: a heading goes to the next page with its text and picture instead of ending a page alone', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
  const r = await page.evaluate((png) => {
    const run = (yFromBottom) => {
      const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
      const w = _pdfWriter(pdf, _pdfStyle(), 'en');
      w.y = w.BOTTOM - yFromBottom;
      let at = null;
      w.textImageRows('It is used to see the smallest details. '.repeat(3), [png], [], {
        lead: 8, draw: () => { at = { page: w.page, y: w.y }; w.y += 8; }
      });
      return at;
    };
    return { tight: run(14), roomy: run(150) };
  }, PNG);
  expect(r.tight.page).toBe(2);              // no room for heading + row → both on the next page
  expect(r.tight.y).toBeCloseTo(18, 1);      // at the top margin
  expect(r.roomy.page).toBe(1);              // room → stays
  expect(errors).toEqual([]);
});
