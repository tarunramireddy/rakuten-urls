import { test, expect, type Page } from '@playwright/test';
import * as XLSX from 'xlsx';
import * as path from 'path';

// Normalize domain for comparison
function normalizeDomain(url: string): string {
  try {
    const { hostname } = new URL(url.trim());
    return hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return url.trim().replace(/^www\./, '').toLowerCase();
  }
}

// Wait actively for redirect to merchant
async function waitForRedirectToMerchant(page: Page, expectedDomain: string, timeout = 30000) {
  const normalizedExpected = normalizeDomain(expectedDomain);
  const start = Date.now();
  let lastUrl = '';

  while (Date.now() - start < timeout) {
    const currentUrl = page.url();
    const currentDomain = normalizeDomain(currentUrl);

    if (currentDomain.endsWith(normalizedExpected)) {
      console.log(`Reached merchant domain: ${currentDomain}`);
      return;
    }

    if (currentUrl !== lastUrl) {
      console.log(`Redirecting: ${currentUrl}`);
      lastUrl = currentUrl;
    }

    await page.waitForTimeout(1000);
  }

  throw new Error(
    `Timed out waiting for redirect to merchant domain (${normalizedExpected}). Last URL: ${page.url()}`
  );
}

// Excel parsing
interface Store {
  store_id: number;
  store_name: string;
  xfas_url: string;
  merchant_site_url: string;
  network_id: number;
}

function readExcelFile(filePath: string): Store[] {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  return rows
    .map((r, idx) => ({
      store_id: Number(r['store_id'] ?? idx + 1),
      store_name: String(r['store_name'] ?? ''),
      xfas_url: String(r['xfas_url'] ?? ''),
      merchant_site_url: String(r['merchant_site_url'] ?? ''),
      network_id: Number(r['network_id'] ?? 0),
    }))
    .filter(s => s.xfas_url && s.merchant_site_url);
}

// Rakuten sign-in (with reCAPTCHA)
async function attemptRakutenSignIn(page: Page) {
  try {
    console.log('Starting Rakuten sign-in...');
    await page.goto('https://www.rakuten.com/', { waitUntil: 'domcontentloaded' });
    await page.locator('#sign_in_header_button').click({ timeout: 5000 });
    await page.waitForTimeout(2000);

    const signInFrame = page.frameLocator('#appshell-auth-modal-iframe');
    await signInFrame.locator('#emailAddress').fill("zmzh5lra0a@zudpck.com");
    await signInFrame.locator('#password').fill("Reddy!2k25");

    // reCAPTCHA
    console.log('Checking for reCAPTCHA...');
    const recaptchaFrame = signInFrame.frameLocator('iframe[title="reCAPTCHA"]');
    const recaptchaCheckbox = recaptchaFrame.locator('[role="checkbox"]');

    if (await recaptchaCheckbox.isVisible({ timeout: 3000 }).catch(() => false)) {
      await page.waitForTimeout(7000);
      console.log('reCAPTCHA detected — clicking...');
      await recaptchaCheckbox.click({ delay: 200 });
      await page.waitForTimeout(15000);
    } else {
      console.log('No reCAPTCHA detected');
    }

    await signInFrame.locator('#email-auth-btn').click();
    await page.waitForTimeout(4000);
    console.log('Sign-in completed');
  } catch (error) {
    console.log('Sign-in skipped or failed:', (error as Error).message);
  }
}

// MAIN TEST
test.describe('Shopping Trip Redirection Tests', () => {
  test.describe.configure({ mode: 'serial' });

  const excelFilePath = path.resolve(process.cwd(), 'shopping_trip_redirection.xlsx');
  const stores = readExcelFile(excelFilePath);

  let sharedContext: any;
  let sharedPage: Page;

  test.beforeAll(async ({ browser }) => {
    sharedContext = await browser.newContext();
    sharedPage = await sharedContext.newPage();
    await attemptRakutenSignIn(sharedPage);
  });

  test.afterAll(async () => {
    if (sharedContext) await sharedContext.close();
  });

  for (const store of stores) {
    test(`${store.store_name} (ID: ${store.store_id})`, async ({}, testInfo) => {
      test.setTimeout(70000);
      console.log(`\nTesting: ${store.store_name} (ID: ${store.store_id})`);
      console.log(`Visiting Xfas URL: ${store.xfas_url}`);

      await sharedPage.goto(store.xfas_url, { waitUntil: 'domcontentloaded' });

      // Screenshot 1: Rakuten landing page
      const rakutenShot = path.join(testInfo.outputDir, `rakuten-${store.store_id}.png`);
      await sharedPage.waitForLoadState('networkidle', { timeout: 10000 });
      await sharedPage.waitForTimeout(2000);
      await sharedPage.screenshot({ path: rakutenShot, fullPage: true });
      await testInfo.attach('Rakuten Redirect Start', { path: rakutenShot, contentType: 'image/png' });

      // Wait for redirect to merchant
      await waitForRedirectToMerchant(sharedPage, store.merchant_site_url, 45000);

      // Wait for full load on merchant site with fallback
      try {
        await sharedPage.waitForLoadState('domcontentloaded', { timeout: 5000 });
        await sharedPage.waitForLoadState('networkidle', { timeout: 5000 });
        await sharedPage.waitForTimeout(3000); // buffer wait for dynamic content
        console.log('Page fully loaded');
      } catch (error) {
        console.log('Page did not fully load within 10 seconds, taking screenshot and continuing...');
        const timeoutShot = path.join(testInfo.outputDir, `timeout-${store.store_id}.png`);
        await sharedPage.screenshot({ path: timeoutShot, fullPage: true });
        await testInfo.attach('Page Load Timeout', { path: timeoutShot, contentType: 'image/png' });
      }

      // Screenshot 2: Final merchant page (fully loaded or timeout)
      const merchantShot = path.join(testInfo.outputDir, `merchant-${store.store_id}.png`);
      await sharedPage.screenshot({ path: merchantShot, fullPage: true });
      await testInfo.attach('Merchant Redirect Complete', { path: merchantShot, contentType: 'image/png' });

      // Verify final domain
      const finalUrl = sharedPage.url();
      const finalDomain = normalizeDomain(finalUrl);
      const expectedDomain = normalizeDomain(store.merchant_site_url);

      expect(finalDomain.endsWith(expectedDomain)).toBeTruthy();

      console.log(`${store.store_name} - Redirected successfully to ${finalDomain}`);
    });
  }
});
