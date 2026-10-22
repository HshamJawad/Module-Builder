// 3.71.0: in Word, a content section with no picture is printed as plain
// justified paragraphs (no table), and a step with no picture as ONE cell
// across the table's width with one empty line under its text. Sections
// and steps with a picture keep the text | picture table.
const { test, expect } = require('@playwright/test');
const { openApp, tab } = require('../helpers');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR42mNkYGD4z8DAwMDAxMDAAAAeBQIBpVCrkAAAAABJRU5ErkJggg==';

/** The tables of document.xml, and whether a text sits inside one. */
function inTable(xml, text) {
  const i = xml.indexOf(text);
  expect(i, text).toBeGreaterThan(-1);
  const open = xml.lastIndexOf('<w:tbl>', i), close = xml.lastIndexOf('</w:tbl>', i);
  return open > close;
}
function tableOf(xml, text) {
  const i = xml.indexOf(text);
  return xml.slice(xml.lastIndexOf('<w:tbl>', i), xml.indexOf('</w:tbl>', i) + 8);
}

test('Word: plain paragraphs for a section without a picture, one wide cell for a step without one', async ({ page }) => {
  const errors = await openApp(page, { lang: 'en', contentLang: 'en' });
  const xml = await page.evaluate(async (png) => {
    const P = (t) => ({ en: t, ar: '', fr: '' });
    const lo = mbState.learningOutcomesData[0];
    lo.infoSheets = [{ title: P('How to use a soldering iron'), contentSections: [
      { contentId: 'c1', uid: 'u1', heading: P('1- Taking Protection Measures'), text: P('PLAIN SECTION LINE ONE\nPLAIN SECTION LINE TWO'), marks: [], tables: [] },
      { contentId: 'c2', uid: 'u2', heading: P('2- Choosing a Good Soldering Iron'), text: P('PICTURE SECTION TEXT'), marks: [], tables: [] }
    ], contentSectionImages: { c2: [png] } }];
    lo.activitySheets = [{ title: P('Using hand tools'), sheetType: 'activity', steps: [
      { stepId: 's1', uid: 'st1', text: P('PLAIN STEP TEXT') },
      { stepId: 's2', uid: 'st2', text: P('PICTURE STEP TEXT') }
    ], images: { s2: [png] } }];
    mbState.stepImages = { s2: [png] };
    saveCurrentModuleLOData(); mbState.currentLOId = null; _applyLOSwitch(lo.id);
    let got = null;
    window.mbExportSink = { take: (b) => { got = b; return Promise.resolve(); }, skip: () => {}, fail: (e) => { throw e; } };
    try { await exportToDocx(); } finally { window.mbExportSink = null; }
    return new TextDecoder().decode(fflate.unzipSync(new Uint8Array(await got.arrayBuffer()))['word/document.xml']);
  }, PNG);

  // section without a picture: two justified paragraphs, outside any table
  expect(inTable(xml, 'PLAIN SECTION LINE ONE')).toBe(false);
  expect(inTable(xml, 'PLAIN SECTION LINE TWO')).toBe(false);
  const para = xml.slice(xml.lastIndexOf('<w:p>', xml.indexOf('PLAIN SECTION LINE ONE')), xml.indexOf('PLAIN SECTION LINE ONE'));
  expect(para).toContain('<w:jc w:val="both"/>');
  // section with a picture: still text | picture
  expect(inTable(xml, 'PICTURE SECTION TEXT')).toBe(true);
  expect((tableOf(xml, 'PICTURE SECTION TEXT').match(/<w:tc>/g) || []).length).toBe(2);

  // step without a picture: one cell, the table's full width, an empty line under the text
  const plainStep = tableOf(xml, 'PLAIN STEP TEXT');
  expect((plainStep.match(/<w:tc>/g) || []).length).toBe(1);
  expect(plainStep).toContain('<w:gridCol w:w="9072"/>');
  const cellParas = plainStep.split('<w:p>').length - 1;
  expect(cellParas).toBe(2);                                   // the step line + one empty line
  // step with a picture: still text | picture
  expect((tableOf(xml, 'PICTURE STEP TEXT').match(/<w:tc>/g) || []).length).toBe(2);
  expect(errors).toEqual([]);
});
