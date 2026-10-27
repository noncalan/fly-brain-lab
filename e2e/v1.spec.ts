import { expect, test } from '@playwright/test';

test.use({ launchOptions: { args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] } });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fbl.lang', 'en');
    localStorage.setItem('fbl.introSeen', '1');
  });
});

test('neuron inspector opens from a click in the 3D brain and lists connections', async ({ page }) => {
  await page.goto('/?s=sugar:150');
  await expect(page.getByTestId('stim-sugar')).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(4000); // meshes + atlas
  const box = (await page.getByTestId('brain').boundingBox())!;
  for (const [fx, fy] of [[0.5, 0.5], [0.45, 0.55], [0.55, 0.45], [0.4, 0.5], [0.6, 0.5], [0.5, 0.6]]) {
    await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
    if (await page.getByTestId('inspector').isVisible()) break;
  }
  await expect(page.getByTestId('inspector')).toBeVisible();
  await expect(page.getByTestId('inspector')).toContainText(/Strongest inputs/);
  await expect(page.getByTestId('inspector').getByRole('link', { name: /Codex/ })).toHaveAttribute('href', /codex\.flywire\.ai.*7205759/);
});

test('raster, heatmap and exports work', async ({ page }) => {
  await page.goto('/?s=sugar:150');
  await expect(page.getByTestId('stim-sugar')).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(3000);
  await page.getByTestId('hist-heatmap').click();
  await expect(page.getByTestId('history-canvas')).toBeVisible();
  const csv = page.waitForEvent('download');
  await page.getByTestId('export-csv').click();
  const csvFile = await csv;
  expect(csvFile.suggestedFilename()).toMatch(/\.csv$/);
  const text = await (await csvFile.createReadStream()).toArray().then((c) => Buffer.concat(c).toString());
  expect(text.split('\n')[0]).toContain('set_mn9_hz');
  expect(text.split('\n').length).toBeGreaterThan(10);
  const png = page.waitForEvent('download');
  await page.getByTestId('export-png').click();
  expect((await png).suggestedFilename()).toMatch(/\.png$/);
  const gif = page.waitForEvent('download', { timeout: 30_000 });
  await page.getByTestId('export-gif').click();
  expect((await gif).suggestedFilename()).toMatch(/\.gif$/);
});

test('compare: fly B with the GNG silenced loses sugar feeding', async ({ page }) => {
  await page.goto('/compare');
  await expect(page.getByTestId('beh-a')).toContainText('Proboscis', { timeout: 90_000 });
  await expect(page.getByTestId('cmp-verdict')).toContainText(/lost|partly/i, { timeout: 30_000 });
  await page.getByTestId('cmp-lesion').selectOption('');
  await expect(page.getByTestId('cmp-verdict')).toContainText(/kept/, { timeout: 30_000 });
});
