// Renders public/og.png (1200x630) from the running lab: dark theme, English, sugar stimulus on.
// Usage: npx vite preview --port 4173 & node tools/og/make-og.mjs [baseUrl]
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:4173/';
const browser = await chromium.launch({ args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, colorScheme: 'dark' });
await page.addInitScript(() => {
  localStorage.setItem('fbl.lang', 'en');
  localStorage.setItem('fbl.theme', 'dark');
});
await page.goto(base);
await page.getByTestId('stim-sugar').waitFor({ timeout: 60000 });
await page.getByTestId('stim-sugar').click();
await page.locator('[data-behavior="feeding"][data-active="true"]').waitFor({ timeout: 30000 });
// fit fly, stimuli and brain into 1200x630
await page.evaluate(() => { document.body.style.zoom = '0.72'; });
await page.waitForTimeout(1500);
await page.screenshot({ path: 'public/og.png' });
await browser.close();
console.log('wrote public/og.png');
