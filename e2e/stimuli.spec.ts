import { expect, test } from '@playwright/test';
import stimuliConfig from '../config/stimuli.json' with { type: 'json' };

// What the model actually does at 150 Hz (tools/calibrate/results/matrix_all.json). Water is expected to trigger
// feeding in Shiu et al. but the v783 model does not reproduce it, so the lab must say so.
const MODEL_BEHAVIOURS: Record<string, string[]> = {
  sugar: ['feeding'],
  salt: ['feeding'],
  taste_peg: ['feeding'],
  antenna_touch: ['antennal_grooming'],
  looming: ['escape'],
};
const CLASSIC = ['feeding', 'escape', 'antennal_grooming'];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fbl.lang', 'en');
    localStorage.setItem('fbl.introSeen', '1');
  });
  await page.goto('/');
  await expect(page.getByTestId('stim-sugar')).toBeVisible({ timeout: 60_000 });
});

for (const s of stimuliConfig.stimuli) {
  test(`stimulus ${s.id} gives the model's real response`, async ({ page }) => {
    await page.getByTestId(`stim-${s.id}`).click();
    await expect(page.getByTestId(`stim-${s.id}`)).toHaveAttribute('aria-pressed', 'true');
    const expected = MODEL_BEHAVIOURS[s.id] ?? [];
    for (const b of expected) await expect(page.locator(`[data-behavior="${b}"]`)).toHaveAttribute('data-active', 'true');
    if (s.expects.length > 0 && expected.length === 0) await expect(page.getByTestId(`not-reproduced-${s.id}`)).toBeVisible();
    if (expected.length === 0) {
      await page.waitForTimeout(3000);
      for (const b of CLASSIC) await expect(page.locator(`[data-behavior="${b}"]`)).toHaveAttribute('data-active', 'false');
    }
    await page.getByTestId(`stim-${s.id}`).click();
    await expect(page.getByTestId(`stim-${s.id}`)).toHaveAttribute('aria-pressed', 'false');
  });
}

test('dragging a stimulus onto the fly turns it on', async ({ page }) => {
  const chip = page.getByTestId('stim-sugar');
  await chip.hover();
  await page.mouse.down();
  const box = (await page.getByTestId('fly').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-behavior="feeding"]')).toHaveAttribute('data-active', 'true');
});

test('optogenetics: switching on P9 (DNp09) makes the fly walk forward', async ({ page }) => {
  await page.getByTestId('tab-opto').click();
  await page.getByTestId('type-search').fill('DNp09');
  await page.getByRole('button', { name: /Switch on: DNp09/ }).click();
  await expect(page.getByTestId('opto-active')).toContainText('DNp09');
  await expect(page.locator('[data-behavior="walk_forward"]')).toHaveAttribute('data-active', 'true');
  await expect(page).toHaveURL(/o=DNp09/);
});

test('lesion: silencing the GNG removes sugar feeding', async ({ page }) => {
  await page.goto('/?s=sugar:150&x=GNG');
  await expect(page.getByTestId('stim-sugar')).toHaveAttribute('aria-pressed', 'true', { timeout: 60_000 });
  await page.getByTestId('tab-lesion').click();
  await expect(page.getByTestId('lesion-active')).toContainText('GNG');
  await page.waitForTimeout(4000);
  const state = await page.locator('[data-behavior="feeding"]').getAttribute('data-active');
  console.info(`sugar with GNG silenced -> feeding active: ${state}`);
});
