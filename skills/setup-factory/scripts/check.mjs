#!/usr/bin/env node
// Checks what the factory needs on this machine and in the current project. Changes nothing.
//   node check.mjs [--json]
// Line format: STATUS  id  detail  [| fix]
//   STATUS: OK | MISSING | WARN | SKIP
//   fix:    "auto: <command>"  -> Claude runs it (tools through the installer agent)
//           "you: <step>"      -> only the user can do it
// Jira and GitHub are not checked here: the jira / jira-setup and github-setup skills own them.

import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { homedir, tmpdir, platform } from "node:os";
import { join } from "node:path";

const CLAUDE = process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude");
const OS = platform(); // win32 | darwin | linux
const results = [];
const add = (status, id, detail, fix = "") => results.push({ status, id, detail, fix });

const run = (cmd, opts = {}) => {
  try {
    const out = execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 90000, ...opts });
    return { ok: true, out: out.trim() };
  } catch (e) {
    return { ok: false, out: `${e.stdout || ""}${e.stderr || ""}`.trim() };
  }
};

const pkgInstall = (winget, brew, other) =>
  OS === "win32" ? `auto: winget install --id ${winget} -e --accept-source-agreements --accept-package-agreements (then restart the terminal and Claude Code)`
  : OS === "darwin" ? `auto: brew install ${brew}`
  : `you: ${other}`;

// ---------- Machine ----------

// git
const git = run("git --version");
if (git.ok) add("OK", "git", git.out.replace("git version ", ""));
else add("MISSING", "git", "not installed", pkgInstall("Git.Git", "git", "install git with your package manager (e.g. sudo apt install git)"));

// node >= 18
const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor >= 18) add("OK", "node", `v${process.versions.node}`);
else add("MISSING", "node", `v${process.versions.node}, needs 18+`, pkgInstall("OpenJS.NodeJS.LTS", "node", "install a current Node.js LTS from https://nodejs.org"));

// gh
const gh = run("gh --version");
if (!gh.ok) {
  add("MISSING", "gh", "GitHub CLI not installed", pkgInstall("GitHub.cli", "gh", "install the GitHub CLI: https://github.com/cli/cli#installation"));
  add("SKIP", "gh-login", "needs gh");
} else {
  add("OK", "gh", gh.out.split("\n")[0].replace(/^gh version /, ""));
  const st = run("gh auth status -h github.com");
  if (!st.ok) add("MISSING", "gh-login", "not logged in to github.com", "you: type `! gh auth login` (GitHub.com, HTTPS, authenticate Git with your GitHub credentials: Yes, login with a web browser)");
  else {
    const acct = (st.out.match(/account (\S+)/) || [])[1] || "?";
    const scopes = (st.out.match(/Token scopes:\s*(.*)/) || [])[1];
    if (scopes === undefined) add("WARN", "gh-login", `${acct}; token scopes unknown (fine-grained or env token): it must be able to push .github/workflows files`);
    else if (!/workflow/.test(scopes)) add("MISSING", "gh-login", `${acct}; token lacks the 'workflow' scope (needed to push the merge gate workflow)`, "you: type `! gh auth refresh -h github.com -s workflow` and confirm in the browser");
    else add("OK", "gh-login", `${acct} (repo, workflow)`);
  }
}

// designmd
const dm = run("designmd --help");
if (dm.ok) add("OK", "designmd", "design.md CLI");
else add("MISSING", "designmd", "design.md CLI not installed", "auto: npm install -g @google/design.md");

// design-md-spec reference
const specRef = join(CLAUDE, "references", "design-md-spec.md");
if (existsSync(specRef)) add("OK", "designmd-spec", "references/design-md-spec.md");
else add("MISSING", "designmd-spec", "references/design-md-spec.md", `auto: designmd spec > "${specRef}"`);

// Playwright CLI + Chromium (functional: take a screenshot)
const pw = run("npx --no-install playwright --version");
if (!pw.ok) {
  add("MISSING", "playwright", "Playwright CLI not installed", "auto: npm install -g playwright");
  add("SKIP", "chromium", "needs playwright");
} else {
  add("OK", "playwright", pw.out.split("\n").pop());
  const dir = mkdtempSync(join(tmpdir(), "factory-pw-"));
  const shot = run(`npx --no-install playwright screenshot --browser chromium "data:text/html,<p>ok</p>" "${join(dir, "x.png")}"`, { cwd: dir });
  const ok = shot.ok && existsSync(join(dir, "x.png"));
  rmSync(dir, { recursive: true, force: true });
  if (ok) add("OK", "chromium", "headless screenshot works");
  else add("MISSING", "chromium", "Playwright can't launch Chromium", OS === "linux" ? "auto: npx playwright install --with-deps chromium (may need sudo: then you run it)" : "auto: npx playwright install chromium");
}

// ui-ux-pro-max plugin (to-design calls it)
const plugins = run("claude plugin list");
if (!plugins.ok) add("WARN", "plugin-ui-ux", "can't run `claude plugin list`", "you: in Claude Code run `/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill`, then `/plugin install ui-ux-pro-max@ui-ux-pro-max-skill`, then restart Claude Code");
else {
  const block = (plugins.out.split(/\n\s*\n/).find((b) => /ui-ux-pro-max@/.test(b))) || "";
  if (!block) add("MISSING", "plugin-ui-ux", "ui-ux-pro-max plugin not installed", "auto: claude plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill && claude plugin install ui-ux-pro-max@ui-ux-pro-max-skill --scope user (then restart Claude Code)");
  else if (/disabled/i.test(block)) add("MISSING", "plugin-ui-ux", "ui-ux-pro-max plugin disabled", "auto: claude plugin enable ui-ux-pro-max@ui-ux-pro-max-skill (then restart Claude Code)");
  else add("OK", "plugin-ui-ux", "ui-ux-pro-max enabled");
}

