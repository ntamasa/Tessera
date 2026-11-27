---
name: to-pr
description: Open the factory's GitHub pull requests - a story PR from each finished story branch into its epic branch, and the final PR from an epic or bug branch into develop - decide which reviewers and whether a human review it needs, then hand the PRs to to-review. The factory merge gate merges them later. Called by to-implement (finished stories and bugs) and to-review (finished epics), or use when the user asks to run to-pr.
argument-hint: "[story/bug keys...] [--final <epic key>]"
---

**Input:** story or bug keys, or `--final <EPIC KEY>`, or nothing (every story and bug in "In Review" whose branch has no open PR yet).

**Output:** one open PR per key, labelled `factory` (and `needs-human-review` when needed), with its required reviewers in the body, and the hand-off to `to-review`.

Read `~/.claude/references/branches.md` first. Never merge, never force-push, never change code or commits. Merging is the merge gate's job.

## 1. Preconditions

1. Call the Skill tool with "github-setup" and `check`. If anything is MISSING, call it again without `check` to set it up. Continue once it's all OK.
2. Call the Skill tool with "jira" and run its `check`.
3. `git fetch origin`.

## 2. Kind, branches and target

| Key | Kind | Head | Target |
|---|---|---|---|
| a story | story PR | `feature/<KEY>-*` | its epic's branch, `epic/<EPIC KEY>-*` |
| a bug | final PR, bug | `bug/<KEY>-*` | `develop` |
| `--final <EPIC>` | final PR, feature | `epic/<EPIC>-*` | `develop` |

Find each with `git ls-remote --heads origin "<pattern>"`. None or more than one: skip the key and report it. The target must exist on the remote; if `develop` doesn't, stop and say so.

For `--final <EPIC>`: every story and bug of the epic must be Done in Jira, and no story PR into the epic branch may be open (`gh pr list --base <epic branch> --state open`). If not, skip and report what's still open.

## 3. Per PR

1. **Already open?** `gh pr list --head <head> --base <target> --state open --json number,url,body`. If one is open, push (`git push origin <head>`), refresh its body (steps 3–5) with `gh pr edit <n> --body-file <file>`, and reuse it.
2. **Commits:** `git log origin/<target>..origin/<head> --oneline`. None: skip and report.
3. **Human review:**
   - Story PR and bug final PR: read `~/.claude/references/human-review.md`, then go through `git diff origin/<target>...origin/<head>` against its rules H1–H4. Note every rule that applies, with `path:line`. When unsure, it applies.
   - Feature final PR: never. Every story PR inside it already passed these rules.
4. **Reviewers:** always `code,spec,tests,security`, plus `ui-ux` when the diff changes frontend files (components, templates, styles, pages) or a story in it has a "Design" section in Jira.
5. **Body**, written to a temp file:

   ```markdown
   ## <KEY> <summary>
   <Jira URL>

   <story: As a … I want … so that …  |  bug: the one-sentence problem  |  epic: the spec's Summary>

   **Acceptance criteria:** R1, R2, R3   **Spec:** `<path to spec.md>`

   ## Contents
   - story PR: <SUBTASK KEY> <summary>
   - final PR: <STORY/BUG KEY> <summary>: PR #<n>

   ## Review
   **Reviewers:** code, spec, tests, security, ui-ux
   **Human review:** not needed. | needed: add the `human-approved` label after reviewing.
   - H2: <what, path:line>
   **Final PR:** the planning files are deleted by a cleanup commit after every reviewer passes, then it merges.

   <!-- factory-reviewers: code,spec,tests,security,ui-ux -->
   <!-- factory-final -->        (final PRs only)
   ```

   The reviewers marker is exactly the list from step 4, comma-separated: the merge gate requires exactly these.
6. **Open:** `gh pr create --base <target> --head <head> --title "<KEY> <summary>" --body-file <file> --label factory`, plus `--label needs-human-review` when any rule applied.

## 4. Hand off

Show one line per PR: key, kind, `head → target`, URL, reviewers, `human review` or `auto-merge`, and the skipped keys with why. Then, as the last thing you do, call the Skill tool with "to-review" and the PR numbers.
