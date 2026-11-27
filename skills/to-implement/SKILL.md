---
name: to-implement
description: Implement Jira tickets - start one Haiku implementer agent per ready story or bug, all in parallel, each on its own branch in its own worktree (stories off their epic branch, a bug on its own bug branch), and loop every blocker back through spec-triage (to-spec, to-tickets) until the story is done. Without a key, picks up every story and bug in the project that isn't done or stopped. Called by to-tickets after publishing and by to-review, or use when the user wants tickets built or asks to run to-implement.
argument-hint: "[epic key | story/bug keys...] [from to-review]"
---

**Input:** an epic key (all its stories), a bug key, story/bug keys, or nothing (every story and bug in the project that isn't Done, In Review or stopped). `from to-review` means to-review called it to build fix subtasks: then skip the hand-off in step 7.

**Output:** one branch per story, built test-first (a bug's commits on its bug branch), the Jira statuses updated, and a final report.

Read `~/.claude/references/branches.md` first. You are the orchestrator: you schedule, keep Jira up to date and route blockers. **Never write code, answer a blocker's question, merge or open a PR.**

## 1. Preconditions

Stop and explain if any fails:

1. The project is a git repository, and `git status --porcelain` prints nothing.
2. `.gitignore` ignores `.claude/worktrees/` (`git check-ignore -q .claude/worktrees/x`), and `.worktreeinclude` at the git root lists `.env`, so every worktree gets the project's `.env`. If either is missing, show the user the lines to add and commit.
3. Call the Skill tool with "jira" and run its `check`. If it fails, call the Skill tool with "jira-setup".
4. `git fetch origin`.

## 2. Plan the run

0. **Sync merged PRs:** for every PR in `gh pr list --label factory --state merged --json number,headRefName` (skip if `gh` isn't set up) whose story or bug isn't Done in Jira, transition it to "Done". The merge gate may have merged PRs while no session was running.
1. **Collect:**
   - Epic key: `search "parent = <EPIC>"`. Story/bug keys: those.
   - No key: `search "project = <JIRA_PROJECT_KEY> AND issuetype in (Story, Bug) AND statusCategory != Done AND status != \"In Review\" AND (labels IS EMPTY OR labels != factory-stopped) ORDER BY rank" --max 200` (the project key from `env`). Stories in "In Progress" resume on their existing branch.

   For each, `read <KEY>`: status, labels, parent, blockers, subtasks with their statuses and blocking links. Skip, and list in the final report:
   - **no subtasks:** not made by to-tickets.
   - **`factory-stopped` label:** stopped by a loop cap earlier. The user removes the label to retry.
2. **Container and branch** (`branches.md`):
   - **Story:** container = its epic's branch: `git ls-remote --heads origin "epic/<EPIC KEY>-*"`. Branch = `branch-name.mjs story <KEY> "<summary>"`, created from the container. No epic branch: skip and report ("no epic branch").
   - **Bug:** container = branch = `git ls-remote --heads origin "bug/<KEY>-*"`. The implementer works on it directly. None: skip and report.
   - `base` = the container's current commit (`git rev-parse origin/<container>`). `resume` = whether the branch already exists (always true for a bug).
   - `sync` (stories with `resume: true` only): the subject of the merge that brings `base` into the story branch, following `~/.claude/references/commits.md`: `<STORY KEY>: Merge <what> from <why>`. Never let git write its default "Merge commit '<sha>'".
     - `<what>`: from `git diff --name-only <story branch>...<base>` (`origin/<branch>` if pushed, else the local branch): `spec.md` → "spec", `tickets.json` or `tickets/` → "ticket", `design/` → "design", joined with "and", then " updates" (`spec and ticket updates`). None of these changed → "latest epic branch".
     - `<why>`: after spec-triage (step 5.3) → `spec loopback`; called `from to-review` → `review loopback`; otherwise none, and drop ` from <why>`.
     - Examples: `BREW-17: Merge spec and ticket updates from review loopback`, `BREW-23: Merge ticket updates from spec loopback`, `BREW-24: Merge latest epic branch`.
3. **Ready:** a story or bug is ready when it isn't Done and every story blocking it is Done (merged into the container). Others wait: "waiting for <KEY>".
4. Show the plan in a few lines: ready items with branch and subtask count, waiting ones with what they wait for, skipped ones with why.
5. Keep a loop count per subtask, starting from the number in its Jira label `factory-loops-<n>` if it has one, else 0.

## 3. Run

**Free the branch first.** Git can't check out a branch in an agent's worktree while another worktree has it checked out. A bug's implementer works on the bug branch itself, and that's the container the main checkout usually sits on. So before starting an implementer on a bug branch (here and in step 5.3): if the main checkout is on that branch (`git branch --show-current`), remember the branch and run `git switch --detach` in the main checkout (the tree is clean, nothing is lost). The main checkout switches back to a container only for triage (step 5.2) and at the end of the run (step 6). Story branches are never checked out in the main checkout, so stories need nothing.

Start one implementer for **every** ready item at once: the Agent tool, `subagent_type: "implementer"`, in the background, with this prompt:

```
story: <KEY> (<story|bug>) "<summary>"
branch: <branch>   base: <base sha>   resume: <true|false>
sync: <sync subject>        (only for a story with resume: true)
subtasks: <KEY>, <KEY>, ...
Follow the implementer skill. End with the IMPLEMENTER REPORT.
```

`subtasks`: those that aren't Done, in blocking order. When it starts, transition the item to "In Progress". If a status name doesn't exist in the project's workflow, ask the user once with AskUserQuestion which status to use instead (options from the script's list), and use it for the rest of the run.

## 4. On each report

1. Transition every subtask under `done` to "Done".
2. Remove its worktree: `git worktree remove <worktree>`. If that fails, leave it and list it in the final report.
3. **DONE:** push the branch (`git push -u origin <branch>`) and transition the item to "In Review".
4. **BLOCKED** reports list every blocker the implementer found (usually all of them, from its preflight). Sort them first.
   **Blockers about the machine**, not the tickets: a tool missing or too old (the project needs Node 24 and 22 is installed, Playwright has no browser), so installing the dependencies or the first test run fails. No loop count, no triage: install it as `~/.claude/references/installs.md` says, then start the item's implementer again with `resume: true` (free the branch first, step 3). Blocked by the machine again after an install: handle it as below. If the report also has other blockers, install first, then triage those.
5. **Other blockers:** add 1 to the loop count of every subtask the report's blockers name (once per report, however many blockers name it) and store it on the subtask as the label `factory-loops-<n>` (replace the old one; keep every other label: `update --labels` replaces the whole list).
   - **Any over 5:** add the label `factory-stopped` to the story or bug (keeping its other labels). It stops here, and its report goes into the final report.
   - **Otherwise:** queue the report for triage, with all its blockers.

Items that don't depend on a blocked one keep running while it's triaged.

## 5. Triage loop

When the queue has reports (others may still be running in the background):

1. Group the queued reports by spec (the `tickets.json` that holds the blocked subtask's key, on the container branch). A blocked ticket no `tickets.json` holds wasn't made by the factory: it stops, gets `factory-stopped`, and goes into the final report.
2. Per spec: switch the main checkout to its container branch (`git switch <container>`, clean tree), then call the Skill tool with "spec-triage" with all its reports. It classifies each blocker from the evidence, fixes the spec and/or tickets (asking the user only through to-spec), commits and pushes them on the container, and returns a TRIAGE RESULT.
3. For every story in the result: re-read it from Jira, set `base` to the container's new commit and `sync` to its spec-loopback subject (step 2), free the branch (step 3), and start its implementer again with `resume: true`: it merges the container into its branch first, so it sees the new spec and design files. A new story the triage created joins the plan like any other.
4. If spec-triage stops (an unresolved gap, or the user stops it), the item gets `factory-stopped` and goes into the final report.

## 6. Final report

When nothing is running or ready, first switch the main checkout back if step 3 detached it: `git switch <the remembered branch>`. Then show:

```
STORY  BREW-101  feature/BREW-101-mark-a-brew-as-favorite → epic/BREW-100-favorite-brews  DONE     3/3   loops: 1
STORY  BREW-105  feature/BREW-105-show-only-favorites     → epic/BREW-100-favorite-brews  WAITING  for BREW-101
BUG    BREW-110  bug/BREW-110-star-resets-after-sort                                     STOPPED  BREW-112 (6 loops): <question>
```

Then: stopped items with their full report, skipped items with why, worktrees left on disk, and tests that already failed before the run. Called `from to-review`: also every done subtask with its last commit hash (`BREW-130 1a2b3c4`), from the implementers' `done:` lines.

## 7. Hand off

Always the last thing you do, after the final report. Skip it when called `from to-review`: to-review pushes and reviews the items itself.

If any item is DONE, call the Skill tool with "to-pr" with the DONE keys. (to-pr opens story PRs into their epic branch, and a bug's final PR into `develop`.)
