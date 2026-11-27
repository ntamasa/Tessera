import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const root = execSync('npm root -g').toString().trim();
const { chromium } = require(root + '/playwright');
const [, , html, pdf, png] = process.argv;
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file:///' + html.replace(/\\/g, '/'));
await page.waitForTimeout(300);
await page.pdf({
  path: pdf, format: 'A4', printBackground: true, preferCSSPageSize: true,
  displayHeaderFooter: true, headerTemplate: '<span></span>',
  footerTemplate: '<div style="font-size:7px;color:#9ca3af;width:100%;padding:0 15mm;display:flex;justify-content:space-between;font-family:Segoe UI,Arial"><span>AI Factory: workflow guide</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
});
if (png) {
  await page.setViewportSize({ width: 794, height: 1123 });
  await page.screenshot({ path: png, fullPage: true });
}
await browser.close();
