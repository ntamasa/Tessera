---
name: setup-factory
description: Check and set up everything the factory needs, on this machine and in the current project - git, Node.js, the GitHub CLI and its login, Playwright with Chromium, the design.md CLI, the ui-ux-pro-max plugin, the factory's own files and agent hooks, the project's .gitignore and .worktreeinclude, its documented commands, Jira (through jira-setup) and GitHub with the merge gate (through github-setup). Installs what it can, and gives the user a step-by-step guide for what only they can do (tokens, logins, Jira site). Use when setting up a new machine or project for the factory, when a factory skill fails on a missing tool or config, or when the user asks to set up, check or install the factory. With "check", it only reports.
argument-hint: "[check]"
---

**Input:** nothing (set up what's missing), or `check` (only verify and report, change nothing). `from factory`: the factory called it at the start of a run (step 6).

**Output:** one checklist of every item (OK, FIXED, MISSING, WARN), the commits of any project files changed, and a numbered **Your steps** guide for everything only the user can do.

You install and configure; you never decide anything about the product. **Secrets:** never ask for a token, password or key in chat, never read, print or `cat` `.env`, and never handle a token yourself. The user types secrets into a prompt that isn't the chat (`! gh secret set …`) or into `.env` themselves.

## 1. Node.js first

Everything else runs on Node.js. Run `node --version`.

- **18 or newer:** go on.
- **Missing or older:** in `check` mode record it as MISSING and skip to step 6 (report). Otherwise install the current LTS as `~/.claude/references/installs.md` says (Windows: `winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements`; macOS: `brew install node`; otherwise the installer answers `NEEDS USER` with https://nodejs.org). A new install usually needs a restart before it's on the PATH.

## 2. Check

Run, from the current directory:

```
node ~/.claude/skills/setup-factory/scripts/check.mjs
```

It changes nothing, and prints one line per item: `STATUS  id  detail  | fix`. A fix starting with `auto:` is a command you may run (step 3), one starting with `you:` is a step for the user (step 5). Then check what the script can't:

- **project-commands** (only inside a project): read CLAUDE.md and README.md. They must say how to **install dependencies**, **run the tests** and **start the app** (the implementer stops with a blocker without the first two, reviewer-tests and reviewer-ui-ux need the last two). Optional: an **audit** command (reviewer-security uses it).
  - All there: OK.
  - Missing, and the project has a manifest with scripts (`package.json`, `pyproject.toml`, `Makefile`, `pom.xml`, `*.csproj`…): MISSING, fix `auto`: draft a `## Commands` section for CLAUDE.md from the manifest.
  - Missing, and there's no app code yet: WARN "add them once the stack is chosen (to-spec's technical design)". Not a blocker for intent, to-design, to-spec or to-tickets.
- **artifacts:** this session has the Artifact tool (to-design and design-baseline publish their reviews with it). Missing: `you:` "log in to Claude Code with a claude.ai account: `/login`".

## 3. Install and fix (skip in `check` mode)

Run every `auto:` fix from step 2, without asking, in this order (an earlier one can be a later one's prerequisite): `git`, `gh`, `designmd`, `designmd-spec`, `playwright`, `chromium`, `plugin-ui-ux`, `agent-hooks`, `gitignore-env`, `gitignore-worktrees`, `worktreeinclude`, `project-commands`, `project-playwright`.

- **Tools** (`git`, `gh`, `designmd`, `designmd-spec`, `playwright`, `chromium`, `plugin-ui-ux`, `project-playwright`): one sentence naming them, then one **installer** agent for all of them, as `~/.claude/references/installs.md` says, with the fix's command and the check script's item as the check. Never run them in this session. A `RESTART NEEDED` (winget/brew installs, the plugin) goes into **Your steps**; don't run the items that depend on it now. If `claude` isn't on the PATH, the plugin's `/plugin` steps from the script's WARN line go into **Your steps** instead.
- **`agent-hooks`:** edit only the `command:` line of each listed agent file. Show the old and new path.
- **`.gitignore` / `.worktreeinclude`:** make sure the file ends with a newline, then append the missing line. Never remove lines.
- **`project-commands`:** write the drafted section to CLAUDE.md (create the file if needed). Write only commands the manifest really has. Never invent one.
- **`project-playwright`:** only after the project's dependencies are installed; otherwise put it in **Your steps**.

If an install fails, record it as MISSING with the error's last lines and the command, and go on. Then run the check script again and keep its result.

## 4. Jira and GitHub (only inside a project)

**Jira**, with the `jira` skill's script (`node ~/.claude/skills/jira/scripts/jira.mjs`):

- `check` mode: run `env`, then `check` if every variable is set. Record OK or MISSING with the script's reason.
- Otherwise: run `check`. If it fails or a variable is missing, call the Skill tool with "jira-setup". It asks the user for the Jira site, email and project key, guides them through creating the API token and adding it to `.env` themselves, and checks it live. Then record its result.

**GitHub:** call the Skill tool with "github-setup", with `check` in `check` mode. It covers the gh login, the repository and remote, the `develop` branch, the labels, Actions, the `FACTORY_GATE_TOKEN` secret, CI and the merge gate workflow, and guides the user through the token. Record its checklist.

Both skills ask their own questions and commit their own files. Don't redo their checks.

## 5. Commit (skip in `check` mode)

If step 3 changed project files (`.gitignore`, `.worktreeinclude`, `CLAUDE.md`), commit only those. If the current branch is `main`, `master` or `develop` **and** it exists on `origin`, ask first with AskUserQuestion, options "Commit here" and "New branch chore/factory-setup + PR": these files are factory config (rule H3 of `~/.claude/references/human-review.md`), so a PR gets the `needs-human-review` label. Never commit `.env`. Files outside the project (`~/.claude/…`) aren't committed.

## 6. Report

**From factory:** no checklist. Nothing left for the user: end without a word (the factory says `Setup ✓`). A restart in **Your steps**: show the steps, one line each, ending with "then run `/factory` again", and end. Other steps left: show them, one line each, then ask with AskUserQuestion, options exactly "Done" and "Stop": "Setup needs these steps from you. Done?" On Done, run the check script again and repeat this for what's still missing; on Stop, end.

**Otherwise:** one checklist, the script's items first, then project-commands, artifacts, Jira and GitHub's lines:

```
Factory setup  P:/Brewlog
OK       node              v22.19.0
FIXED    designmd          npm install -g @google/design.md
OK       chromium          headless screenshot works
MISSING  gh-login          token lacks the 'workflow' scope   → Your steps 1
FIXED    worktreeinclude   added .env
WARN     project-commands  no app code yet: add once the stack is chosen
MISSING  jira              JIRA_API_TOKEN not set             → Your steps 2
OK       github            see github-setup below
...
```

Then **Your steps**: every remaining `you:` item and every step jira-setup or github-setup left to the user, numbered, in the order they unblock each other (restart, logins, tokens, merges). Each step says exactly where to click or what to type, with `!` for commands the user types into Claude Code. For example:

1. **Restart Claude Code** (new tools and plugins load only then).
2. **GitHub login with workflow scope:** type `! gh auth refresh -h github.com -s workflow`, confirm the code in the browser.
3. **Jira API token:** open https://id.atlassian.com/manage-profile/security/api-tokens logged in as `<JIRA_EMAIL>`, click **Create API token** (not "with scopes"), name it "factory", copy it, and add the line `JIRA_API_TOKEN=<token>` to `P:/Brewlog/.env` yourself. Don't paste it in chat.
4. **Merge gate token:** open https://github.com/settings/personal-access-tokens/new, Repository access → only `<owner/repo>`, permissions **Contents: Read and write** and **Pull requests: Read and write**, generate, then type `! gh secret set FACTORY_GATE_TOKEN` and paste it at the prompt.
5. **Merge the merge gate PRs** #… and #… yourself (the gate never merges its own config).

End with one line: what to run next. Everything OK: "The factory is ready: start with `intent`." Anything left: "Run `setup-factory check` after these steps."
