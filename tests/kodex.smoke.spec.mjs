import { test, expect, devices } from '@playwright/test';

const BASE = process.env.KODEX_BASE_URL || 'https://kodex.meiocg.org';

test.describe.configure({ mode: 'serial' });

test('production root loads and initializes without page errors', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  const failedCoreResponses = [];
  page.on('response', response => {
    const url = response.url();
    if (response.status() >= 400 &&
        (url.includes('/indexes/search.json') || /\/data\/rulings\/cards\/\d+\.json/.test(url))) {
      failedCoreResponses.push(`${response.status()} ${url}`);
    }
  });

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveTitle(/Duel Synapse KodeX/i);
  await expect(page.locator('#q')).toBeVisible();
  await expect(page.locator('#count')).toContainText(/cards/i, { timeout: 20000 });
  // Initial state intentionally has no results until a search is entered.

  expect(pageErrors, pageErrors.join('\n')).toEqual([]);
  expect(failedCoreResponses, failedCoreResponses.join('\n')).toEqual([]);
});

test('search, card opening, ruling Q&A, and filters work', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#count')).toContainText(/cards/i, { timeout: 20000 });

  await page.locator('#q').fill('8076');
  await expect(page.locator('.result').first()).toBeVisible({ timeout: 10000 });
  await page.locator('.result').first().click();

  await expect(page.locator('#detail h2')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#status')).toHaveText(/\d+ Q&A/, { timeout: 15000 });
  await expect(page.locator('.qa').first()).toBeVisible();
  await page.locator('.qat').first().click();
  await expect(page.locator('.qa.open .qab')).toBeVisible();

  await page.locator('[data-filter="Monster"]').click();
  await expect(page.locator('[data-filter="Monster"]')).toHaveClass(/active/);
  await page.locator('[data-filter="all"]').click();
  await expect(page.locator('[data-filter="all"]')).toHaveClass(/active/);

  expect(pageErrors, pageErrors.join('\n')).toEqual([]);
});

test('settings panel opens and mobile card view works', async ({ browser }) => {
  const context = await browser.newContext(devices['Pixel 5']);
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#count')).toContainText(/cards/i, { timeout: 20000 });

  await page.locator('#settingsFab').click();
  await expect(page.locator('#settingsPanel')).toBeVisible();
  await expect(page.locator('#settingsFab')).toHaveAttribute('aria-expanded', 'true');

  await page.locator('#q').fill('8076');
  await expect(page.locator('.result').first()).toBeVisible({ timeout: 10000 });
  await page.locator('.result').first().click();
  await expect(page.locator('.detail')).toBeVisible({ timeout: 10000 });

  expect(pageErrors, pageErrors.join('\n')).toEqual([]);
  await context.close();
});
