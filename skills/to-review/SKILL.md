---
name: to-review
description: Review the factory's pull requests (story PRs into the epic branch, final PRs into develop) with parallel reviewer agents (code-architecture, spec, tests, security, ui-ux) that each post their verdict on the PR, loop every finding and CI failure back through review-triage and to-implement until every reviewer passes on the same commit, push the cleanup commit on final PRs, then follow the merge gate's result, open an epic's final PR when its stories are all merged, update Jira and continue the factory. Called by to-pr, or use when the user wants factory PRs reviewed or asks to run to-review.
argument-hint: "[PR numbers...]"
---

**Input:** PR numbers, or nothing (every open PR with the `factory` label and without `factory-stopped`).

**Output:** each PR reviewed on its latest commit, merged by the merge gate or waiting for a human, final PRs cleaned up, and Jira updated.

Read `~/.claude/references/branches.md` first. You are the orchestrator: you start reviewers and route what they find. **Never review, fix, merge or decide a finding yourself, and never post a reviewer's verdict for it.** Each reviewer posts its own PR comments; the merge gate workflow counts them and merges.

**PR conversation:** every comment you post goes through `node ~/.claude/skills/to-review/scripts/pr-threads.mjs` (its header lists the commands), with the body on stdin (a Bash heredoc with a quoted delimiter). Each gets a factory marker, so a comment without one is the human's. Findings live in review threads: each is answered where it was raised, and resolved once it's settled.

## 1. Preconditions and sync

1. Call the Skill tool with "github-setup" and `check`, and "jira" with its `check`. Without the merge gate, reviews still run, but nothing merges: say so in the final report.
2. **Sync merged PRs:** for every PR in `gh pr list --label factory --state merged --json number,headRefName,body` whose story, bug or epic isn't Done in Jira, transition it to "Done". (PRs the gate merged while no session was running.)

## 2. Per PR

From `gh pr view <n> --json number,url,baseRefName,headRefName,headRefOid,body,labels`:

- `kind`: `final` if the body has `<!-- factory-final -->`, else `story`.
- `key`: the key in the head branch name (`feature/<KEY>-…`, `bug/<KEY>-…`, `epic/<KEY>-…`).
- `base`: `git fetch origin <baseRefName>`, then `git rev-parse origin/<baseRefName>`. `head`: `headRefOid`.
- `spec`: the `spec.md` next to the `tickets.json` that holds the key, on the container branch (`git grep -l "<KEY>" origin/<container> -- ":(glob)**/tickets.json"`), or "none".
- `reviewers`: the list in the body's `<!-- factory-reviewers: … -->` marker. None: skip this PR, it wasn't opened by to-pr.
- `loops`: the number in the PR's `factory-loops-<n>` label, or 0.
- `passed`: the reviewers whose latest `factory-review` comment has `verdict=pass` and `head=` the current head.
- `human`: `node ~/.claude/skills/to-review/scripts/pr-threads.mjs human <n>`: what the user wrote on the PR that isn't handled yet (open threads whose last comment is theirs, and top-level comments or review bodies without a factory reply).

## 3. Review

For every PR at once, start one agent per entry in its `reviewers` (`reviewer-<id>`) that isn't in `passed` with the Agent tool, in the background. **Run at most one `reviewer-ui-ux` at a time**: each one starts the app, and two would fight over its port. The others all run in parallel.

Prompt for each:

```
pr: #<n> <url>   kind: <story|final>   key: <KEY>
base: <base sha>   head: <head sha>
spec: <path on the head commit | none>
Follow the reviewer skill. Post your findings and your verdict, then end with the REVIEW REPORT.
```

Every review covers the whole PR at its current `head`. After any new commit that isn't a target merge or the cleanup commit, **every** reviewer runs again.

## 4. On a PR's reports (once all its reviewers are back, or right away when none had to run)

In a factory run, an agent or background task finishing shows only its status line from `~/.claude/references/factory-run.md`: never what it changed, checked or found, loop counts, leftover worktrees, or "nothing is waiting".

The PR's findings: every reviewer's findings (each with its `thread`), plus one `[rule]` finding from `human` per item in `human` (its id, `where` = the thread's `path:line` or "PR comment", the user's text quoted as the source).

1. If any report has `human review` set and the PR isn't a feature final PR, add the `needs-human-review` label (`gh pr edit <n> --add-label needs-human-review`) and post the reasons with `node ~/.claude/skills/to-review/scripts/pr-threads.mjs note <n> human-review`, ending with: "Review it, then add `human-approved`, or comment what to change (inline or not) and run `/factory`."
2. **Any reviewer finding** (the human's comments don't count): add 1 to `loops` and store it as the PR label `factory-loops-<n>` (replace the old one).
   - **Over 5:** add the label `factory-stopped`, post "review loop cap: a human finishes this PR" with `note <n> loop-cap`, and put it in the final report. The gate never merges it.
   - **Otherwise:** go to step 5 with its findings. Every finding loops: there are no nits.
