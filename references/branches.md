# Factory branches, PRs and planning files

Read by every factory skill that commits, branches, opens, reviews or merges. One feature or bug = one **container branch** that holds its planning files and, in the end, its code.

## Branches

| Branch | Made by | From | Holds | Pushed |
|---|---|---|---|---|
| `plan/<feature folder>` | the first planning skill that commits (`to-design` or `to-spec`) | `origin/develop` | intent, design, spec, tickets drafts | never (local only) |
| `epic/<EPIC KEY>-<slug>` | `to-tickets`, by renaming the `plan/` branch of a **feature** spec | (renamed) | planning files, then the merged stories | yes |
| `feature/<STORY KEY>-<slug>` | the `implementer` | the epic branch | one story's commits | yes |
| `bug/<BUG KEY>-<slug>` | `to-tickets`, by renaming the `plan/` branch of a **bug** spec | (renamed) | planning files and the bug's commits (the implementer works on it directly) | yes |

Slugs come from `node ~/.claude/skills/to-implement/scripts/branch-name.mjs <epic|story|bug> <KEY> "<summary>"`.

**Main checkout:** while a feature or bug is in the factory, the main checkout stays on its container branch (`plan/`, then `epic/` or `bug/`). Every planning, triage and ticket commit goes there, and is pushed once the branch is a container. One exception: git can't check out a branch in two worktrees, so while an implementer works on a `bug/` branch, `to-implement` detaches the main checkout from it, and switches it back for triage and at the end of its run.

## Pull requests

| PR | From → into | Reviewers | Human review rules | Cleanup |
|---|---|---|---|---|
| **Story PR** | `feature/…` → `epic/…` | code, spec, tests, security (+ ui-ux) | yes (`human-review.md`) | no |
| **Final PR, feature** | `epic/…` → `develop` | all of them again, on the whole epic | no: every story PR already passed them | yes |
| **Final PR, bug** | `bug/…` → `develop` | code, spec, tests, security (+ ui-ux) | yes | yes |

Every factory PR has the `factory` label and a `<!-- factory-reviewers: … -->` marker. A final PR also has `<!-- factory-final -->`. The merge gate (`github-setup`) merges every one of them the same way, and a final PR only once its cleanup commit is in.

**Order:** story PRs merge into the epic branch one by one. When every story and bug of the epic is Done, `to-review` has `to-pr` open the final PR. Its reviewers pass, `to-review` calls `planning-cleanup`, the gate merges into `develop`.

## Planning files

Temporary: they exist only on the container branch and are deleted by the **cleanup commit** on the final PR, after every reviewer passed and before the merge:

- `intent.md`, `design-brief.md`, `spec.md`, `design-changes.md`, `tickets.json` and `tickets/` in the feature folder
- `design/screenshots/*_deprecated.png`

Living (stay in `develop`): `design/` (except `_deprecated` screenshots), `docs/business-rules.md`, code and tests.

The cleanup commit is made by the `planning-cleanup` skill (called by `to-review`, or by hand). It has one parent and only deletes these files: that's how the gate recognises it, whatever its message.

## When passes stay valid

A reviewer's pass is for one head commit. It still counts on a newer head only if every commit after it is either:

1. a merge of the PR's target branch into it (the gate does these to keep a PR up to date: "Update + CI only"), or
2. the cleanup commit.

Any other commit needs all reviewers again, and removes the `human-approved` label.

## Known limits

- Parallel implementers, the tests reviewer and the ui-ux reviewer use the same `.env`: the same database and ports. Tests that need exclusive resources can collide.
- A PR stopped by a loop cap (`factory-stopped` label) is never merged by the gate: a human finishes it.
