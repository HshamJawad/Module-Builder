// 3.81.0: the installable app — manifest, icons, install bar, offline notice,
// touch-device rules. Service workers stay blocked here (suite default);
// the precache list is checked by smoke.spec.js.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { openApp, fixture, tab } = require('../helpers');

const ROOT = path.join(__dirname, '..', '..');

test('manifest is valid, linked, and every icon it names exists', async ({ page }) => {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
  expect(m.display).toBe('standalone');
  expect(m.start_url).toBeTruthy();
  const sizes = m.icons.map(i => i.sizes + ':' + i.purpose);
  expect(sizes).toEqual(expect.arrayContaining(['192x192:any', '512x512:any', '512x512:maskable']));
  for (const i of m.icons) expect(fs.existsSync(path.join(ROOT, i.src)), i.src).toBe(true);
  const errors = await openApp(page);
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', 'manifest.webmanifest');
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('install bar: appears after the browser offers install, Not now hides it', async ({ page }) => {
  const errors = await openApp(page);
  await page.evaluate(() => {
    const ev = new Event('beforeinstallprompt', { cancelable: true });
    ev.prompt = () => {}; ev.userChoice = Promise.resolve({ outcome: 'dismissed' });
    window.dispatchEvent(ev);
  });
  await expect(page.locator('.mb-pwa-bar')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.mb-pwa-go')).toBeVisible();
  await page.locator('.mb-pwa-later').click();
  await expect(page.locator('.mb-pwa-bar')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('install bar speaks Arabic right-to-left', async ({ page }) => {
  const errors = await openApp(page, { lang: 'ar' });
  await page.evaluate(() => {
    const ev = new Event('beforeinstallprompt', { cancelable: true });
    ev.prompt = () => {}; ev.userChoice = Promise.resolve({ outcome: 'dismissed' });
    window.dispatchEvent(ev);
  });
  const bar = page.locator('.mb-pwa-bar');
  await expect(bar).toBeVisible({ timeout: 15_000 });
  await expect(bar).toHaveAttribute('dir', 'rtl');
  await expect(bar.locator('.mb-pwa-go')).toHaveText('تثبيت');
  expect(errors).toEqual([]);
});

test('offline / online notice', async ({ page, context }) => {
  const errors = await openApp(page);
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect(page.locator('#mb-pwa-notice.is-open.is-offline')).toBeVisible();
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.locator('#mb-pwa-notice.is-online')).toBeVisible();
  expect(errors).toEqual([]);
});

test('standalone mode sets the CSS hook; the page has no horizontal scroll on a phone and a tablet', async ({ page }) => {
  for (const vp of [{ width: 390, height: 844 }, { width: 820, height: 1180 }, { width: 1180, height: 820 }]) {
    await page.setViewportSize(vp);
    const errors = await openApp(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, vp.width + 'px wide').toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  }
});

// 3.81.1: the install bar is at the top of the window, never over the bottom-end helper button.
test('install bar sits at the top, below the toolbar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await openApp(page);
  await page.evaluate(() => {
    const ev = new Event('beforeinstallprompt', { cancelable: true });
    ev.prompt = () => {}; ev.userChoice = Promise.resolve({ outcome: 'dismissed' });
    window.dispatchEvent(ev);
  });
  const bar = page.locator('.mb-pwa-bar');
  await expect(bar).toBeVisible({ timeout: 15_000 });
  const r = await page.evaluate(() => ({
    bar: document.querySelector('.mb-pwa-bar').getBoundingClientRect(),
    tb: document.querySelector('.figma-toolbar').getBoundingClientRect().bottom,
  }));
  expect(r.bar.top).toBeGreaterThanOrEqual(r.tb);
  expect(r.bar.bottom).toBeLessThan(300);
  expect(errors).toEqual([]);
});

// 3.81.1: phones and tablets get the sections as a drawer (like DACUM Live Pro).
for (const [lang, width] of [['en', 390], ['ar', 390], ['en', 820]]) {
  test(`sections drawer: ☰ opens a vertical list, choosing a section closes it (${lang}, ${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors = await openApp(page, { lang });
    const toggle = page.locator('#mb-nav-toggle');
    const nav = page.locator('#mb-sidenav');
    await expect(toggle).toBeVisible();
    await expect(nav).toBeHidden();                       // closed on start
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(nav).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const tabs = await nav.locator('.tabs .tab:visible').evaluateAll(b => b.map(x => Math.round(x.getBoundingClientRect().top)));
    expect(tabs.length).toBeGreaterThan(5);
    expect(new Set(tabs).size).toBe(tabs.length);          // one per row: a list, not a strip
    const box = await nav.boundingBox();
    expect(box.width).toBeLessThanOrEqual(width * 0.87);
    if (lang === 'ar') expect(box.x + box.width).toBeGreaterThanOrEqual(width - 1);   // opens from the right
    await nav.locator('.tab[data-args=\'["references"]\']').click();
    await expect(page.locator('#references-tab')).toHaveClass(/active/);
    await expect(nav).toBeHidden();
    await toggle.click();
    await page.keyboard.press('Escape');
    await expect(nav).toBeHidden();
    await toggle.click();
    await page.locator('#mb-nav-backdrop').click({ position: { x: lang === 'ar' ? 20 : width - 20, y: 400 } });
    await expect(nav).toBeHidden();
    expect(errors).toEqual([]);
  });
}

test('desktop width keeps the fixed rail and ☰ folds it', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const errors = await openApp(page);
  await expect(page.locator('#mb-sidenav')).toBeVisible();
  await expect(page.locator('#mb-nav-close')).toBeHidden();
  await page.locator('#mb-nav-toggle').click();
  await expect(page.locator('#mb-sidenav')).toBeHidden();
  expect(errors).toEqual([]);
});

// 3.81.3: portrait phone — the sheet buttons and the assessment signatures stay inside the screen.
test('portrait phone: sheet buttons and signature table fit the screen', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const errors = await openApp(page, { handoff: fixture('dacum-handoff.json'), contentLang: 'en' });
  for (const [name, sel] of [['info', '#info-tab [data-act="addNewInfoSheet"]'], ['activity', '#activity-tab [data-act="addNewActivitySheet"]']]) {
    await tab(page, name);
    const b = await page.locator(sel).boundingBox();
    expect(b.x, name).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width, name).toBeLessThanOrEqual(361);
  }
  await tab(page, 'assessment');
  const cells = await page.locator('#assessment-tab .mb-sig-grid > div').evaluateAll(d => d.map(e => { const r = e.getBoundingClientRect(); return [r.left, r.right]; }));
  expect(cells.length).toBe(6);
  for (const [l, r] of cells) { expect(l).toBeGreaterThanOrEqual(0); expect(r).toBeLessThanOrEqual(361); }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});
