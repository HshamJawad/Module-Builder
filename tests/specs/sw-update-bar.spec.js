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