3. **Only the human's comments:** go to step 5 with them.
4. **All PASS and nothing from the human:** story PR → step 7. Final PR → step 6.

## 5. Fix loop

1. Group the findings of all waiting PRs by spec. Per spec, switch the main checkout to its container branch (clean tree), then call the Skill tool with "review-triage" with those findings (each with its reviewer, PR and key). It classifies each finding from the evidence, sends it through to-design, to-spec and/or to-tickets (which commit and push on the container), and returns which stories or bugs got new subtasks or new `Change:` stories, and which findings were dismissed (X) or kept (J).
2. **Answer each decided finding where it was raised**, with review-triage's reason and its evidence: `node ~/.claude/skills/to-review/scripts/pr-threads.mjs reply <n> <id> --decision <d> --resolve` (add `--final` for a decision on a `[disputes decision]` finding), body:

   | Triage result | `--decision` | Body |
   |---|---|---|
   | X, a reviewer's finding | `dismissed` | `**Dismissed:** <reason>` (`**Dismissed (final):**` with `--final`) |
   | J kept | `kept` | `**Kept:** <reason>` (or `**Kept (final):**`) |
   | repeat | `repeat` | `**Already decided:** <link to the decision's reply>` |
   | X, the human's comment | `none` | `**No change needed:** <reason>` |

   A top-level comment or review body (`c:` or `r:`) can't be resolved: the same command posts the answer as a new comment linked to it. A finding that gets a fix stays open until the fix is pushed (5.4).
3. Call the Skill tool with "to-implement" with the keys that got new subtasks or stories and `from to-review`. It builds them (a story fix on its story branch; a new `Change:` story on a new story branch off the epic) and pushes the branches.
4. **Close what was fixed.** For each key to-implement finished, take its done subtasks with their hashes (its final report). For every finding review-triage fixed with one of them: a thread (`t:`): `node ~/.claude/skills/to-review/scripts/pr-threads.mjs reply <n> <id> --resolve </dev/null` (no body); a top-level comment or review body (`c:`/`r:`): `--decision fixed`, body `**Fixed** in <short hash> (<SUBTASK KEY>).` For a fix in a new `Change:` story, do the same once to-pr opened its PR, with `**Fixed** in PR #<m> (<KEY>).` and `--resolve` on threads. Then, for each affected PR: review it again from step 2. A new `Change:` story gets its PR from `to-pr` (call it with that story's key) before the final PR is reviewed again. A key to-implement stopped goes into the final report.
5. A PR whose findings were **all** dismissed, kept or dropped as repeats got no new commit, so the other reviewers' passes still count: start again only the reviewers who raised them, on the same `head` (none when only the human's comments were answered: go to step 4.4). They read the answers in their threads and accept them, unless they have new evidence that the code breaks a written source.

## 6. Cleanup (final PRs only)

Once every reviewer passed on a final PR, call the Skill tool with "planning-cleanup" and the PR number. It pushes one commit that only deletes the planning files. The gate keeps the reviewers' passes and merges once CI is green. If it stops, put the PR in the final report. Then go to step 7.

## 7. Follow the merge gate

1. **Human review needed** (`needs-human-review` without `human-approved`): put it in the final report as "waiting for `human-approved`". Don't wait for it.
2. **Otherwise:** wait for the gate's runs: `gh run list --workflow factory-merge-gate.yml --limit 10 --json databaseId,status`, then `gh run watch <id>` for each still running. Then read `gh pr view <n> --json state,comments`:
   - `MERGED`: transition the story or bug (or the epic, for a feature final PR) to "Done".
   - Gate comment "CI failed" for the current head: take the failing checks' logs (`gh run view <run id> --log-failed`) as one `[rule]` finding from `ci`, and go to step 4.2 with it.
   - Gate comment "merge conflict": put it in the final report for a human.
   - Still open with neither: "gate pending" in the final report (the gate retries on its next event or 30-minute sweep).
3. **Epic complete:** after a story PR merges, if every story and bug of its epic is Done and no story PR into the epic branch is open, call the Skill tool with "to-pr" with `--final <EPIC KEY>`. (to-pr hands the new PR back to this skill.)

## 8. Final report

```
PR  #12  story  BREW-101  feature/… → epic/BREW-100-…   MERGED                 loops: 1
PR  #13  story  BREW-105  feature/… → epic/BREW-100-…   WAITING human-approved  H2: session cookie flags, src/auth/session.ts:40
PR  #20  final  BREW-100  epic/…    → develop           MERGED                 cleanup: 9 files
PR  #14  final  BREW-110  bug/…     → develop           STOPPED                loop cap: tests: R4 has no negative test
```

Then the keys to-implement stopped.

## 9. Continue the factory

Always the last thing you do, after the final report: if any PR got merged in this run, call the Skill tool with "to-implement" without arguments. Stories that were waiting on the merged ones are now ready.
