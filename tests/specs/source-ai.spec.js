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
  await expect(ov.locator('.src-item:has(.src-meta)')).toHaveCount(1);
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
  await expect(ov.locator('.src-item:has(.src-meta)')).toHaveCount(1, { timeout: 15_000 });
  await expect(ov.locator('.src-item:has(.src-meta) .src-name')).toHaveText('Multimeter Handbook');
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

/* ── 3.46.0: several sheets ─────────────────────────────────── */

/** A mocked AI for several sheets: the matching request gets `map`;
    each sheet request gets a draft that writes H1 and adds one section,
    or the status in `fail` (by call number, 1-based among sheet calls). */
async function mockMany(page, { map = null, fail = {} } = {}) {
  const calls = { map: [], sheet: [] };
  await page.route('**/api/generate-dacum', async (route) => {
    const prompt = JSON.parse(route.request().postData()).prompt;
    if (prompt.includes('You match the INFORMATION SHEETS')) {
      calls.map.push(prompt);
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(map) }] }) });
    }
    calls.sheet.push(prompt);
    const n = calls.sheet.length;
    if (fail[n]) return route.fulfill({ status: fail[n], body: '{}' });
    const topic = (prompt.match(/TOPIC OF THE SHEET: (.*)/) || [])[1];
    const hasH1 = /\nH1: /.test(prompt);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({
      objective: 'Objective for ' + topic,
      sections: [
        ...(hasH1 ? [{ ref: 'H1', heading: 'ignored', text: 'Body written for H1 of ' + topic, pages: [1] }] : []),
        { ref: '', heading: 'Extra ' + n, text: 'A new section from the pages.', pages: [2] }
      ], selfCheck: '', answerKey: '', notCovered: '' }) }] }) });
  });
  return calls;
}

const sheetsOf = (page, loIdx = 0) => page.evaluate((i) => mbState.learningOutcomesData[i].infoSheets.map(s => ({
  title: biGet(s.title, 'en'), objective: biGet(s.objective, 'en'),
  sections: s.contentSections.map(c => [biGetStrict(c.heading, 'en'), biGetStrict(c.text, 'en')])
})), loIdx);

