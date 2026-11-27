---
name: planning-cleanup
description: Delete a feature's or bug's temporary planning files (intent.md, design-brief.md, spec.md, design-changes.md, tickets.json, tickets/, _deprecated screenshots) from its final PR with one cleanup commit, after every reviewer passed and before the merge gate merges it into develop. Called by to-review, or use when the user asks to clean up planning files or to finish a final PR by hand.
argument-hint: "<final PR number | epic or bug key>"
---

**Input:** a final PR number, or the epic or bug key of one. If neither is given, ask.

**Output:** one cleanup commit on the PR's head branch, pushed, and a list of what it deleted.

Read `~/.claude/references/branches.md` first: its "Planning files" list is the only list of what may be deleted. The merge gate accepts the commit only if it deletes nothing else and changes nothing.

## 1. Find the PR

1. From a key: `gh pr list --label factory --state open --head "<epic|bug>/<KEY>-…" --json number` (find the branch with `git ls-remote --heads origin "epic/<KEY>-*" "bug/<KEY>-*"`).
2. `gh pr view <n> --json number,headRefName,headRefOid,body,comments,state`. Stop and explain if:
   - it isn't open, or its body has no `<!-- factory-final -->` marker: only final PRs are cleaned up. Story PRs carry no planning files.
   - a comment `## ✅ Merge gate: merged` exists (too late).
3. **Reviewers passed?** For each reviewer in the body's `<!-- factory-reviewers: … -->` marker, the latest `<!-- factory-review reviewer=<id> … -->` comment must have `verdict=pass` and `head=<headRefOid>`. If any doesn't, ask with AskUserQuestion, options "Stop (Recommended)" and "Clean up anyway": "Not every reviewer has passed on the current commit. The spec and tickets are what the reviewers and review-triage work from: delete them now?" (When to-review calls this skill, they all passed: don't ask.)

## 2. List the files

1. `git fetch origin <head branch>`, then a temporary worktree outside the repo, on a throwaway local branch at the PR's head: `git worktree add -B cleanup-<KEY> <scratchpad>/cleanup-<KEY> origin/<head branch>`. Run everything below inside it.
2. The feature folder: the folder of the `tickets.json` that holds `<KEY>` (`git grep -l "<KEY>" -- ":(glob)**/tickets.json"`). None found: stop and ask for the feature folder.
3. The files to delete, **tracked files only** (`git ls-files`):
   - in the feature folder: `intent.md`, `design-brief.md`, `spec.md`, `design-changes.md`, `tickets.json`, everything under `tickets/`
   - `design/screenshots/*_deprecated.png`
4. Nothing to delete: remove the worktree, report "already clean", and stop.

## 3. Delete, check, commit

1. `git rm` exactly those files. Nothing else: no living design files, no `docs/business-rules.md`, no other feature's folder, no code.
2. Check `git diff --cached --name-status`: every line is `D`, every path is in the list from step 2.3. If not, `git reset --hard` and stop: something is wrong.
3. If the feature folder is now empty, git drops it on its own: don't create or delete folders by hand.
4. Commit, then `git push origin HEAD:<head branch>`. If the push is rejected (the branch moved on), stop and report: never force-push.
5. Remove the worktree and its local branch: `git worktree remove <path>`, `git branch -D cleanup-<KEY>`.

## 4. Report

```
Cleanup  <KEY>  PR #<n>  commit <short hash>
deleted: docs/features/favorites/intent.md
         docs/features/favorites/spec.md
         …
         design/screenshots/brews.default_deprecated.png
```

Then: "The merge gate keeps the reviewers' passes (this commit only deletes planning files) and merges once CI is green." When to-review called this skill, it carries on from here.