// Factory files
const expected = [
  ...["design-baseline", "github-setup", "grilling", "implementer", "intent", "intent-revise", "jira", "jira-setup",
    "planning-cleanup", "review-triage", "reviewer", "spec-triage", "tdd", "to-design", "to-implement", "to-pr",
    "to-review", "to-spec", "to-tickets", "web-design-guidelines", "setup-factory", "factory", "spec-writer",
    "ticket-writer"].map((s) => `skills/${s}/SKILL.md`),
  "skills/jira/scripts/jira.mjs", "skills/to-review/scripts/pr-threads.mjs", "skills/to-implement/scripts/branch-name.mjs", "skills/github-setup/assets/factory-merge-gate.yml",
  "skills/tdd/tests.md", "skills/tdd/mocking.md",
  ...["implementer", "reviewer-code", "reviewer-security", "reviewer-spec", "reviewer-tests", "reviewer-ui-ux", "spec-writer",
    "ticket-writer", "installer"].map((a) => `agents/${a}.md`),
  ...["branches", "design-format", "human-review", "intent-format", "spec-format", "ticket-format", "relay", "installs", "factory-run"].map((r) => `references/${r}.md`),
  "hooks/agent-guard.mjs",
];
const missing = expected.filter((f) => !existsSync(join(CLAUDE, f)));
if (missing.length) add("MISSING", "factory-files", `${missing.length} missing: ${missing.join(", ")}`, "you: copy these files back from your factory source into " + CLAUDE);
else add("OK", "factory-files", `${expected.length} files in ${CLAUDE}`);

// Agent hook paths (agents hardcode the hook's absolute path)
const agentsDir = join(CLAUDE, "agents");
const badHooks = [];
if (existsSync(agentsDir)) {
  for (const f of readdirSync(agentsDir).filter((f) => f.endsWith(".md"))) {
    const text = readFileSync(join(agentsDir, f), "utf8");
    for (const m of text.matchAll(/command:\s*"node\s+([^"]+)"/g)) {
      const p = m[1].trim().replace(/^~(?=[\\/])/, homedir());
      if (!existsSync(p)) badHooks.push(`${f} -> ${m[1]}`);
    }
  }
}
const hookPath = join(CLAUDE, "hooks", "agent-guard.mjs").replace(/\\/g, "/");
if (badHooks.length) add("MISSING", "agent-hooks", `hook path not found: ${badHooks.join("; ")}`, `auto: in each listed agent, replace the hook path with ${hookPath}`);
else add("OK", "agent-hooks", "every agent's guard hook resolves");

// ---------- Project ----------

const top = run("git rev-parse --show-toplevel");
if (!top.ok) {
  add("SKIP", "project", "not inside a git repository: project checks skipped", "you: run setup-factory again from inside the project (or `git init` it)");
} else {
  const root = top.out;
  add("OK", "project", root);
  const ignored = (p) => run(`git check-ignore -q "${p}"`, { cwd: root }).ok;
  const tracked = (p) => run(`git ls-files --error-unmatch "${p}"`, { cwd: root }).ok;

  if (tracked(".env")) add("MISSING", "gitignore-env", ".env is tracked by git (secrets in history)", "you: decide in jira-setup step 2 (untrack with `git rm --cached .env`, rotate the secrets)");
  else if (ignored(".env")) add("OK", "gitignore-env", ".env ignored");
  else add("MISSING", "gitignore-env", ".env not git-ignored", "auto: add a `.env` line to .gitignore");

  if (ignored(".claude/worktrees/x")) add("OK", "gitignore-worktrees", ".claude/worktrees/ ignored");
  else add("MISSING", "gitignore-worktrees", ".claude/worktrees/ not git-ignored", "auto: add a `.claude/worktrees/` line to .gitignore");

  const wti = join(root, ".worktreeinclude");
  const wtiOk = existsSync(wti) && readFileSync(wti, "utf8").split(/\r?\n/).some((l) => l.trim() === ".env");
  if (wtiOk) add("OK", "worktreeinclude", ".worktreeinclude lists .env");
  else add("MISSING", "worktreeinclude", ".worktreeinclude doesn't list .env (agents' worktrees get no Jira config)", "auto: add a `.env` line to .worktreeinclude");

  const docs = ["CLAUDE.md", "README.md"].filter((f) => existsSync(join(root, f)));
  add(docs.length ? "OK" : "WARN", "project-docs", docs.length ? docs.join(", ") + " (check commands in the skill)" : "no CLAUDE.md or README.md: implementers won't know how to install, test or run the app");

  const pkg = join(root, "package.json");
  if (existsSync(pkg)) {
    try {
      const j = JSON.parse(readFileSync(pkg, "utf8"));
      const deps = { ...j.dependencies, ...j.devDependencies };
      if (deps["@playwright/test"] || deps.playwright) add("WARN", "project-playwright", "project pins its own Playwright: its browsers must match", "auto: npx playwright install chromium (in the project, after installing its dependencies)");
    } catch { /* ignore */ }
  }
}

if (process.argv.includes("--json")) console.log(JSON.stringify(results, null, 2));
else for (const r of results) console.log(`${r.status.padEnd(8)}${r.id.padEnd(21)}${r.detail}${r.fix ? `  | ${r.fix}` : ""}`);
process.exit(results.some((r) => r.status === "MISSING") ? 1 : 0);
