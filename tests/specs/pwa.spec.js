// 3.81.0: the installable app — manifest, icons, install bar, offline notice,
// touch-device rules. Service workers stay blocked here (suite default);
// the precache list is checked by smoke.spec.js.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { openApp } = require('../helpers');

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
