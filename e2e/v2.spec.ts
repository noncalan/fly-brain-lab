import { expect, test } from '@playwright/test';

test.use({ launchOptions: { args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] } });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fbl.lang', 'en');
    localStorage.setItem('fbl.introSeen', '1');
  });
});

test('compress: merged 4-bit model is smaller and keeps sugar feeding; strong-only pruning loses it', async ({ page }) => {
  await page.goto('/compress');
  await expect(page.getByTestId('zip-size-b-ratio')).toContainText(/smaller/, { timeout: 60_000 });
  await expect(page.getByTestId('zip-merge')).toBeChecked();
  await expect(page.getByTestId('beh-a')).toContainText(/feeding/, { timeout: 30_000 });
  await expect(page.getByTestId('beh-b')).toContainText(/feeding/, { timeout: 30_000 });
  await expect(page.getByTestId('zip-verdict')).toContainText(/kept/);
  const ratio = await page.getByTestId('zip-size-b-ratio').innerText();
  expect(parseFloat(ratio.replace(',', '.'))).toBeGreaterThan(3);

  await page.getByTestId('zip-preset-strong').click();
  await expect(page.getByTestId('zip-merge')).not.toBeChecked();
  await expect(page.getByTestId('beh-b')).not.toContainText(/feeding/, { timeout: 30_000 });
  await expect(page.getByTestId('zip-verdict')).toContainText(/lost|partly/i);
});
