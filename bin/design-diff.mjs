#!/usr/bin/env node
// Usage: design-diff.mjs <repo> <ticket> [--component <name>] [--threshold <ratio>]
//
// The visual check's gate: "match the design in every way", measured. For every
// design/routes.json entry of the ticket and every viewport of the component's ui block:
//   1. renders the design reference (HTML, optionally with a #state fragment, or an image;
//      "{width}" in an image path is replaced by the viewport width) and the real app route,
//   2. compares full-page screenshots with pixelmatch: fails above the threshold (default 1.5%
//      of pixels, or ui.diff_threshold in AGENTS.md),
//   3. runs structural checks pixels can't catch: no horizontal scroll, no overlapping
//      interactive elements, text within its container, tap targets >= 44px on the smallest
//      viewport, and every design token (color, background, font size and weight, spacing)
//      the HTML design uses also used by the app.
// Writes design/actual/diff screenshots and result.json to <data>/screenshots/<ticket>/.
// Exit code: 0 pass, 1 differences, 2 usage or setup error.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import {
  DEFAULT_VIEWPORTS, UsageError, loadConfig, loadRoutes, parseArgs, pickComponent, run, runSetup,
  screenshotDir, startApp,
} from './lib/ui.mjs';

const USAGE = 'design-diff.mjs <repo> <ticket> [--component <name>] [--threshold <ratio>]';
const TOKEN_PROPS = ['color', 'background-color', 'font-size', 'font-weight', 'padding', 'margin', 'gap'];

// Runs in the page. Problems a pixel diff can't see.
function structuralChecks({ checkTapTargets }) {
  const issues = [];
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  const describe = (el) => {
    const text = el.textContent.trim().replace(/\s+/g, ' ').slice(0, 40);
    return el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '')
      + [...el.classList].slice(0, 2).map((c) => `.${c}`).join('') + (text ? ` "${text}"` : '');
  };

  const root = document.documentElement;
  if (root.scrollWidth > root.clientWidth + 1) {
    issues.push(`horizontal scroll: content is ${root.scrollWidth}px wide in a ${root.clientWidth}px viewport`);
  }

  const interactive = [...document.querySelectorAll(
    'a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=link], [tabindex]:not([tabindex="-1"])',
  )].filter(visible);
  for (let i = 0; i < interactive.length; i++) {
    for (let j = i + 1; j < interactive.length; j++) {
      const a = interactive[i];
      const b = interactive[j];
      if (a.contains(b) || b.contains(a)) continue;
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (w > 1 && h > 1) issues.push(`overlapping interactive elements: ${describe(a)} and ${describe(b)}`);
    }
  }

  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el)) continue;
    const s = getComputedStyle(el);
    if (s.display.startsWith('inline') && s.display !== 'inline-block') continue;
    const hasText = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
    if (hasText && s.overflowX === 'visible' && el.scrollWidth > el.clientWidth + 1) {
      issues.push(`text overflows its container: ${describe(el)} (${el.scrollWidth}px in ${el.clientWidth}px)`);
    }
  }

  if (checkTapTargets) {
    for (const el of interactive) {
      const s = getComputedStyle(el);
      if (el.tagName === 'A' && s.display === 'inline') continue; // links inside running text
      const r = el.getBoundingClientRect();
      if (r.width < 44 || r.height < 44) {
        issues.push(`tap target smaller than 44px: ${describe(el)} (${Math.round(r.width)}x${Math.round(r.height)})`);
      }
    }
  }
  return issues;
}

// Runs in the page. The set of "property: value" pairs used by visible elements.
function usedTokens(props) {
  const out = new Set();
  for (const el of document.querySelectorAll('body, body *')) {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    if (r.width === 0 || r.height === 0 || s.visibility === 'hidden') continue;
    for (const p of props) {
      const v = s.getPropertyValue(p);
      if (v && v !== 'rgba(0, 0, 0, 0)' && v !== 'normal' && v !== '0px') out.add(`${p}: ${v}`);
    }
  }
  return [...out];
}

function isImage(file) {
  return /\.(png)$/i.test(file);
}

