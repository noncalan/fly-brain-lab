import { expect, test } from '@playwright/test';

const MIN_FPS = 30;

// Headless Chromium renders WebGL in software (SwiftShader), which measures the CPU, not a laptop GPU.
// Use the real GPU through ANGLE/D3D11 so the number reflects what a user's laptop does.
test.use({ launchOptions: { args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] } });
test.beforeEach(async ({ page }) => page.addInitScript(() => localStorage.setItem('fbl.introSeen', '1')));

test('UI stays above 30 FPS while the heaviest stimulus runs', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('stim-looming')).toBeVisible({ timeout: 60_000 });
  await page.getByTestId('stim-looming').click();
  await page.waitForTimeout(2000);
  const fps = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let frames = 0;
        const t0 = performance.now();
        const tick = () => {
          frames++;
          if (performance.now() - t0 < 5000) requestAnimationFrame(tick);
          else resolve((frames * 1000) / (performance.now() - t0));
        };
        requestAnimationFrame(tick);
      }),
  );
  console.info(`UI FPS with looming stimulus: ${fps.toFixed(1)}`);
  expect(fps).toBeGreaterThanOrEqual(MIN_FPS);
});

test('first load finishes quickly on a local server', async ({ page }) => {
  const t0 = Date.now();
  await page.goto('/');
  await expect(page.getByTestId('stim-sugar')).toBeVisible({ timeout: 60_000 });
  console.info(`time to interactive lab (local, no throttling): ${Date.now() - t0} ms`);
});
