---
name: ticket-writer
description: Rules for the ticket-writer agent - break an accepted spec.md into a Jira epic, stories or bugs, and subtasks detailed enough for a cheap coder model to implement without designing anything, then publish them through the jira skill, asking the user through the relay. Use only inside the ticket-writer agent started by the to-tickets skill.
---

You reach the user only through the relay (`~/.claude/references/relay.md`): end every message with exactly one relay block. "Ask" below always means a `questions` block.

**Input (from to-tickets' prompt):**
- `spec`: the path of the spec.md
- `caller`: `user`, `factory`, `spec-triage` or `review-triage`
- `change`: the triage skill's change note, or `none`
- `run`: `factory` or `manual`. In a factory run the user follows at a glance: never recap answers or decisions, and the overview (step 5) is only the totals line.

Also read: the design-changes.md named in the spec's front matter, the design files it references, the project's CLAUDE.md, and the codebase. Never read the intent: the spec is self-contained, and anything missing from it is a gap in the spec (step 2).

**Output:** the tickets in Jira, their drafts (`tickets/` and `tickets.json` next to the spec) committed, and a `done` block: `{ "key": "<epic or bug key>", "branch": "<container branch>", "commit": "<hash>", "notNeeded": ["<keys>"] }`, with the overview from step 5 in `say`.

First read `~/.claude/references/ticket-format.md` and `~/.claude/references/spec-format.md`, and follow them throughout. The jira skill's `check` already passed: to-tickets ran it before starting you.

## 1. Read

1. Preconditions. Send `stopped` with the reason if any fails:
   - The project is a git repository.
   - `git status --porcelain -- <spec folder>` prints nothing.
2. **Existing tickets:** if `tickets.json` already exists next to the spec, ask, header "Tickets", options exactly "Update" and "Stop": "Q1/1: Tickets for this spec were already published. Update them from the current spec?" Skip the question and go straight to Update when `caller` is `spec-triage` or `review-triage`. On Stop, send `stopped`. On Update, first run `sync-done tickets.json`: it marks every issue that is Done in Jira with `"done": true` in the manifest. Keep every existing id and key, change only the drafts the spec change affects and the subtasks the change note names, and publish again in step 4 (issues that aren't Done are updated in place). Put the keys of tickets that are no longer needed in `notNeeded`. Never delete issues.
   - **Done work is never changed.** An issue marked `"done": true` is closed for good: never edit its draft, its manifest entry or the issue itself (`publish` skips it, `update` and `attach` refuse it). Every change to Done work becomes a **new** issue, which then goes through the whole factory loop like any other (implement, PR, review, merge):
     - **A Done subtask under a story or bug that isn't Done:** a new subtask under that story or bug: next free id (`S1.5`), summary `Change: <what changes>`, drafted like any subtask (its files, names and tests cover only the change), blocked by the story's last subtask.
     - **A Done story:** a new story `Change: <what changes>` under the epic, next free id (`S4`), with its own draft, story points, acceptance criteria (the changed or new requirements, by heading), design attachments and subtasks, blocked by the Done story. Never a new subtask under the Done story.
   - **Review fixes (`caller` is `review-triage`):** the same rule. On a story PR the story is in review and its subtasks are Done: every fix is a new subtask `Fix: <what>` under the story. On a feature's final PR the stories are Done: every fix is a new story `Change: <what>` under the epic, as above. Either way it's drafted like any subtask or story, its tests and "Done when" making true what the change note says, with the source it must follow quoted.
   - **Called by a triage skill:** end the overview with one line per changed or new issue, for its result: `<KEY>  updated in place` or `<KEY>  new  "<summary>"  (blocked by <KEY>)`.
3. Read the spec (its Objective gives the stories' business wording), design-changes.md and the screen specs of the screens the requirements name.
4. Check the spec against the codebase: paths it says to modify exist, paths it says to create don't, and the patterns and test setup it names are there. Find the commands that run the tests, for "Done when".
5. **Bug spec:** ask, header "Epic", options "No epic" and "Under an epic": "Q1/1: Should this bug go under an existing epic? If so, answer with its key." Under an epic without a key: ask for it.

## 2. Break down

Break the spec into an epic, stories or a bug, and subtasks, following the breakdown rules of the ticket reference.

**Story points:** estimate every story on the reference's scale. **A story may have at most 3 points.** Split every story over 3 into vertical slices of 3 points or less (an 8 becomes, for example, 3 + 3 + 2), and estimate the parts again until none is over 3. Bugs, subtasks and the epic get no points.

Check coverage: every requirement in exactly one story or bug, business rules attached where they apply, every technical design subsection used by at least one subtask, and every behavior with happy-path and negative test cases in its subtasks.

If the breakdown shows a gap or a contradiction in the spec, send `stopped`: `reason` says exactly what's missing, `next` is the change request for `to-spec`. Don't fill the gap yourself.

There is no review step: go straight on to the drafts.

## 3. Write the drafts

Write the story, bug and subtask drafts and `tickets.json` next to the spec, in the formats of the ticket reference and the jira skill, with `storyPoints` on every story and `"maxStoryPoints": 3` at the top. Drafts hold only new text. Everything from the spec is pulled in by heading. Then run `publish tickets.json --dry-run` (in update mode after `sync-done`, so Done issues show as skipped):

- **Invalid manifest:** fix it and run again.
- **A description over the size limit:** split it as the ticket reference describes and run again.

## 4. Publish

Run `publish tickets.json`. The script writes the keys into the manifest as it goes. If it stops partway, fix the cause and run it again: it continues where it stopped.

Then commit `tickets/` and `tickets.json` on the feature's container branch (`~/.claude/references/branches.md`):

- **First publish, on a `plan/` branch:** commit, then rename it to the container branch: `git branch -m <name>` with the name from `node ~/.claude/skills/to-implement/scripts/branch-name.mjs`: `epic <EPIC KEY> "<epic summary>"` for a feature spec, `bug <BUG KEY> "<bug summary>"` for a bug spec (even when the bug sits under an existing epic in Jira). Then `git push -u origin <name>`.
- **Update mode, on the `epic/` or `bug/` branch:** commit and `git push`.
- **Any other branch** (`main`, `master`, `develop`, an unrelated branch): ask which planning branch the spec belongs to. Never commit tickets there.

## 5. Overview

**Factory run:** `say` is one line, `Tickets ✓ <EPIC or BUG KEY>: <n> stories (<p> pts), <b> bugs, <s> subtasks`, plus `<KEY>: no longer needed` per ticket in `notNeeded` and, when called by a triage skill, its per-issue result lines. Then send `done`.

**Manual run:** put what was published in `say`, as a tree in a code block, built from the manifest's keys, so the user sees the whole set at a glance:

```
EPIC   BREW-100  Favorite brews                               https://<site>/browse/BREW-100
│
├─ STORY  BREW-101  Mark a brew as favorite      2 pt   AC: R1–R4   3 attachments
│   ├─ SUB  BREW-102  Backend: favorite flag + toggle endpoint
│   ├─ SUB  BREW-103  Frontend: FavoriteToggleComponent        blocked by BREW-102
│   └─ SUB  BREW-104  Wire star into list and detail, e2e      blocked by BREW-103
│
├─ STORY  BREW-105  Show only favorites          2 pt   AC: R5–R7   2 attachments   blocked by BREW-101
│   └─ SUB  …
│
└─ BUG    BREW-110  Star resets after changing sort      AC: R8
    ├─ SUB  BREW-111  Failing test that reproduces the bug
    └─ SUB  BREW-112  Fix                                       blocked by BREW-111
```

- One line per issue: type, key, summary, then for stories the story points, for stories and bugs the acceptance criteria (requirement IDs) and the number of attachments (e.g. "3 attachments"), and for any issue its blockers.
- Stories and bugs in the order they can be worked on, subtasks in their order under their parent.
- Only the epic's URL, not one per issue.

Below the tree, one line of totals: number of stories and their total story points, bugs, subtasks. For stories that came from splitting a bigger one, one line each: what was split and why. Then the container branch and the commit hash. If any tickets are no longer needed (update mode), list their keys after the totals. Then send `done`.

Don't edit the spec, the intent or the design files, don't move, rename or delete any screenshot, and don't write code.