test('several sheets, built from DACUM: pages suggested, empty headings written, nothing replaced', async ({ page }) => {
  const errors = await ready(page);
  await page.evaluate(() => { mbSpViewFilter('info', 'all'); mbSpApproveMany('info', 'shown'); mbSpBuild('info', 'all'); });
  await page.evaluate(() => { _applyLOSwitch(mbState.learningOutcomesData[0].id); loadCurrentLOSheets(); });
  const before = await sheetsOf(page);
  expect(before.length).toBeGreaterThan(0);
  expect(before[0].title).not.toBe('');
  // a DACUM-built sheet: headings waiting for their text
  expect(before[0].sections.length).toBeGreaterThan(0);
  const firstHead = before[0].sections[0][0];
  const n = before.length;
  // one heading that already has text must stay as it is
  await page.evaluate(() => {
    const s = mbState.learningOutcomesData[0].infoSheets[0];
    s.contentSections.push({ contentId: '', marks: [], tables: [], uid: mbUid(), heading: biNew('Kept'), text: biNew('Written by the trainer.') });
    saveCurrentModuleLOData(); loadCurrentLOSheets();
  });
  await page.evaluate(() => mbSrcAddText('Electrical Basics', Array.from({ length: 5 }, (_, i) => 'Chapter ' + (i + 1) + '\n\n' + 'Text about voltage. '.repeat(160)).join('\n\n')));
  const calls = await mockMany(page, { map: { map: Array.from({ length: n }, (_, i) => ({ sheet: 'S' + (i + 1), source: 'B1', from: 2, to: 3 })) } });

  await page.locator('#mb-src-btn').click();
  const ov = page.locator('#src-overlay');
  await ov.locator('[data-src="mode-many"]').click();
  await expect(ov.locator('.src-row')).toHaveCount(n);
  await expect(ov.locator('.src-row [data-rf="topic"]').first()).toHaveValue(before[0].title);
  await expect(ov.locator('#src-gen')).toBeDisabled();            // no pages yet
  await ov.locator('[data-src="map"]').click();
  await expect(page.locator('#src-msg')).toContainText(`${n} of ${n}`);
  expect(calls.map[0]).toMatch(/S1 \[LO ?\d/);
  expect(calls.map[0]).toContain(before[0].title);
  expect(calls.map[0]).toContain('p.1:');                        // the page digest, not the pages
  expect(calls.map[0].length).toBeLessThan(4000);                // a line per page, never the pages themselves
  await expect(ov.locator('.src-row [data-rf="from"]').first()).toHaveValue('2');
  await expect(ov.locator('#src-total')).toContainText(`${n} sheets`);

  await ov.locator('[data-src="gen-many"]').click();
  await expect(page.locator('#src-msg')).toContainText(`Done: ${n} sheet(s) written.`, { timeout: 20_000 });
  await expect(ov.locator('.src-row.is-done')).toHaveCount(n);
  expect(calls.sheet).toHaveLength(n);
  expect(calls.sheet[0]).toContain('HEADINGS ALREADY ON THE SHEET, WAITING FOR THEIR TEXT');
  expect(calls.sheet[0]).toContain('H1: ' + firstHead);
  expect(calls.sheet[0]).toContain('SECTIONS ALREADY WRITTEN (do not repeat them):');
  expect(calls.sheet[0]).toMatch(/\n- Kept\n/);
  expect(calls.sheet[0]).toContain('[[Page 2]]');
  expect(calls.sheet[0]).not.toContain('[[Page 4]]');

  const after = await sheetsOf(page);
  expect(after[0].sections[0][0]).toBe(firstHead);                 // the DACUM heading kept
  expect(after[0].sections[0][1]).toContain('Body written for H1 of ' + before[0].title);
  expect(after[0].sections[0][1]).toContain('(Source: Electrical Basics, p. 1)');
  expect(after[0].sections.find(s => s[0] === 'Kept')[1]).toBe('Written by the trainer.');
  expect(after[0].sections[after[0].sections.length - 1][0]).toBe('Extra 1');
  expect(after[0].objective).toBe('Objective for ' + before[0].title);
  expect(errors).toEqual([]);
});

test('several sheets, made by hand: a sheet without a title asks for its topic; pages chosen by hand', async ({ page }) => {
  const errors = await ready(page);
  await page.evaluate(() => {
    const lo = mbState.learningOutcomesData[0];
    lo.infoSheets = [
      { sheetNumber: '1-1', title: biNew('Ohm’s law'), objective: '', contentSections: [], contentSectionImages: {} },
      { sheetNumber: '1-2', title: biNew(''), objective: '', contentSections: [], contentSectionImages: {} }
    ];
    saveCurrentModuleLOData(); mbState.currentInfoSheetIndex = 0; loadCurrentLOSheets();
  });
  await page.evaluate(() => mbSrcAddText('Handbook', 'Ohm text. '.repeat(1200)));
  const calls = await mockMany(page);
  await page.locator('#mb-src-btn').click();
  const ov = page.locator('#src-overlay');
  await ov.locator('[data-src="mode-many"]').click();
  await expect(ov.locator('.src-row')).toHaveCount(2);
  const row = (i) => ov.locator('.src-row').nth(i);
  await expect(row(1).locator('[data-rf="topic"]')).toHaveValue('');
  for (const i of [0, 1]) {
    await row(i).locator('[data-rf="src"]').selectOption({ label: 'Handbook' });
  }
  await expect(row(0).locator('[data-rf="from"]')).toHaveValue('1');
  await expect(ov.locator('#src-total')).toContainText('1 sheets');   // the untitled one waits for a topic
  await row(1).locator('[data-rf="topic"]').fill('Series circuits');
  await row(1).locator('[data-rf="from"]').fill('2');
  await row(1).locator('[data-rf="to"]').fill('2');
  await expect(ov.locator('#src-total')).toContainText('2 sheets');
  await ov.locator('[data-src="gen-many"]').click();
  await expect(page.locator('#src-msg')).toContainText('Done: 2 sheet(s) written.', { timeout: 20_000 });
  expect(calls.map).toHaveLength(0);
  expect(calls.sheet[0]).toContain('Write 3 to 7 sections');           // no headings on a hand-made sheet
  const after = await sheetsOf(page);
  expect(after[1].title).toBe('Series circuits');                       // the topic became its title
  expect(after[0].sections.map(s => s[0])).toEqual(['Extra 1']);         // no H1 there: only the new section
  expect(errors).toEqual([]);
});

test('several sheets: a busy service stops the run; reopening goes on from the sheet left', async ({ page }) => {
  const errors = await ready(page);
  await page.evaluate(() => {
    const lo = mbState.learningOutcomesData[0];
    lo.infoSheets = ['A', 'B', 'C'].map((t, i) => ({ sheetNumber: '1-' + (i + 1), title: biNew('Topic ' + t), objective: '', contentSections: [], contentSectionImages: {} }));
    saveCurrentModuleLOData(); mbState.currentInfoSheetIndex = 0; loadCurrentLOSheets();
  });
  await page.evaluate(() => mbSrcAddText('Handbook', 'Text. '.repeat(1500)));
  let calls = await mockMany(page, { fail: { 2: 429 } });
  await page.locator('#mb-src-btn').click();
  const ov = page.locator('#src-overlay');
  await ov.locator('[data-src="mode-many"]').click();
  for (let i = 0; i < 3; i++) await ov.locator('.src-row').nth(i).locator('[data-rf="src"]').selectOption({ label: 'Handbook' });
  await ov.locator('[data-src="gen-many"]').click();
  await expect(page.locator('#src-msg')).toContainText('busy', { timeout: 20_000 });
  await expect(ov.locator('.src-row.is-done')).toHaveCount(1);
  await expect(ov.locator('.src-row.is-err')).toHaveCount(1);
  expect(calls.sheet).toHaveLength(2);                                  // C was not tried
  await ov.locator('#src-x').click();

  await page.unroute('**/api/generate-dacum');
  calls = await mockMany(page);
  await page.locator('#mb-src-btn').click();
  await expect(ov.locator('.src-mode.is-on')).toContainText('Several sheets');
  await expect(page.locator('#src-msg')).toContainText('2 sheet(s) left');
  await expect(ov.locator('.src-row').nth(0).locator('[data-rf="on"]')).not.toBeChecked();
  await ov.locator('[data-src="gen-many"]').click();
  await expect(page.locator('#src-msg')).toContainText('Done: 2 sheet(s) written.', { timeout: 20_000 });
  expect(calls.sheet.map(p => (p.match(/TOPIC OF THE SHEET: (.*)/) || [])[1])).toEqual(['Topic B', 'Topic C']);
  const after = await sheetsOf(page);
  expect(after.map(s => s.sections.length)).toEqual([1, 1, 1]);          // A written once, not again
  expect(errors).toEqual([]);
});

test('PDF bookmarks are kept as the contents used for matching', async ({ page }) => {
  const errors = await ready(page);
  const digest = await page.evaluate(() => mbSrcDigest({ pages: ['a', 'b', 'c', 'd'], toc: [
    { title: 'Safety', page: 1, level: 1 }, { title: 'Meters', page: 2, level: 1 }, { title: 'Voltage', page: 3, level: 2 }] }));
  expect(digest).toBe('p.1 Safety\np.2 Meters\n  p.3 Voltage');
  const noToc = await page.evaluate(() => mbSrcDigest({ pages: ['Chapter 1\nSafety first\nAlways switch off the supply.', ''] }));
  expect(noToc).toBe('p.1: Chapter 1 | Safety first');
  expect(errors).toEqual([]);
});

/* ── 3.47.0: the programme around the sheet; no source; mixed ── */

const draftReply = (sections, extra = {}) => ({ objective: 'Do the work.', sections, selfCheck: '', answerKey: '', notCovered: '', toVerify: '', ...extra });

test('the prompt carries job, occupation, country, scope, the full module title and level (DACUM handoff), and a typed country wins', async ({ page }) => {
  const h = fixture('dacum-handoff.json');
  h.context = 'Iraq';
  h.scopeOfWork = 'Installs and maintains computers in offices.';
  const errors = await openApp(page, { handoff: h, contentLang: 'en' });
  await page.evaluate(() => { wsWriteSettings(Object.assign(wsReadSettings(), { sourceDrafts: true })); window.dispatchEvent(new CustomEvent('mb:settingschange')); });
  await tab(page, 'info');
  await page.evaluate(() => { _applyLOSwitch(mbState.learningOutcomesData[0].id); loadCurrentLOSheets(); });
  const seen = await mockAI(page, draftReply([{ ref: '', heading: 'A', text: 'Text A.', origin: 'general', pages: [] }]));
  await page.locator('#mb-src-btn').click();
  const ov = page.locator('#src-overlay');
  await expect(ov.locator('#src-country')).toHaveValue('Iraq');
  await expect(ov.locator('#src-ctxline')).toContainText('Computer Maintenance Technician');
  await ov.locator('#src-topic').fill('Replacing a power supply');
  await ov.locator('[data-src="gen"]').click();
  await expect(ov.locator('.src-part')).toHaveCount(2);
  const p = seen[0];
  expect(p).toContain('JOB (the focus — write for the holder of this job): Computer Maintenance Technician');
  expect(p).toContain('OCCUPATION (context only): Maintenance Technician');
  expect(p).toContain('COUNTRY / CONTEXT: Iraq');
  expect(p).toContain('SCOPE OF WORK (boundary): Installs and maintains computers in offices.');
  expect(p).toContain('TRAINING MODULE: Implementing Core Work');        // the title, not the short name «Core»
  expect(p).toContain('NEVER invent standard numbers');
  // a country typed here is kept on the module and wins over DACUM's
  await ov.locator('[data-src="back"]').click();
  await ov.locator('#src-country').fill('Jordan');
  await ov.locator('#src-country').dispatchEvent('change');
  await ov.locator('[data-src="gen"]').click();
  await expect(ov.locator('.src-part')).toHaveCount(2);
  expect(seen[1]).toContain('COUNTRY / CONTEXT: Jordan');
  expect(await page.evaluate(() => mbState.modulesData.find(m => m.id === mbState.currentModuleId).srcCountry)).toBe('Jordan');
  expect(errors).toEqual([]);
});

test('no source on the device: written from AI knowledge, flagged, no page lines and no reference', async ({ page }) => {
  const errors = await ready(page);
  const refsBefore = await page.evaluate(() => mbState.referencesData.map(r => r.value));
  const seen = await mockAI(page, draftReply([
    { ref: '', heading: 'Choosing the cable', text: 'Use a cable rated for the load.', origin: 'source', pages: [3] }
  ], { toVerify: 'The cable colours used in your country.' }));
  await page.locator('#mb-src-btn').click();
  const ov = page.locator('#src-overlay');
  await expect(ov.locator('input[name="src-pick"][value="__ai__"]')).toBeChecked();   // the only choice
  await expect(ov.locator('#src-mixed')).toHaveCount(0);
  await expect(ov.locator('.src-warn')).toContainText('No page citations');
  await ov.locator('#src-topic').fill('Cables');
  await ov.locator('[data-src="gen"]').click();
  await expect(ov.locator('.src-gap').filter({ hasText: 'To check' })).toContainText('cable colours');
  expect(seen[0]).toContain('NO SOURCE IS GIVEN');
  expect(seen[0]).not.toContain('<source_pages>');
  expect(seen[0]).toContain('"toVerify"');
  await ov.locator('[data-src="keep"]').click();
  const sh = await page.evaluate(() => {
    const lo = mbState.learningOutcomesData.find(l => l.id === mbState.currentLOId);
    return lo.infoSheets[mbState.currentInfoSheetIndex].contentSections.map(c => biGet(c.text, 'en'));
  });
  expect(sh).toEqual(['Use a cable rated for the load.']);      // no "(Source: …)", even though the AI gave a page
  expect(await page.evaluate(() => mbState.referencesData.map(r => r.value))).toEqual(refsBefore);
  expect(errors).toEqual([]);
});

test('mixed: pages first, the rest from general knowledge, each section marked for what it stands on', async ({ page }) => {
  const errors = await ready(page);
  await page.evaluate(() => mbSrcAddText('Handbook', 'Ohm text. '.repeat(1200)));
  const seen = await mockAI(page, draftReply([
    { ref: '', heading: 'From the book', text: 'Book text.', origin: 'source', pages: [1] },
    { ref: '', heading: 'Filled in', text: 'General text.', origin: 'general', pages: [] }
  ], { notCovered: 'Testing procedure.' }));
  await page.locator('#mb-src-btn').click();
  const ov = page.locator('#src-overlay');
  await ov.locator('#src-mixed').check();
  await ov.locator('#src-topic').fill('Ohm');
  await ov.locator('[data-src="gen"]').click();
  await expect(ov.locator('.src-part-cite').nth(1)).toContainText('General knowledge');
  expect(seen[0]).toContain('"origin": "general"');
  expect(seen[0]).toContain('<source_pages>');
  await ov.locator('[data-src="keep"]').click();
  const texts = await page.evaluate(() => {
    const lo = mbState.learningOutcomesData.find(l => l.id === mbState.currentLOId);
    return lo.infoSheets[mbState.currentInfoSheetIndex].contentSections.map(c => biGet(c.text, 'en'));
  });
  expect(texts[0]).toContain('(Source: Handbook, p. 1)');
  expect(texts[1]).toContain('(General knowledge — not from the source; check it)');
  expect(await page.evaluate(() => mbState.referencesData.map(r => r.value))).toContain('Handbook');
  expect(errors).toEqual([]);
});

test('several sheets with no source: rows start on AI knowledge, no pages to choose, no matching request', async ({ page }) => {
  const errors = await ready(page);
  await page.evaluate(() => {
    const lo = mbState.learningOutcomesData[0];
    lo.infoSheets = ['A', 'B'].map((t, i) => ({ sheetNumber: '1-' + (i + 1), title: biNew('Topic ' + t), objective: '', contentSections: [], contentSectionImages: {} }));
    saveCurrentModuleLOData(); mbState.currentInfoSheetIndex = 0; loadCurrentLOSheets();
  });
  const calls = await mockMany(page);
  await page.locator('#mb-src-btn').click();
  const ov = page.locator('#src-overlay');
  await ov.locator('[data-src="mode-many"]').click();
  await expect(ov.locator('.src-row [data-rf="src"]').first()).toHaveValue('__ai__');
  await expect(ov.locator('.src-row [data-rf="from"]')).toHaveCount(0);
  await expect(ov.locator('#src-map')).toBeDisabled();
  await ov.locator('[data-src="gen-many"]').click();
  await expect(page.locator('#src-msg')).toContainText('Done: 2 sheet(s) written.', { timeout: 20_000 });
  expect(calls.map).toHaveLength(0);
  expect(calls.sheet.every(p => p.includes('NO SOURCE IS GIVEN'))).toBe(true);
  expect(errors).toEqual([]);
});
