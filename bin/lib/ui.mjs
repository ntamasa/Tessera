// Shared helpers for the workflow's UI scripts (design-diff.mjs, a11y-scan.mjs): reading the
// target repo's config, picking the UI component, starting and stopping the app, and loading
// the design routes of a ticket. Everything project-specific comes from AGENTS.md.
import { execFileSync, execSync, spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const WF = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA = process.env.TESSERA_DATA_DIR ?? '/workspace/data';
const SHELL = process.platform === 'win32' ? true : '/bin/bash';
export const DEFAULT_VIEWPORTS = [[1440, 900], [768, 1024], [375, 812]];

export class UsageError extends Error {}

// parseArgs(argv, ['component', 'threshold']) -> { repo, ticket, component, threshold }
export function parseArgs(argv, options) {
  const positional = [];
  const parsed = {};
  for (let i = 0; i < argv.length; i++) {
    const name = argv[i].startsWith('--') ? argv[i].slice(2) : null;
    if (name === null) positional.push(argv[i]);
    else if (options.includes(name) && i + 1 < argv.length) parsed[name] = argv[++i];
    else throw new UsageError(`unknown option ${argv[i]}`);
  }
  if (positional.length !== 2) throw new UsageError('expected <repo> <ticket>');
  return { repo: path.resolve(positional[0]), ticket: positional[1], ...parsed };
}

export function loadConfig(repo) {
  return JSON.parse(execFileSync('bash', [path.join(WF, 'bin', 'wf-config'), repo], { encoding: 'utf8' }));
}

function current() {
  try {
    return JSON.parse(readFileSync(path.join(DATA, 'current.json'), 'utf8'));
  } catch {
    return {};
  }
}

// The component to check: --component, else the active ticket's, else the only UI component.
export function pickComponent(cfg, name) {
  const components = cfg.components ?? [];
  const wanted = name ?? current().component;
  if (wanted) {
    const found = components.find((c) => c.name === wanted);
    if (!found?.ui) throw new UsageError(`component "${wanted}" has no ui block in AGENTS.md`);
    return found;
  }
  const ui = components.filter((c) => c.ui);
  if (ui.length !== 1) throw new UsageError(`${ui.length} components have a ui block; pass --component`);
  return ui[0];
}

// Folder for a ticket's screenshots and reports: <data>/screenshots/<ticket>. The container's
// data folder belongs to its one project.
export function screenshotDir(ticket) {
  return path.join(DATA, 'screenshots', ticket);
}

// design/routes.json entries of one ticket
export function loadRoutes(repo, ticket) {
  const file = path.join(repo, 'design', 'routes.json');
  if (!existsSync(file)) return [];
  return JSON.parse(readFileSync(file, 'utf8')).filter((r) => r.ticket === ticket);
}

// Puts the app into a route's state. Output goes to stderr, keeping stdout for results.
export function runSetup(repo, command) {
  if (command) execSync(command, { cwd: repo, stdio: ['ignore', 2, 2], shell: SHELL });
}

// Starts the component's ui.start (from the repo root) and waits until ui.base_url answers.
export async function startApp(repo, component, timeoutMs = 180_000) {
  const { start, base_url: baseUrl } = component.ui;
  if (!start || !baseUrl) throw new UsageError(`component "${component.name}" needs ui.start and ui.base_url`);
  const child = spawn(start, { cwd: repo, shell: SHELL, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  const keep = (chunk) => { output = (output + chunk).slice(-4000); };
  child.stdout.on('data', keep);
  child.stderr.on('data', keep);
  let exited = false;
  child.on('exit', () => { exited = true; });

  const stop = () => {
    try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already gone */ }
  };
  process.on('exit', stop);

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (exited) throw new Error(`ui.start exited before ${baseUrl} answered:\n${output}`);
    try {
      const res = await fetch(baseUrl);
      if (res.status < 500) return { baseUrl, stop };
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  stop();
  throw new Error(`${baseUrl} didn't answer within ${timeoutMs / 1000}s after ui.start:\n${output}`);
}

// Runs main() and maps failures to exit codes: 2 for usage and setup errors.
export function run(main, usage) {
  main().then(
    (code) => process.exit(code ?? 0),
    (err) => {
      console.error(err instanceof UsageError ? `usage: ${usage}\n${err.message}` : err.stack ?? String(err));
      process.exit(2);
    },
  );
}
