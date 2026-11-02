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

test('lesson: steps, quiz score and teacher mode', async ({ page }) => {
  await page.goto('/lessons');
  await page.getByTestId('lesson-open-switching').click();
  await expect(page).toHaveURL(/l=switching/);
  await expect(page.getByTestId('lesson-progress')).toContainText('Step 1 of 4');
  await page.getByTestId('teacher-toggle').click();
  await expect(page.getByTestId('lesson')).toHaveClass(/fixed/);
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('lesson-progress')).toContainText('Step 2 of 4');
  await expect(page.getByTestId('lesson-demo')).toHaveAttribute('href', '/?o=MDN:150');
  await page.getByTestId('teacher-toggle').click();
  await expect(page.getByTestId('lesson')).not.toHaveClass(/fixed/);
  for (let i = 0; i < 3; i++) await page.getByTestId('lesson-next').click();
  for (const i of [0, 1]) {
    await page.getByTestId(`quiz-q${i}`).getByRole('radio').first().check(); // the first option is the right one
    await page.getByTestId(`quiz-check${i}`).click();
  }
  await expect(page.getByTestId('quiz-score')).toContainText('2 of 2 correct');
});

test('memory lesson demo: Kenyon cell optogenetics lights up the mushroom body', async ({ page }) => {
  await page.goto('/?o=KCg-m:150');
  await expect(page.getByTestId('stim-sugar')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('list', { name: /Activity by region now/ }).locator('li').first()).toContainText(/^MB_/, { timeout: 30_000 });
});

test('game fly: clearly labelled as a game, a clap makes it flee, a click on the fly is a hit', async ({ page }) => {
  await page.goto('/play');
  await expect(page.getByTestId('play-banner')).toContainText(/game/i);
  await page.waitForTimeout(2000); // fly model loads
  await page.getByTestId('play-clap').click();
  await expect(page.getByTestId('play-mode')).toHaveText(/fleeing/i, { timeout: 2000 });
  await expect(page.getByTestId('play-mode')).toHaveText(/landing|standing|wandering|grooming|exploring|flying|resting/i, { timeout: 15_000 });
  // the wide camera keeps the fly in the middle of the arena view once it has landed
  await page.waitForTimeout(2500);
  const box = (await page.getByTestId('play-arena').boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByTestId('play-hits')).toHaveText('1', { timeout: 3000 });
  await expect(page.getByTestId('play-need-pain')).not.toHaveText('0');
});
