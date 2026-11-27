---
name: factory
description: The factory's entry point and conductor. With a description of what you need, it runs the whole plan phase without stopping between steps - intent, to-design (only if the UI changes), to-spec, to-tickets - then starts the build, which carries on by itself through PRs, reviews and merges. Without arguments it shows where every feature in the factory stands and continues the one you pick. Also answers questions about how the factory works. Use when the user types /factory, wants to start or continue factory work, asks what the factory is doing, or asks how the factory works.
argument-hint: "[\"<what you need>\" | <intent.md or spec.md path | epic or bug key> | status]"
---

**Input:**
- A description of what's needed (one or a few sentences): **new work**.
- A path to an `intent.md` or `spec.md`, or a Jira epic or bug key: **continue** that feature.
- Nothing: the **overview**, then continue the feature the user picks.
- `status`: the overview only.

You conduct. The phase skills do the work and ask their own questions. Never write an intent, design, spec, ticket or code yourself, never answer a question for the user, and don't redo a phase skill's own checks.

**This is a factory run** (except `status` and questions about the factory): first read `~/.claude/references/factory-run.md`. Its rules on what the user sees hold for every skill you run from here to the end of the session, and override what those skills say about it.

How the factory works, for any question about it: `~/.claude/docs/README.md`. The skills themselves are the source of truth when the two disagree.

## 1. Setup

Run `node ~/.claude/skills/setup-factory/scripts/check.mjs` from the project. Nothing MISSING: go on, without a word. Otherwise, without showing the lines, call the Skill tool with "setup-factory", arguments `from factory`: it installs what it can and asks the user only for what only they can do. When it comes back, run the check again: nothing MISSING → `Setup ✓` and go straight on with the next step; still MISSING (a restart is needed, or the user stopped) → stop with how to continue. (Jira and GitHub are checked later by the phase skills that need them.)

## 2. Where things stand

Skip this step for new work.

1. **Collect the features in the factory:**
   - Planning on disk and on `plan/*` branches: every `intent.md` in the working tree (not under `node_modules/` or `.claude/worktrees/`), and on each local `plan/*` branch (`git ls-tree -r --name-only <branch>`). The feature folder is the intent's folder.
   - Container branches: `git ls-remote --heads origin "epic/*" "bug/*"`. Their key is in the branch name.
   - Open PRs: `gh pr list --label factory --state open --json number,headRefName,baseRefName,labels` (skip if `gh` isn't set up).
   - Jira: for each epic or bug key, its status and its stories' statuses (`node ~/.claude/skills/jira/scripts/jira.mjs search "parent = <KEY>"`; skip if Jira isn't set up).
2. **Phase of each feature**, the first row that matches:

   | State | Phase | Next step |
   |---|---|---|
   | Epic or bug Done, no open PR | finished | none |
   | Open factory PRs, none `factory-stopped` | review | `to-review <PR numbers>` |
   | Stories or the bug not Done, or a `factory-stopped` item | build | `to-implement <KEY>` (stopped items need a human: list them) |
   | `tickets.json` next to the spec | build | `to-implement <KEY>` |
   | `spec.md`, no `tickets.json` | spec done | `to-tickets <spec path>` |
   | `design-changes.md`, no `spec.md` | design done | `to-spec <intent path>` |
   | `intent.md` only | intent done | `to-design` or `to-spec`, by the intent skill's UI rule (step 3.2) |

3. **Show** one line per feature: name, key (if any), phase, next step, and anything waiting for the user (`needs-human-review` PRs, PRs with your comments not handled yet (`node ~/.claude/skills/to-review/scripts/pr-threads.mjs human <n>`), `factory-stopped` items, merge conflicts).
4. `status`: stop here. A path or key: continue that feature at its next step (step 3). Nothing: ask with AskUserQuestion which feature to continue (one option per unfinished feature, at most 4, the furthest along first), then continue it.

## 3. Run

Add `from factory` to the arguments of every plan-phase skill you call: it then skips its own "Start / Later" question and comes back here, so the plan phase runs without stopping between steps. The questions inside each step (grilling, accepting the design and the spec) still go to the user.

1. **Intent** (new work): call the Skill tool with "intent", arguments: the description, then `from factory`. It ends with the intent's path and a `NEXT:` line.
2. **Design or spec:** `NEXT: to-design`, or for a feature found in step 2 an intent that adds or changes something the user sees (a screen, a state, a control, a message, a flow, the look): call the Skill tool with "to-design", arguments: the intent's path (and a `design-brief.md` next to it, if there is one), then `from factory`. Otherwise skip to 3. When unsure, ask with AskUserQuestion, options exactly "Design first" and "Spec directly": "Does this intent need UI design before the spec?"
3. **Spec:** call the Skill tool with "to-spec", arguments: the intent's path, then `from factory`.
4. **Tickets:** call the Skill tool with "to-tickets", arguments: the spec's path (next to the intent), then `from factory`.
5. **Build:** call the Skill tool with "to-implement", arguments: the epic or bug key from to-tickets. From here the factory runs on by itself: to-implement → to-pr → to-review → merge gate → to-implement again for waiting stories, with spec-triage and review-triage handling the loops. Don't call those skills yourself.
6. **Review** (a feature found in step 2 in the review phase): call the Skill tool with "to-review", arguments: its PR numbers. It carries on the same way.

**If a step stops** (the user stopped it, a gap it can't resolve, a setup problem): stop too. Say which step stopped and why, and how to continue later: `/factory <intent path or key>`.

## 4. End

When the chain comes back, one line: the feature's phase now, and anything waiting for the user.
