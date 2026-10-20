// 3.55.0: the update bar shows when a release arrives, the way DACUM Live
// Pro does it — the service worker finds a new sw.js (a new CACHE_VERSION),
// installs it, and the page that was running under the old worker offers
// the update. Before, opened after a merge, the page read the new
// version.json as its own build and offered nothing.
//
// The site is served from a temporary copy so the test can "publish" a
// new release by rewriting sw.js and version.json on disk. Service
// workers are allowed in this file only (the suite blocks them).
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { test, expect } = require('@playwright/test');

const ROOT = path.join(__dirname, '..', '..');
const PORT = 4190;
const SKIP = new Set(['tests', '.git', 'node_modules', '.github']);

let dir, server;

function copySite(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    if (SKIP.has(name)) continue;
    const s = path.join(src, name), d = path.join(dst, name);
    if (fs.statSync(s).isDirectory()) copySite(s, d); else fs.copyFileSync(s, d);
  }
}

function publish(version) {
  const sw = path.join(dir, 'sw.js');
  fs.writeFileSync(sw, fs.readFileSync(sw, 'utf8').replace(/const CACHE_VERSION = '[^']+'/, `const CACHE_VERSION = 'mb-${version}'`));
  fs.writeFileSync(path.join(dir, 'version.json'), JSON.stringify({ version, build: '2026-10-20' }));
}

test.use({ serviceWorkers: 'allow', baseURL: `http://localhost:${PORT}` });
test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-sw-'));
  copySite(ROOT, dir);
  server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: dir, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    const ok = await new Promise(res => http.get({ host: '127.0.0.1', port: PORT, path: '/index.html' }, r => { r.resume(); res(r.statusCode === 200); })
      .on('error', () => res(false)));
    if (ok) return;
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('test server did not start');
});

test.afterAll(() => {
  if (server) server.kill();
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
});

const WANT = {
  en: 'A new version of Module Builder is available',
  fr: 'Une nouvelle version du Constructeur de Modules est disponible',
  ar: 'يتوفر إصدار جديد من باني الوحدات التدريبية',
};

for (const [lang, text] of Object.entries(WANT)) {
  test(`a release shows the update bar on the next open (${lang})`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(String(e && e.message || e)));
    await page.addInitScript(l => {
      localStorage.setItem('mb_author_asked', '1');
      localStorage.setItem('mb_author_name', 'Test author');
      localStorage.setItem('dacum_lang', l);
    }, lang);
    publish('3.90.0');

    // First visit: the worker installs; nothing to update, no bar.
    await page.goto('/index.html');
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 20_000 });
    await page.waitForTimeout(800);
    await expect(page.locator('.mb-update-bar')).toHaveCount(0);

    // A release is merged, then the tool is opened again.
    publish(`3.90.${lang.charCodeAt(0)}`);
    await page.goto('/index.html');
    const bar = page.locator('.mb-update-bar.is-open');
    await expect(bar).toBeVisible({ timeout: 20_000 });
    await expect(bar).toContainText(text);
    expect(errors).toEqual([]);
  });
}

// 3.62.1: «Update now» reloads once, and the reloaded page offers nothing
// more — the new worker taking over after the reload is the update just
// applied, not another one.
test('after «Update now» the reloaded page shows no second bar', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  await page.addInitScript(() => {
    localStorage.setItem('mb_author_asked', '1');
    localStorage.setItem('mb_author_name', 'Test author');
    localStorage.setItem('mb_word_export_settings', JSON.stringify({ templateChooser: false }));
  });
  publish('3.91.0');
  await page.goto('/index.html');
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 20_000 });
  await page.waitForTimeout(800);
  publish('3.91.1');
  await page.goto('/index.html');
  const bar = page.locator('.mb-update-bar.is-open');
  await expect(bar).toBeVisible({ timeout: 20_000 });
  await Promise.all([page.waitForEvent('load'), bar.locator('.mb-update-go').click()]);
  await page.waitForFunction(() => window.mbLib && mbLib.booted === true, null, { timeout: 30_000 });
  await page.waitForTimeout(6000);
  await expect(page.locator('.mb-update-bar.is-open')).toHaveCount(0);
  expect(errors).toEqual([]);
});

// 3.65.2: a real release changes index.html too (?v= on every script).
// Opened after it, the page loads the new files from the network and
// already RUNS the new build; the worker for that build finishes
// installing later (it downloads ~2 MB first, often past the reload
// guard). That is not a new version for this page: no bar offering the
// version it already runs.
function publishPage(version) {
  publish(version);
  const idx = path.join(dir, 'index.html');
  fs.writeFileSync(idx, fs.readFileSync(idx, 'utf8').replace(/\?v=\d+(?:\.\d+)*/g, `?v=${version}`));
}

test('a page already running the release offers no update to that same release', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  await page.addInitScript(() => {
    localStorage.setItem('mb_author_asked', '1');
    localStorage.setItem('mb_author_name', 'Test author');
    localStorage.setItem('mb_word_export_settings', JSON.stringify({ templateChooser: false }));
  });
  publishPage('3.92.0');
  await page.goto('/index.html');
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 20_000 });
  await page.waitForTimeout(800);
  publishPage('3.92.1');
  await page.goto('/index.html');
  // the new worker installs and takes over
  await page.waitForFunction(() => window.__mbSwUpdated === true, null, { timeout: 20_000 });
  await page.waitForTimeout(2500);
  expect(await page.evaluate(() => document.querySelector('script[src*="v="]').getAttribute('src'))).toContain('v=3.92.1');
  await expect(page.locator('.mb-update-bar.is-open')).toHaveCount(0);
  expect(errors).toEqual([]);
});
