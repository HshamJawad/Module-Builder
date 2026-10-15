// 3.45.0: 📚 Draft from sources (src/source_ai.js) — an information sheet
// drafted by the AI from pages the trainer chooses. The AI service is
// mocked: these tests check what is sent and what is written back.
const { test, expect } = require('@playwright/test');
const { openApp, fixture, tab } = require('../helpers');

const PAGE_TEXT = (n) => `Page ${n} text. ` + `Voltage is measured in parallel with the load, section ${n}. `.repeat(70);

/** The info tab of outcome 1, with the feature switched on. */
async function ready(page, opts = {}) {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en', ...opts });
  await page.evaluate(() => {
    wsWriteSettings(Object.assign(wsReadSettings(), { sourceDrafts: true }));
    window.dispatchEvent(new CustomEvent('mb:settingschange'));
  });
  await tab(page, 'info');
  await page.evaluate(() => { _applyLOSwitch(mbState.learningOutcomesData[0].id); loadCurrentLOSheets(); });
  return errors;
}

/** A mocked AI that records the prompt and answers with `reply`. */
async function mockAI(page, reply) {
  const seen = [];
  await page.route('**/api/generate-dacum', async (route) => {
    seen.push(JSON.parse(route.request().postData()).prompt);
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(reply) }] }) });
  });
  return seen;
}

test('off by default; Settings → Misc shows the button on information sheets', async ({ page }) => {
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
  await tab(page, 'info');
  await expect(page.locator('#mb-src-btn')).toBeHidden();
  await page.locator('#mb-settings-nav').click();
  const ov = page.locator('#ws-overlay');
  await ov.locator('.ws-nav-btn[data-ws-pane="misc"]').click();
  await ov.locator('input[data-ws-misc="sourceDrafts"]').check();
  await ov.locator('#ws-save').click();
  await ov.locator('#ws-close').click();
  await expect(page.locator('#mb-src-btn')).toBeVisible();
  await expect(page.locator('#mb-src-btn')).toContainText('Draft from sources');
  expect(await page.evaluate(() => wsReadSettings().sourceDrafts)).toBe(true);
  expect(errors).toEqual([]);
});

test('pasted text: only the chosen pages are sent; the kept draft lands on the sheet with its pages and reference', async ({ page }) => {
  const errors = await ready(page);
  const seen = await mockAI(page, {
    objective: 'Measure voltage safely.',
    sections: [
      { heading: 'What voltage is', text: 'Voltage is the push that moves current.', pages: [2] },
      { heading: 'Connecting the meter', text: '1. Select V.\n2. Connect in parallel.', pages: [2, 3] },
      { heading: 'Not wanted', text: 'Left out by the trainer.', pages: [3] }
    ],
    selfCheck: '1. How is a voltmeter connected?', answerKey: '1. In parallel.',
    notCovered: 'Measuring AC voltage.'
  });

  await page.locator('#mb-src-btn').click();
  const ov = page.locator('#src-overlay');
  await expect(ov).toBeVisible();
  await ov.locator('[data-src="paste"]').click();
  await ov.locator('#src-paste-name').fill('Electrical Basics');
  await ov.locator('#src-paste-text').fill([1, 2, 3, 4].map(PAGE_TEXT).join('\n\n'));
  await ov.locator('[data-src="paste-add"]').click();
  await expect(ov.locator('.src-item')).toHaveCount(1);
  const pages = await page.evaluate(async () => (await mbSources.list())[0].pages.length);
  expect(pages).toBeGreaterThanOrEqual(4);

  await ov.locator('#src-ref').fill('Smith, J. (2020). Electrical Basics. TVET Press.');
  await ov.locator('#src-ref').dispatchEvent('change');
  await ov.locator('#src-from').fill('2');
  await ov.locator('#src-from').dispatchEvent('input');
  await ov.locator('#src-to').fill('3');
  await ov.locator('#src-to').dispatchEvent('input');
  await expect(ov.locator('#src-est')).toContainText('tokens');
  await ov.locator('#src-topic').fill('Measuring voltage');
  await ov.locator('[data-src="gen"]').click();

  await expect(ov.locator('.src-part')).toHaveCount(5);            // objective, 3 sections, self-check
  await expect(ov.locator('.src-gap')).toContainText('Measuring AC voltage');
  expect(seen).toHaveLength(1);
  expect(seen[0]).toContain('TOPIC OF THE SHEET: Measuring voltage');
  expect(seen[0]).toContain('[[Page 2]]');
  expect(seen[0]).toContain('[[Page 3]]');
  expect(seen[0]).not.toContain('[[Page 1]]');
  expect(seen[0]).not.toContain('[[Page 4]]');
  expect(seen[0]).toContain('SOURCE: Smith, J. (2020)');
  expect(seen[0]).toContain('Write everything in English');

  await ov.locator('[data-part="s2"]').uncheck();
  await ov.locator('[data-src="keep"]').click();
  await expect(ov).toHaveCount(0);

  const sh = await page.evaluate(() => {
    const lo = mbState.learningOutcomesData.find(l => l.id === mbState.currentLOId);
    const s = lo.infoSheets[mbState.currentInfoSheetIndex];
    return {
      title: biGet(s.title, 'en'), objective: biGet(s.objective, 'en'),
      sections: s.contentSections.map(c => [biGet(c.heading, 'en'), biGet(c.text, 'en')]),
      self: biGet(s.selfCheckContent, 'en'), key: biGet(s.answersKeyContent, 'en'),
      refs: mbState.referencesData.map(r => r.value)
    };
  });
  expect(sh.sections.map(s => s[0])).toEqual(['What voltage is', 'Connecting the meter']);
  expect(sh.sections[1][1]).toContain('2. Connect in parallel.');
  expect(sh.sections[1][1]).toContain('(Source: Electrical Basics, p. 2–3)');
  expect(sh.objective).toBe('Measure voltage safely.');
  expect(sh.self).toContain('voltmeter');
  expect(sh.key).toContain('In parallel');
  expect(sh.refs).toContain('Smith, J. (2020). Electrical Basics. TVET Press.');
  // on screen too
  await expect(page.locator('#content-sections-container textarea').nth(1)).toHaveValue(/Connect in parallel/);
  expect(errors).toEqual([]);
});

