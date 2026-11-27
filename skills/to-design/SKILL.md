---
name: to-design
description: Design the UI screens an intent.md needs (optionally guided by a design-brief.md with the initial design idea), review them with the user as a Claude artifact, then write the living design files (DESIGN.md in Google Stitch format, per-screen specs, HTML prototype, screenshots) and a design-changes.md for the spec and tickets steps. Use when the user has an intent.md with UI work and wants to design it, or asks to run to-design.
argument-hint: "[path to intent.md, default ./intent.md] [path to design-brief.md, optional]"
---

**Input:** the intent.md at the path in the arguments, or `./intent.md`. If it doesn't exist, ask for its path before anything else. Optional inputs:
- **Design brief:** the user's initial design idea (style, mood, references, must-haves). It's the second argument's path, or `design-brief.md` next to the intent.md. If a path was given but doesn't exist, ask for the right path. If no path was given and there's no file next to the intent, run without one.
- **Living design files** under `design/` at the git root.
- **Called by to-spec:** the new UI requirements `to-spec` passes from its grilling count as part of the intent.
- **Called by review-triage:** the UI/UX findings it passes (problems the design itself causes, found in the running app) count as change requests on the existing design: work in evolve mode, and grill only on them and what they affect. UI review findings never come here directly: `review-triage` decides first whether the design or only the code is wrong.

**Output:** updated living design files under `design/`, before/after screenshots, and a `design-changes.md` next to the intent.md.

First read `~/.claude/references/design-format.md` and follow its rules and formats throughout.

## 1. Read

0. **Tools**, before reading any file. Check each one below. Install the missing ones, in the order listed, as `~/.claude/references/installs.md` says (no question, one sentence, the installer agent).

   Tools:
   - Playwright CLI: `npx --no-install playwright --version`. Install: `npm install -g playwright` then `npx playwright install chromium`.
   - design.md CLI: `designmd --help`. Install: `npm install -g @google/design.md`.
   - Spec file `~/.claude/references/design-md-spec.md` exists. Create: `designmd spec > ~/.claude/references/design-md-spec.md`.
1. Read the intent.md, and the design brief if there is one.
2. Preconditions. Stop and explain if any fails:
   - The project is a git repository.
   - `git status --porcelain -- design/` prints nothing (no uncommitted changes in `design/`). The last commit is the "before" baseline.
3. Check the design files: `design/DESIGN.md`, `design/screens/index.md`, `design/prototype/index.html`.
   - **All present:** read DESIGN.md and screens/index.md. From the index, pick the screens the intent affects and read only their `screens/<screen>.md` and `prototype/screens/<screen>.html`.
   - **None present:** ask with AskUserQuestion, options exactly "Yes" and "No": "No design files found in design/. Is this a new project?" On Yes, continue in fresh mode. On No, go to **Missing files** below.
   - **Some present:** go to **Missing files** below.

   **Missing files:** print the file table below, then ask with AskUserQuestion, options exactly "Yes" and "No": "Create the missing design files from the current codebase, without changing the design?"
   - **Yes:** call the Skill tool with "design-baseline". When it has committed, redo this step 1.3.
   - **No:** stop with: "Create these files to continue with to-design."

   File table:

   | File | Format |
   |---|---|
   | `design/DESIGN.md` | Google Stitch DESIGN.md |
   | `design/screens/index.md` | Markdown list of all screens |
   | `design/screens/<screen>.md` | Markdown per-screen spec |
   | `design/prototype/index.html` | HTML navigation between screens |
   | `design/prototype/tokens.css` | Generated from DESIGN.md (`designmd export`) |
   | `design/prototype/screens/<screen>.html` | Static HTML per screen with `?state=` switch |

   Follow it with one line: the full formats are in `~/.claude/references/design-format.md`.
4. Record the current `HEAD` hash as `base_commit`. If a `design-changes.md` already exists next to the intent (an earlier run for the same feature), use its `base_commit` instead, so the feature's changes are measured from before its first design run.

## 2. Grill

Call the Skill tool with "grilling".

