import { expect, test } from '@playwright/test';

test('loads in every language, has no horizontal scroll and no console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Network failures are checked by URL below; Vercel Analytics' script only exists on Vercel itself.
  page.on('console', (m) => m.type() === 'error' && !m.text().startsWith('Failed to load resource') && errors.push(m.text()));
  page.on('response', (r) => r.status() >= 400 && !r.url().includes('/_vercel/') && errors.push(`${r.status()} ${r.url()}`));
  await page.goto('/');
  await expect(page.getByTestId('stim-sugar')).toBeVisible({ timeout: 60_000 });
  for (const [lang, word] of [['ru', 'Сахар'], ['kk', 'Қант'], ['en', 'Sugar']] as const) {
    await page.getByRole('button', { name: lang, exact: true }).click();
    await expect(page.getByTestId('stim-sugar')).toContainText(word);
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.getByRole('link', { name: 'About' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('About');
  expect(errors).toEqual([]);
});

test('time controls pause and step the simulation', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('stim-sugar')).toBeVisible({ timeout: 60_000 });
  await page.getByTestId('pause').click();
  const status = page.getByTestId('time-status');
  await expect(status).toContainText(/paused|пауза|кідіртілді/);
  const before = await status.textContent();
  await page.getByRole('button', { name: /10 (ms|мс)/ }).click();
  await expect(status).not.toHaveText(before ?? '');
});
