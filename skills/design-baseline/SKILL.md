---
name: design-baseline
description: Create the living design files (DESIGN.md in Google Stitch format, per-screen specs, HTML prototype, screenshots) under design/ from a project's existing UI code, documenting the current design as is without changing it. Use when a project already has a UI but no or only some design files, when to-design calls it, or when the user asks to run design-baseline or to sync design/ with the code.
---

**Input:** the project's UI code, and any design files already under `design/` at the git root.

**Output:** the missing living design files under `design/`, describing the UI exactly as the code builds it, and a commit. No design-changes.md.

First read `~/.claude/references/design-format.md` and follow its rules and formats throughout.

**Rule for every step:** document the design as it is. Don't improve, normalize or fix anything, in the code or in the design files. If you're unsure what the code renders, ask. Don't guess a "better" answer.

## 1. Read

0. **Tools**, before reading any file. Check each one below. Install the missing ones, in the order listed, as `~/.claude/references/installs.md` says (no question, one sentence, the installer agent).

   Tools:
   - Playwright CLI: `npx --no-install playwright --version`. Install: `npm install -g playwright` then `npx playwright install chromium`.
   - design.md CLI: `designmd --help`. Install: `npm install -g @google/design.md`.
   - Spec file `~/.claude/references/design-md-spec.md` exists. Create: `designmd spec > ~/.claude/references/design-md-spec.md`.
1. Preconditions. Stop and explain if any fails:
   - The project is a git repository.
   - `git status --porcelain -- design/` prints nothing (no uncommitted changes in `design/`).
2. List which files from the format reference's file map exist under `design/`, and read them. Existing files are kept as they are. This run creates only the missing ones. If all are present, say so and stop.
3. Scan the UI code:
   - **Stack:** framework, routing, styling approach (CSS files, CSS variables, Tailwind config, theme objects, component library).
   - **Screens:** every route/page/view the user can reach. Each becomes a `<screen>`.
   - **Tokens:** colors, fonts, font sizes and weights, line heights, radii, spacing, shadows, taken from theme/config files first, then from styles in use.
   - **Components:** shared UI components and their variants (e.g. button primary/secondary/disabled).
   - **States:** each screen's loading, empty, error and other conditional branches.
   - **Flows:** links and navigations between screens and the actions that trigger them.
   If the project has no UI code, stop and tell the user to use `to-design` in fresh mode instead.

## 2. Grill

Call the Skill tool with "grilling". The design tree's root is what the code doesn't settle about the current design, for example: which routes count as separate screens, which viewport(s) to capture, states the code hides behind data or permissions, values computed at runtime. Skip everything the code answers. Never ask what the design *should* be.

**Inconsistencies** (e.g. seven slightly different grays, two button styles doing the same job): don't merge them. Each value in use becomes its own token, so the prototype can match the real UI. List them in a "Known inconsistencies" paragraph at the end of DESIGN.md's Overview section.

**Conflicts with existing design files:** if a design file that already exists disagrees with the code, make it a grilling question: does the file or the code describe the current design? Recommend the code, because it's what users see.

## 3. Write

Write the missing files, in this order. Never edit a file that already existed.

1. **DESIGN.md:** the tokens and components found in step 1, in the format reference's DESIGN.md format.
2. **tokens.css:** generate from DESIGN.md as described in the format reference.
3. **Prototype:** `prototype/screens/<screen>.html` for each screen, matching the real UI's layout, content and styling as closely as possible, with every state reachable through `?state=`. Then `prototype/index.html`.
4. **Screen specs:** `screens/<screen>.md` for each screen, then `screens/index.md` with the Flows section. In each spec's "Design decisions" section, write the decisions from grilling, plus "Baseline: documents the UI as built at commit `<HEAD hash>`."
5. **Publish:** publish `design/prototype/index.html` with the Artifact tool, passing `tokens.css` and every `screens/*.html` in `files` at their relative paths. On later loops, republish the same file path so the URL stays the same.

## 4. Review

Give the artifact link and ask the user to compare it with the real app. If the app runs locally, give the command to start it. Then ask with AskUserQuestion, header "Baseline", options exactly "Matches" and "Stop for now": "Does the prototype match the real app? If not, describe the differences as your own answer."

- **Stop for now:** stop. The files stay uncommitted.
- **Differences reported:** fix the prototype and specs to match the real app, republish, and ask again. Treat a requested design change as out of scope: say it belongs in a `to-design` run and leave it out.
- **Matches:** go to step 5.

## 5. Package

1. **Lint:** run `designmd lint` on DESIGN.md. Fix errors without changing any token's value. If a fix changes the prototype, republish and tell the user what changed.
2. **Screenshot:** with the Playwright CLI, take a screenshot of every state of every screen whose prototype this run created, from the local prototype file (`file:///.../design/prototype/screens/<screen>.html?state=<state>`), into `design/screenshots/<screen>.<state>.png`. Use the viewport(s) settled in grilling. With more than one viewport, append `.<viewport>` to the name before the extension.
3. **Commit:** when `to-design` called this skill, commit on the feature's planning branch, following the rule in `to-design`'s step 5 (`~/.claude/references/branches.md`). Otherwise, if the current branch is `main`, `master` or `develop`, ask which branch to commit on first. Commit only `design/`.

Don't change app code or any design file that existed before the run. Finish by giving the artifact link, the list of known inconsistencies and the commit hash. If `to-design` called this skill, go back to its step 1.3.
