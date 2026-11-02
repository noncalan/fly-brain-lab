// Screenshots of the deployed lab for status reports (Russian UI, dark theme).
// usage: node tools/og/screens.mjs [base-url] [name-filter]
import { chromium, devices } from 'playwright';

const base = process.argv[2] ?? 'https://fly.noncalan.xyz/';
const only = process.argv[3];
const browser = await chromium.launch({ args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const desktop = { viewport: { width: 1440, height: 1000 } };
const phone = { ...devices['Pixel 7'] };
// [name, path, context options, ms to wait after the page is ready, test id that marks "ready"]
const shots = [
  ['lab-desktop-walk', '?o=DNp09.r:150', desktop, 9000, 'stim-sugar'],
  ['lab-desktop-sugar', '?s=sugar:150', desktop, 9000, 'stim-sugar'],
  ['experiments-desktop', 'experiments', desktop, 2000, null],
  ['lab-phone', '?s=looming:150', phone, 9000, 'stim-sugar'],
  ['compress-desktop', 'compress', desktop, 6000, 'zip-size-b-ratio'],
  ['compress-phone', 'compress', phone, 6000, 'zip-size-b-ratio'],
  ['scale-desktop', 'scale', desktop, 1000, 'scale-brains'],
  ['scale-phone', 'scale', phone, 1000, 'scale-brains'],
  ['lessons-desktop', 'lessons?l=switching', desktop, 1000, 'lesson-step'],
  ['lessons-phone', 'lessons?l=pathway', phone, 1000, 'lesson-step'],
  ['play-desktop', 'play', desktop, 4000, 'play-mode'],
  ['play-phone', 'play', phone, 4000, 'play-mode'],
];
for (const [name, path, opts, wait, ready] of shots) {
  if (only && !name.includes(only)) continue;
  const page = await browser.newPage({ ...opts, colorScheme: 'dark' });
  await page.addInitScript(() => {
    localStorage.setItem('fbl.lang', 'ru');
    localStorage.setItem('fbl.introSeen', '1');
  });
  const t0 = Date.now();
  await page.goto(base + path);
  if (ready) {
    await page.getByTestId(ready).waitFor({ timeout: 90000 });
    console.log(`${name}: ready in ${Date.now() - t0} ms`);
  }
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `docs/screenshots/${name}.png` });
  await page.close();
}
await browser.close();
