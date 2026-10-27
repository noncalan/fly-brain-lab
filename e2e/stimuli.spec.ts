import { expect, test } from '@playwright/test';
import stimuliConfig from '../config/stimuli.json' with { type: 'json' };

// Water is expected to trigger feeding, but the v783 model does not reproduce it (docs/MODEL_NOTES.md).
const MODEL_REPRODUCES: Record<string, string[]> = {
  sugar: ['feeding'],
  water: [],
  bitter: [],
  heat: [],
  antenna_touch: ['antennal_grooming'],
  looming: ['escape'],
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('fbl.lang', 'en'));
  await page.goto('/');
  await expect(page.getByTestId('stim-sugar')).toBeVisible({ timeout: 60_000 });
});

for (const s of stimuliConfig.stimuli) {
  test(`stimulus ${s.id} gives the model's real response`, async ({ page }) => {
    await page.getByTestId(`stim-${s.id}`).click();
    await expect(page.getByTestId(`stim-${s.id}`)).toHaveAttribute('aria-pressed', 'true');
    const expected = MODEL_REPRODUCES[s.id];
    for (const b of expected) {
      await expect(page.locator(`[data-behavior="${b}"]`)).toHaveAttribute('data-active', 'true');
    }
    if (s.expects.length > 0 && expected.length === 0) {
      await expect(page.getByTestId(`not-reproduced-${s.id}`)).toBeVisible();
    }
    if (expected.length === 0) {
      // give the model a few seconds and make sure nothing fires spuriously
      await page.waitForTimeout(3000);
      await expect(page.locator('[data-behavior][data-active="true"]')).toHaveCount(0);
    }
    await page.getByTestId(`stim-${s.id}`).click();
    await expect(page.getByTestId(`stim-${s.id}`)).toHaveAttribute('aria-pressed', 'false');
  });
}

test('dragging a stimulus onto the fly turns it on', async ({ page }) => {
  const chip = page.getByTestId('stim-sugar');
  const fly = page.getByTestId('fly');
  await chip.hover();
  await page.mouse.down();
  const box = (await fly.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-behavior="feeding"]')).toHaveAttribute('data-active', 'true');
});
