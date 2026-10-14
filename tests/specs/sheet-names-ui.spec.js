// 3.44.0: a sheet name typed in Settings → Misc for the interface language
// shows in the tool too — tabs, side navigation, the sheet's labels and
// buttons — not only in the exported files.
const { test, expect } = require('@playwright/test');
const { openApp, fixture, tab } = require('../helpers');

async function saveNames(page, names) {
  await page.locator('#mb-settings-nav').click();
  const ov = page.locator('#ws-overlay');
  await ov.locator('.ws-nav-btn[data-ws-pane="misc"]').click();
  for (const [k, v] of Object.entries(names)) await ov.locator(`input[data-ws-label="${k}"]`).fill(v);
  await ov.locator('#ws-save').click();
  await ov.locator('#ws-close').click();
}

test('Arabic: «المعرفة» and «نشاط تعليمي» on the tabs and in the sheets; empty keeps the default', async ({ page }) => {
  const errors = await openApp(page, { lang: 'ar', contentLang: 'ar', handoff: fixture('dacum-handoff.json') });
  const infoTab = page.locator('#mb-sidenav .tab[data-args=\'["info"]\']');
  const actTab = page.locator('#mb-sidenav .tab[data-args=\'["activity"]\']');
  await expect(infoTab).toHaveText('ورقة المعلومات');
  await saveNames(page, { 'ar:info': 'المعرفة', 'ar:activity': 'نشاط تعليمي' });
  await expect(infoTab).toHaveText('المعرفة');
  await expect(actTab).toHaveText('نشاط تعليمي');
  await tab(page, 'info');
  await expect(page.locator('label[for="info-title"]')).toHaveText('عنوان المعرفة:');
  await expect(page.locator('[data-act="addNewInfoSheet"]')).toHaveText('➕ إضافة المعرفة');
  await tab(page, 'activity');
  await expect(page.locator('label[for="title"]')).toHaveText('عنوان نشاط تعليمي:');
  // the open sheet's own type names its title field
  await page.locator('#activity-sheet-type').selectOption('job');
  await expect(page.locator('label[for="title"]')).toHaveText('عنوان ورقة العمل:');
  // a reload keeps them (settings are the tool's)
  await page.reload();
  await page.waitForFunction(() => window.mbLib && window.mbLib.booted === true);
  await expect(page.locator('#mb-sidenav .tab[data-args=\'["info"]\']')).toHaveText('المعرفة');
  expect(errors).toEqual([]);
});

test('English interface: names typed only for Arabic change nothing in English', async ({ page }) => {
  const errors = await openApp(page, { lang: 'en' });
  await saveNames(page, { 'ar:info': 'المعرفة' });
  await expect(page.locator('#mb-sidenav .tab[data-args=\'["info"]\']')).toHaveText('Information Sheet');
  await saveNames(page, { 'en:info': 'Knowledge' });
  await expect(page.locator('#mb-sidenav .tab[data-args=\'["info"]\']')).toHaveText('Knowledge');
  await tab(page, 'info');
  await expect(page.locator('label[for="info-title"]')).toHaveText('Knowledge title:');
  expect(errors).toEqual([]);
});
