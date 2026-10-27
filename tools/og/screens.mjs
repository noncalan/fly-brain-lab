// Screenshots of the deployed lab for status reports (Russian UI, dark theme).
import { chromium, devices } from 'playwright';

const base = process.argv[2] ?? 'https://fly.noncalan.xyz/';
const browser = await chromium.launch({ args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const shots = [
  ['lab-desktop-walk', '?o=DNp09.r:150', { viewport: { width: 1440, height: 1000 } }, 9000],
  ['lab-desktop-sugar', '?s=sugar:150', { viewport: { width: 1440, height: 1000 } }, 9000],
  ['experiments-desktop', 'experiments', { viewport: { width: 1440, height: 1000 } }, 2000],
  ['lab-phone', '?s=looming:150', { ...devices['Pixel 7'] }, 9000],
];
for (const [name, path, opts, wait] of shots) {
  const page = await browser.newPage({ ...opts, colorScheme: 'dark' });
  await page.addInitScript(() => {
    localStorage.setItem('fbl.lang', 'ru');
    localStorage.setItem('fbl.introSeen', '1');
  });
  const t0 = Date.now();
  await page.goto(base + path);
  if (!path.startsWith('experiments')) {
    await page.getByTestId('stim-sugar').waitFor({ timeout: 60000 });
    console.log(`${name}: lab ready in ${Date.now() - t0} ms`);
  }
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `docs/screenshots/${name}.png` });
  await page.close();
}
await browser.close();
