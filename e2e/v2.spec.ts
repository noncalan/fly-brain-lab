import { expect, test } from '@playwright/test';

test.use({ launchOptions: { args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] } });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fbl.lang', 'en');
    localStorage.setItem('fbl.introSeen', '1');
  });
});

test('spike sound switches on, picks the most active region and switches off', async ({ page }) => {
  await page.goto('/?s=sugar:150');
  await expect(page.getByTestId('stim-sugar')).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(2000);
  const toggle = page.getByTestId('sonify-toggle');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('sonify-region')).not.toHaveValue('all');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
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

test('scale page lists sourced numbers with DOI links', async ({ page }) => {
  await page.goto('/scale');
  await expect(page.getByTestId('scale-brains')).toContainText('139,255');
  await expect(page.getByTestId('scale-brains')).toContainText('86,100,000,000');
  await expect(page.getByTestId('scale-datasets').getByRole('link', { name: /Zheng/ })).toHaveAttribute('href', 'https://doi.org/10.1016/j.cell.2018.06.019');
  await expect(page.getByTestId('scale-ratio')).toContainText(/10 million times less/);
});
