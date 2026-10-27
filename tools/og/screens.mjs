// Desktop and phone screenshots of the deployed lab (Russian UI, sugar on) for status reports.
import { chromium, devices } from 'playwright';

const base = process.argv[2] ?? 'https://fly.noncalan.xyz/';
const browser = await chromium.launch({ args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
for (const [name, opts] of [
  ['desktop', { viewport: { width: 1440, height: 1000 }, colorScheme: 'dark' }],
  ['phone', { ...devices['Pixel 7'], colorScheme: 'dark' }],
]) {
  const page = await browser.newPage(opts);
  await page.addInitScript(() => localStorage.setItem('fbl.lang', 'ru'));
  await page.goto(base);
  await page.getByTestId('stim-sugar').waitFor({ timeout: 60000 });
  await page.getByTestId('stim-sugar').click();
  await page.locator('[data-behavior="feeding"][data-active="true"]').waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `docs/screenshots/lab-${name}.png` });
  if (name === 'phone') {
    // second phone screen: the brain and signal path, as a user sees them after scrolling
    await page.getByRole('region', { name: /Мозг/ }).scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'docs/screenshots/lab-phone-brain.png' });
  }
  await page.close();
}
await browser.close();
console.log('saved');