// Pads both images to the same size; padding counts as different pixels.
function compare(designPng, actualPng) {
  const a = PNG.sync.read(designPng);
  const b = PNG.sync.read(actualPng);
  const width = Math.max(a.width, b.width);
  const height = Math.max(a.height, b.height);
  const pad = (img) => {
    const out = new PNG({ width, height });
    out.data.fill(0);
    for (let i = 0; i < out.data.length; i += 4) out.data[i] = out.data[i + 2] = out.data[i + 3] = 255; // magenta
    PNG.bitblt(img, out, 0, 0, img.width, img.height, 0, 0);
    return out;
  };
  const diff = new PNG({ width, height });
  const differing = pixelmatch(pad(a).data, pad(b).data, diff.data, width, height, { threshold: 0.1 });
  return { ratio: differing / (width * height), diffPng: PNG.sync.write(diff) };
}

async function main() {
  const args = parseArgs(process.argv.slice(2), ['component', 'threshold']);
  const cfg = loadConfig(args.repo);
  const component = pickComponent(cfg, args.component);
  const routes = loadRoutes(args.repo, args.ticket);
  if (routes.length === 0) throw new UsageError(`no design/routes.json entries for ${args.ticket}`);
  const viewports = component.ui.viewports ?? DEFAULT_VIEWPORTS;
  const threshold = Number(args.threshold ?? component.ui.diff_threshold ?? 0.015);
  const smallest = Math.min(...viewports.map(([w]) => w));
  const out = screenshotDir(args.ticket);
  mkdirSync(out, { recursive: true });

  const app = await startApp(args.repo, component);
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const route of routes) {
      runSetup(args.repo, route.setup);
      const [designFile, fragment] = route.design.split('#');
      for (const [width, height] of viewports) {
        const name = `${route.screen}--${route.state ?? 'default'}--${width}x${height}`;
        const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
        const page = await context.newPage();

        let designPng;
        let designTokens = [];
        if (isImage(designFile)) {
          designPng = readFileSync(path.join(args.repo, designFile.replaceAll('{width}', String(width))));
        } else {
          const url = pathToFileURL(path.join(args.repo, designFile)).href + (fragment ? `#${fragment}` : '');
          await page.goto(url, { waitUntil: 'load' });
          designPng = await page.screenshot({ fullPage: true });
          designTokens = await page.evaluate(usedTokens, TOKEN_PROPS);
        }

        await page.goto(new URL(route.route, app.baseUrl).href, { waitUntil: 'networkidle' });
        const actualPng = await page.screenshot({ fullPage: true });
        const issues = await page.evaluate(structuralChecks, { checkTapTargets: width === smallest });
        const appTokens = new Set(await page.evaluate(usedTokens, TOKEN_PROPS));
        const missingTokens = designTokens.filter((t) => !appTokens.has(t));
        await context.close();

        const { ratio, diffPng } = compare(designPng, actualPng);
        const files = { design: `${name}--design.png`, actual: `${name}--actual.png`, diff: `${name}--diff.png` };
        writeFileSync(path.join(out, files.design), designPng);
        writeFileSync(path.join(out, files.actual), actualPng);
        writeFileSync(path.join(out, files.diff), diffPng);

        const passed = ratio <= threshold && issues.length === 0 && missingTokens.length === 0;
        results.push({
          screen: route.screen, state: route.state ?? 'default', route: route.route, viewport: [width, height],
          diff_ratio: Number(ratio.toFixed(5)), structural_issues: issues, missing_design_tokens: missingTokens,
          screenshots: files, passed,
        });
        console.log(`${passed ? 'PASS' : 'FAIL'} ${name}: ${(ratio * 100).toFixed(2)}% pixels differ`
          + `${issues.length ? `, ${issues.length} structural issues` : ''}`
          + `${missingTokens.length ? `, ${missingTokens.length} design tokens unused` : ''}`);
      }
    }
  } finally {
    await browser.close();
    app.stop();
  }

  const passed = results.every((r) => r.passed);
  writeFileSync(path.join(out, 'result.json'),
    `${JSON.stringify({ ticket: args.ticket, component: component.name, threshold, passed, results }, null, 2)}\n`);
  console.log(`${passed ? 'Design check passed' : 'Design check FAILED'}; details in ${path.join(out, 'result.json')}`);
  return passed ? 0 : 1;
}

run(main, USAGE);