- **First pass:** the design tree's root is the UI the intent needs. Gather everything needed to fully design the affected screens and, in fresh and redesign mode, the design system. Skip anything the intent, the design brief, DESIGN.md or the screen specs already settle. Ask about anything the brief leaves ambiguous.
- **Brief conflicts:** the intent decides *what* to build and the brief decides *how it looks*. If the brief contradicts the intent, the intent wins. In evolve mode, if the brief contradicts the existing DESIGN.md or screens, don't resolve it silently: make it a grilling question, recommending one side. Questions like these go in the first round.
- **After a review with change requests (from step 4):** the root is the requested changes only. Be critical: for each change, challenge whether it serves the intent and the project, fits DESIGN.md and the existing screens, and doesn't create inconsistencies. Recommend against a change when it hurts the product. If no questions remain, go straight to step 3.

Remember the decisions. They go into the screens' "Design decisions" sections. Tag any decision that comes straight from the brief with "(from brief)".

## 3. Design

Call the Skill tool with "ui-ux-pro-max:ui-ux-pro-max" to design the affected screens, giving it the intent, the design brief (if any), the grilling decisions, DESIGN.md and the affected screen files. Then write the files, in this order. Use Edit on existing files: never rewrite a whole file that only partly changes.

1. **DESIGN.md:** create it in fresh mode, redesign it in redesign mode. In evolve mode, only add the tokens/components the new design needs.
2. **tokens.css:** regenerate from DESIGN.md as described in the format reference.
3. **Prototype:** create or edit `prototype/screens/<screen>.html` for each affected screen, and delete the files of removed screens. Update `prototype/index.html`.
4. **Screen specs:** create or edit `screens/<screen>.md` for each affected screen, delete the specs of removed screens, update `screens/index.md`.
5. **Publish:** publish `design/prototype/index.html` with the Artifact tool, passing `tokens.css` and every `screens/*.html` in `files` at their relative paths. On later loops, republish the same file path so the URL stays the same.

## 4. Review

Give the artifact link and a short list of what changed since the last review, then ask with AskUserQuestion, header "Design", options exactly "Accept" and "Stop for now": "Accept the design? To change something, describe it as your own answer."

- **Own answer (changes requested):** go back to step 2 with the requested changes.
- **Stop for now:** stop. The design files stay uncommitted; run `to-design` again to continue.
- **Accept:** go to step 5.

## 5. Package

1. **Lint:** run `designmd lint` on DESIGN.md. Fix errors. If a fix changes the prototype, republish and tell the user what changed.
2. **Deprecate:** for every state of every modified or removed screen, rename `design/screenshots/<screen>.<state>.png` to `<screen>.<state>_deprecated.png` if it exists. If the `_deprecated` file already exists (an earlier run for the same feature), keep it: it's the feature's real "before". Don't rename over it. In redesign mode, if the tokens changed, every screen counts as modified.
3. **Screenshot:** with the Playwright CLI, take a screenshot of every state of every new or modified screen from the local prototype file (`file:///.../design/prototype/screens/<screen>.html?state=<state>`) into `design/screenshots/<screen>.<state>.png`. Use the viewport(s) settled in grilling. With more than one viewport, append `.<viewport>` to the name before the extension.
4. **design-changes.md:** write it next to the intent.md in the format from the reference (with `brief:` in the frontmatter if a brief was used), from `git diff <base_commit> -- design/screens design/DESIGN.md`. If it already exists, rewrite it to describe all of the feature's changes since its `base_commit`, not only this run's. Describe the changes in words. Never paste diffs.
5. **Commit** on the feature's planning branch (`~/.claude/references/branches.md`): if the current branch is a `plan/`, `epic/` or `bug/` branch, use it. Otherwise create `plan/<feature folder name>` from `origin/develop` (`develop` if there's no remote; ask which base to use if neither exists) with `git switch -c`, so uncommitted files come along. Commit `design/` and `design-changes.md`. On an `epic/` or `bug/` branch (called through review-triage), also push it. Never push a `plan/` branch.

Don't write a spec, tickets or app code, and don't delete any screenshot, `_deprecated` ones included. Give the artifact link, the design-changes.md path and the commit hash.

## 6. Hand off

Skip this step when `to-spec`, `review-triage` or `factory` called this skill (`from factory` in the arguments): they carry on themselves.

Ask with AskUserQuestion, options exactly "Start" and "Later": "Write the spec for this intent now?" On Start, call the Skill tool with "to-spec" and the intent's path. On Later, name `to-spec <intent path>` as the next step.
