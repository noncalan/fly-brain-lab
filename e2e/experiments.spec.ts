import { expect, test } from '@playwright/test';
import experimentsConfig from '../config/experiments.json' with { type: 'json' };

test.use({ launchOptions: { args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] } });

// Cards whose published effect this model does not reproduce (MODEL_NOTES; the lab must say so instead).
const NOT_REPRODUCED: Record<string, string> = { water_feeding: 'water' };
// Cards that show a behaviour being suppressed or removed.
const MUST_BE_OFF: Record<string, string[]> = { sugar_bitter: ['feeding'], lesion_gng: ['feeding'] };

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fbl.lang', 'en');
    localStorage.setItem('fbl.introSeen', '1');
  });
});

for (const x of experimentsConfig.experiments) {
  test(`experiment ${x.id} opens from its card and shows the model's response`, async ({ page }) => {
    await page.goto('/experiments');
    await page.getByTestId(`exp-${x.id}`).getByRole('link', { name: 'Open in the lab' }).click();
    const want = new URLSearchParams(x.query);
    await expect.poll(() => new URL(page.url()).searchParams.toString()).toBe(want.toString());
    await expect(page.getByTestId('stim-sugar')).toBeVisible({ timeout: 60_000 });
    if (x.id in NOT_REPRODUCED) {
      await expect(page.getByTestId(`not-reproduced-${NOT_REPRODUCED[x.id]}`)).toBeVisible({ timeout: 30_000 });
      return;
    }
    for (const b of x.expect) {
      // fast forward walking is labelled "running"; either counts as walking forward
      const selector = b === 'walk_forward' ? '[data-behavior="walk_forward"][data-active="true"], [data-behavior="run"][data-active="true"]' : `[data-behavior="${b}"][data-active="true"]`;
      await expect(page.locator(selector).first()).toBeVisible({ timeout: 30_000 });
    }
    if (x.id in MUST_BE_OFF) {
      await page.waitForTimeout(3000);
      for (const b of MUST_BE_OFF[x.id]) await expect(page.locator(`[data-behavior="${b}"]`)).toHaveAttribute('data-active', 'false');
    }
  });
}
