import { chromium } from 'playwright';
const [url, out, n, gap] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
await page.addInitScript(() => { localStorage.setItem('fbl.introSeen', '1'); localStorage.setItem('fbl.lang', 'ru'); });
await page.goto(url);
await page.getByTestId('fly').waitFor();
await page.waitForTimeout(6000);
const box = await page.getByTestId('fly').boundingBox();
for (let i = 0; i < +n; i++) { await page.screenshot({ path: `${out}_${i}.png`, clip: box }); await page.waitForTimeout(+gap); }
await browser.close();