test('PDF: read page by page in the browser, kept on this device after a reload', async ({ page }) => {
  const errors = await ready(page);
  const bytes = await page.evaluate(() => {
    const doc = new jspdf.jsPDF();
    ['Chapter 1 — Safety first', 'Chapter 2 — Using the multimeter', 'Chapter 3 — Fault finding'].forEach((t, i) => {
      if (i) doc.addPage();
      doc.text(t, 20, 20);
      doc.text('Always switch off the supply before work on page ' + (i + 1) + '.', 20, 30);
    });
    return Array.from(new Uint8Array(doc.output('arraybuffer')));
  });
  await page.locator('#mb-src-btn').click();
  const ov = page.locator('#src-overlay');
  await ov.locator('#src-file').setInputFiles({ name: 'Multimeter Handbook.pdf', mimeType: 'application/pdf', buffer: Buffer.from(bytes) });
  await expect(ov.locator('.src-item')).toHaveCount(1, { timeout: 15_000 });
  await expect(ov.locator('.src-item .src-name')).toHaveText('Multimeter Handbook');
  await expect(ov.locator('.src-item .src-meta')).toContainText('3 pages');
  await expect(ov.locator('.src-warn')).toHaveCount(0);       // not scanned
  const p2 = await page.evaluate(async () => (await mbSources.list())[0].pages[1]);
  expect(p2).toContain('Chapter 2');
  expect(p2).toContain('page 2');

  await page.reload();
  await page.waitForFunction(() => window.mbLib && window.mbLib.booted === true);
  expect(await page.evaluate(async () => (await mbSources.list()).map(s => s.name))).toEqual(['Multimeter Handbook']);
  expect(errors).toEqual([]);
});

test('a failed request leaves the dialog open with a message; too many pages cannot be sent', async ({ page }) => {
  const errors = await ready(page);
  await page.route('**/api/generate-dacum', r => r.fulfill({ status: 429, body: '{}' }));
  await page.evaluate(() => mbSrcAddText('Long', Array.from({ length: 60 }, (_, i) => 'Paragraph ' + i + ' ' + 'x'.repeat(2900)).join('\n\n')));
  await page.locator('#mb-src-btn').click();
  const ov = page.locator('#src-overlay');
  await ov.locator('#src-to').fill('60');
  await ov.locator('#src-to').dispatchEvent('input');
  await expect(ov.locator('#src-est')).toHaveClass(/is-bad/);
  await expect(ov.locator('#src-gen')).toBeDisabled();
  await ov.locator('#src-to').fill('2');
  await ov.locator('#src-to').dispatchEvent('input');
  await ov.locator('#src-topic').fill('Anything');
  await ov.locator('[data-src="gen"]').click();
  await expect(page.locator('#src-msg')).toContainText('busy');
  await expect(ov).toBeVisible();
  expect(errors).toEqual([]);
});

test('Arabic, 360 px: the dialog fits, Arabic labels, citation in Arabic', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  const errors = await ready(page, { lang: 'ar', contentLang: 'ar' });
  await expect(page.locator('#mb-src-btn')).toContainText('صياغة من المصادر');
  await page.evaluate(() => mbSrcAddText('أساسيات الكهرباء', 'الجهد الكهربائي هو فرق الجهد بين نقطتين. '.repeat(200)));
  await page.locator('#mb-src-btn').click();
  const ov = page.locator('#src-overlay');
  await expect(ov.locator('#src-title')).toContainText('صياغة من المصادر');
  const fits = await page.evaluate(() => {
    const m = document.querySelector('#src-overlay .ws-modal').getBoundingClientRect();
    return m.left >= 0 && m.right <= window.innerWidth + 1 && document.documentElement.scrollWidth <= window.innerWidth + 1;
  });
  expect(fits).toBe(true);
  expect(await page.evaluate(() => mbSrcCiteLine('أساسيات الكهرباء', [4, 5, 6, 9], 'ar'))).toBe('(المصدر: أساسيات الكهرباء، ص 4–6، 9)');
  expect(await page.evaluate(() => mbSrcTokens('الجهد'))).toBe(3);
  expect(errors).toEqual([]);
});
