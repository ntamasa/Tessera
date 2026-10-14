#!/usr/bin/env node
// Usage: a11y-scan.mjs <repo> <ticket> [--component <name>]
//
// Runs axe (WCAG 2.0/2.1/2.2 A and AA rules) against the running app for the accessibility
// reviewer. Scans every design/routes.json route of the ticket after its setup, or the
// component's base_url when the ticket has none. Prints the violations as JSON on stdout.
// Exit code: 0 scanned (violations or not; the reviewer judges them), 2 usage or setup error.
import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';
import { DEFAULT_VIEWPORTS, loadConfig, loadRoutes, parseArgs, pickComponent, run, runSetup, startApp } from './lib/ui.mjs';

const USAGE = 'a11y-scan.mjs <repo> <ticket> [--component <name>]';
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function main() {
  const args = parseArgs(process.argv.slice(2), ['component']);
  const component = pickComponent(loadConfig(args.repo), args.component);
  const routes = loadRoutes(args.repo, args.ticket);
  const targets = routes.length ? routes : [{ screen: 'home', state: 'default', route: '/' }];
  const [width, height] = (component.ui.viewports ?? DEFAULT_VIEWPORTS)[0];

  const app = await startApp(args.repo, component);
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const target of targets) {
      runSetup(args.repo, target.setup);
      const context = await browser.newContext({ viewport: { width, height } });
      const page = await context.newPage();
      await page.goto(new URL(target.route, app.baseUrl).href, { waitUntil: 'networkidle' });
      const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      results.push({
        screen: target.screen, state: target.state ?? 'default', route: target.route,
        violations: violations.map((v) => ({
          rule: v.id, impact: v.impact, help: v.help, help_url: v.helpUrl,
          nodes: v.nodes.map((n) => ({ target: n.target, html: n.html, summary: n.failureSummary })),
        })),
      });
      await context.close();
    }
  } finally {
    await browser.close();
    app.stop();
  }
  console.log(JSON.stringify({ ticket: args.ticket, component: component.name, results }, null, 2));
  return 0;
}

run(main, USAGE);
