#!/usr/bin/env node
// PreToolUse hook of the factory's agents (implementer, reviewer-*). Stateless.
//
// 1. No agent merges, approves, edits or closes a PR: the merge gate workflow merges.
//    Only reviewer agents may comment on a PR (findings, replies in their threads, verdict), and they never
//    resolve threads or post decisions: to-review answers findings and resolves them.
// 2. Agents only read Jira: jira.mjs write commands are blocked. to-implement / to-review update Jira.
// 3. While HEAD is a red commit (marked with a git note in refs/notes/factory-red), the files in it
//    can't be changed, and the marks can't be removed. The green commit moves HEAD, which ends the lock.
//    A bug's fix runs on top of the reproduction subtask's red commit, so its test stays locked
//    during the whole fix. Commit messages play no part.
//
// Exit 2 blocks the tool call; stderr goes back to the agent.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

const block = (reason) => { console.error(reason); process.exit(2); };
const git = (args, cwd) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
const norm = (p) => p.replace(/\\/g, "/").replace(/^\.\//, "").toLowerCase();

let input;
try { input = JSON.parse(readFileSync(0, "utf8")); } catch { process.exit(0); }
const cwd = input.cwd || process.cwd();
const tool = input.tool_name || "";
const ti = input.tool_input || {};
const cmd = String(ti.command || "");
const isShell = tool === "Bash" || tool === "PowerShell";
const isReviewer = String(input.agent_type || "").startsWith("reviewer");

// 1. GitHub
if (isShell) {
  if (/\bgh\s+pr\s+(merge|review|close|edit|ready|reopen)\b/.test(cmd) || /\bgh\s+api\b.*\/merge\b/.test(cmd) || /\bgh\s+label\b/.test(cmd)) {
    block("Agents never merge, approve, edit or close PRs: the merge gate workflow merges when every reviewer has passed.");
  }
  if (/\bgh\s+pr\s+comment\b/.test(cmd) && !isReviewer) {
    block("Only reviewer agents comment on PRs.");
  }
  const pt = cmd.match(/pr-threads\.mjs["']?\s+(\w+)/);
  if (pt && !["list", "human"].includes(pt[1])) {
    if (!isReviewer) block("Only reviewer agents comment on PRs.");
    if (!["finding", "reply", "verdict"].includes(pt[1]) || /\s--(resolve|decision|final)\b/.test(cmd)) {
      block("Reviewers post findings, replies in their own threads and their verdict. to-review answers and resolves findings.");
    }
  }
}

// 2. Jira
if (isShell && /jira\.mjs["']?\s+(create|update|link|attach|transition|comment|publish)\b/.test(cmd)) {
  block("Agents only read Jira (read, search). The orchestrating skill updates Jira.");
}

// 3. Red test lock
// Red marks are only ever added: removing, overwriting or editing one would lift a lock.
const gitNotes = cmd.match(/\bgit\b[^|;&\n]*\bnotes\b[^|;&\n]*/g) || [];
if (isShell && (gitNotes.some((c) => /\b(remove|prune|edit|append|copy|merge)\b|\s(-f|--force)\b/.test(c)) || /refs[\\/]+notes/.test(cmd))) {
  block("Red-commit marks (git notes in refs/notes/factory-red) can only be added, never removed or changed.");
}

let root, locked;
try {
  root = git(["rev-parse", "--show-toplevel"], cwd);
  try { git(["notes", "--ref=factory-red", "show", "HEAD"], cwd); } catch { process.exit(0); } // HEAD isn't a red commit
  locked = git(["diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"], cwd).split("\n").filter(Boolean);
} catch { process.exit(0); }
if (!locked.length) process.exit(0);

const why = (f) => `${f} is in the red commit (HEAD). Make it pass by changing the code, not the test. If the test looks wrong, stop and report it as a blocker.`;

if (["Edit", "Write", "MultiEdit", "NotebookEdit"].includes(tool)) {
  const p = ti.file_path || ti.notebook_path;
  if (!p) process.exit(0);
  const rel = norm(relative(root, isAbsolute(p) ? p : resolve(cwd, p)));
  const hit = locked.find((f) => norm(f) === rel);
  if (hit) block(why(hit));
}

const WRITES = [/>/, /\btee\b/, /\bsed\s+-i/, /\brm\b/, /\bmv\b/, /\bcp\b/, /\btruncate\b/, /\bgit\s+(checkout|restore|rm|mv|stash|reset|commit)\b/,
  /Set-Content|Add-Content|Out-File|Remove-Item|Move-Item|Copy-Item|Clear-Content|WriteAll(Text|Lines|Bytes)|writeFile/i];
if (isShell && WRITES.some((re) => re.test(cmd))) {
  const c = norm(cmd);
  const hit = locked.find((f) => c.includes(norm(f)));
  if (hit) block(why(hit));
  if (/\bgit\s+commit\b.*--amend/.test(cmd) || (/\bgit\s+reset\b/.test(cmd) && !/--hard\b/.test(cmd))) {
    block("Don't amend or soft-reset the red commit: make the test pass by changing the code. If you're stopping on a blocker, use the reset --hard from the implementer skill.");
  }
}
process.exit(0);
