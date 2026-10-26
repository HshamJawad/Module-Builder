// Shared helpers for the Module Builder behaviour tests.
const fs = require('fs');
const path = require('path');

function fixture(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'));
}

/**
 * Open Module Builder. With `handoff`, the page starts the way it does
 * after DACUM Live Pro's "Build in Module Builder": the handoff is in
 * localStorage before the first script runs. Collects page errors.
 */
async function openApp(page, { handoff = null, lang = null, contentLang = null, chooser = false } = {}) {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  if (!page.__mbDialogs) {
    page.__mbDialogs = true;
    page.on('dialog', d => d.accept().catch(() => {}));
  }
  await page.addInitScript(({ h, lang, cl, chooser }) => {
    if (sessionStorage.getItem('__mbSeeded')) return;   // once per test, not on reload
    sessionStorage.setItem('__mbSeeded', '1');
    localStorage.setItem('mb_author_asked', '1');      // no first-run name prompt
    localStorage.setItem('mb_author_name', 'Test author');
    if (!chooser) localStorage.setItem('mb_word_export_settings', JSON.stringify({ templateChooser: false }));   // no template window (3.59.0)
    if (h) localStorage.setItem('dacum_modules_export', h);
    if (lang) localStorage.setItem('dacum_lang', lang);
    if (cl) localStorage.setItem('mb_content_lang', cl);
  }, { h: handoff ? JSON.stringify(handoff) : null, lang, cl: contentLang, chooser });
  await page.goto('/index.html');
  await page.waitForFunction(() => window.mbLib && window.mbLib.booted === true, null, { timeout: 30_000 });
  await page.waitForTimeout(400);
  return errors;
}

/** On phones and tablets (≤1024px) the side navigation is a drawer: open it. */
async function openNav(page) {
  const nav = page.locator('#mb-sidenav');
  if (await nav.isVisible()) return;
  await page.locator('#mb-nav-toggle').click();
  await nav.waitFor({ state: 'visible' });
}

/** Switch tab the way the side navigation does. */
async function tab(page, name) {
  await page.evaluate(n => window.switchTab(n), name);
  await page.waitForTimeout(150);
}

/** The open module, as data. */
function openModule(page, expr = 'm => m') {
  if (typeof expr === 'function') expr = expr.toString();
  return page.evaluate((src) => {
    const m = mbState.modulesData.find(x => x.id === mbState.currentModuleId);
    return JSON.parse(JSON.stringify((0, eval)(src)(m)));
  }, expr);
}

module.exports = {
  openNav, fixture, openApp, tab, openModule };
