// 3.81.16: DACUM Live Pro on another address (pro.dacumtools.com) cannot
// share localStorage with Module Builder (modules.dacumtools.com), so the
// handoff also arrives as a message. Here "DACUM" is a stub page on
// http://localhost:4174 (another origin than http://127.0.0.1:4174).
const { test, expect } = require('@playwright/test');
const { fixture } = require('../helpers');

const MB = 'http://127.0.0.1:4174';
const DACUM = 'http://localhost:4174';

function handoffOf(base, nums) {
  const h = JSON.parse(JSON.stringify(base));
  const m0 = h.modules[0];
  h.modules = nums.map(i => ({ ...JSON.parse(JSON.stringify(m0)), moduleId: `module_${i}`, moduleCode: `CMT ${i}`, moduleNumber: `M${i}`, moduleTitle: `Module ${i}` }));
  return h;
}

async function setup(context, { allow }) {
  await context.addInitScript(({ allow }) => {
    if (location.origin !== 'http://127.0.0.1:4174') return;
    if (allow) window.MB_EXTRA_DACUM_ORIGINS = ['http://localhost:4174'];
    if (!sessionStorage.getItem('__mbSeeded')) {
      sessionStorage.setItem('__mbSeeded', '1');
      localStorage.setItem('mb_author_asked', '1');
      localStorage.setItem('mb_author_name', 'Test author');
      localStorage.setItem('mb_word_export_settings', JSON.stringify({ templateChooser: false }));
    }
  }, { allow });
  await context.route(`${DACUM}/__stub.html`, route => route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><title>stub</title><script>
      window.__payload = null; window.__acked = null; window.__w = null;
      window.addEventListener('message', function (ev) {
        if (ev.origin !== '${MB}' || !ev.data) return;
        if (ev.data.type === 'mb-ready' && window.__payload)
          ev.source.postMessage({ type: 'dacum-modules-export', id: 't1', payload: window.__payload }, ev.origin);
        if (ev.data.type === 'mb-imported') window.__acked = ev.data.id;
      });
      window.__open = function () { window.__w = window.open('${MB}/index.html', 'module-builder'); };
      window.__post = function () { window.__w.postMessage({ type: 'dacum-modules-export', id: 't2', payload: window.__payload }, '${MB}'); };
    </script>`
  }));
}

const booted = p => p.waitForFunction(() => window.mbLib && window.mbLib.booted === true, null, { timeout: 30_000 });

test('a tab opened by DACUM on another address asks for the handoff and imports it', async ({ context }) => {
  await setup(context, { allow: true });
  const base = fixture('dacum-handoff.json');
  const stub = await context.newPage();
  await stub.goto(`${DACUM}/__stub.html`);
  await stub.evaluate(h => { window.__payload = h; }, handoffOf(base, [1, 2]));
  const [mb] = await Promise.all([context.waitForEvent('page'), stub.evaluate(() => window.__open())]);
  await booted(mb);
  await expect.poll(() => mb.evaluate(() => mbState.modulesData.length), { timeout: 15_000 }).toBe(2);
  await expect.poll(() => stub.evaluate(() => window.__acked)).toBe('t1');
});

test('a tab that is already open takes a handoff posted to it', async ({ context }) => {
  await setup(context, { allow: true });
  const base = fixture('dacum-handoff.json');
  const stub = await context.newPage();
  await stub.goto(`${DACUM}/__stub.html`);
  const [mb] = await Promise.all([context.waitForEvent('page'), stub.evaluate(() => window.__open())]);
  await booted(mb);
  await stub.evaluate(h => { window.__payload = h; window.__post(); }, handoffOf(base, [5, 6, 7]));
  // The empty first module of a new library is replaced by what arrives.
  await expect.poll(() => mb.evaluate(() => mbState.modulesData.length), { timeout: 15_000 }).toBe(3);
  await expect.poll(() => stub.evaluate(() => window.__acked)).toBe('t2');
});

test('a message from an address that is not DACUM is ignored', async ({ context }) => {
  await setup(context, { allow: false });
  const base = fixture('dacum-handoff.json');
  const stub = await context.newPage();
  await stub.goto(`${DACUM}/__stub.html`);
  const [mb] = await Promise.all([context.waitForEvent('page'), stub.evaluate(() => window.__open())]);
  await booted(mb);
  const before = await mb.evaluate(() => mbState.modulesData.length);
  await stub.evaluate(h => { window.__payload = h; window.__post(); }, handoffOf(base, [9]));
  await mb.waitForTimeout(1500);
  expect(await mb.evaluate(() => mbState.modulesData.length)).toBe(before);
  expect(await stub.evaluate(() => window.__acked)).toBe(null);
});
