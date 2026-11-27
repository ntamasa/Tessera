---
name: github-setup
description: Set up or check a project's GitHub side of the factory - gh login, the GitHub remote, the develop branch, the factory labels, the gate token secret, CI, and the factory merge gate workflow (.github/workflows/factory-merge-gate.yml) that merges a PR once every reviewer has passed on its current head. Use when to-pr or to-review finds the setup missing, when the user asks to set up GitHub or the merge gate, or with "check" to only verify.
argument-hint: "[check]"
---

**Input:** nothing (set up what's missing, asking before each change), or `check` (only verify and report, change nothing).

**Output:** a checklist of the items below, each OK, FIXED or MISSING, and the next step.

The merge gate's template is `assets/factory-merge-gate.yml` next to this file. It's the only source: never write the workflow by hand.

## Checks, in order

Each item: check it. In `check` mode, record the result and go on. Otherwise, if it's missing, ask with AskUserQuestion before changing anything, with the options given.

1. **gh login:** `gh auth status`. Missing: tell the user to run `! gh auth login`, then check again. Never handle tokens yourself.
2. **GitHub remote:** `gh repo view --json nameWithOwner,defaultBranchRef,visibility,viewerPermission`. The permission must be `ADMIN`, `MAINTAIN` or `WRITE`.
   Missing: "This project has no GitHub repository. Create one?", options "Create private repo" (`gh repo create <folder name> --private --source . --remote origin --push`) and "Stop" (tell the user to add a remote).
3. **Target branch `develop`** on the remote: `git ls-remote --exit-code --heads origin develop`.
   Missing: "There's no develop branch on GitHub. Create it from <default branch>?", options "Create develop" (`git push origin origin/<default>:refs/heads/develop`) and "Stop". The factory always integrates into `develop` (`~/.claude/references/branches.md`).
4. **Labels:** `gh label list --json name`. Needs `factory`, `needs-human-review`, `human-approved`, `factory-stopped`. Missing ones are created without asking (labels change no code):
   - `gh label create factory --force --color 5319E7 --description "Made by the AI factory"`
   - `gh label create needs-human-review --force --color B60205 --description "Never merged without human-approved"`
   - `gh label create human-approved --force --color 0E8A16 --description "Reviewed by a human; removed on every new push"`
   - `gh label create factory-stopped --force --color 000000 --description "Loop cap hit: a human finishes it, the gate never merges it"`
   (`factory-loops-<n>` labels are created on the fly by `gh pr edit --add-label`.)
5. **Actions enabled:** `gh api repos/{owner}/{repo}/actions/permissions --jq .enabled` is `true`. Missing: tell the user to enable Actions in the repo's Settings → Actions. Don't change repo settings yourself.
6. **Gate token:** `gh secret list --json name` includes `FACTORY_GATE_TOKEN`. Missing: the gate does nothing without it. Tell the user to:
   1. Create a fine-grained personal access token for this repository only, with **Contents: Read and write** and **Pull requests: Read and write** (https://github.com/settings/personal-access-tokens/new).
   2. Run `! gh secret set FACTORY_GATE_TOKEN` and paste it at the prompt (never in chat).

   Why: branch updates and merges made with GitHub's own Actions token don't start CI, so the combined code would never be tested.
7. **CI exists:** at least one workflow besides the gate runs on `pull_request` (`.github/workflows/*.yml` on the default branch). Missing: warn that the gate will then merge with no tests run on the combined code, and suggest adding a CI workflow that runs the test suite. Don't write one yourself.
8. **Merge gate workflow** on the default branch and on `develop` (epic branches inherit it from `develop`): `gh api repos/{owner}/{repo}/contents/.github/workflows/factory-merge-gate.yml?ref=<branch> --jq .sha`, and compare the content with the template.
   Missing or outdated: "The merge gate workflow is missing (or outdated) on <branches>. Add it?", options "Open a PR" and "Stop".
   - **Open a PR:** on a new branch `chore/factory-merge-gate` from the default branch, copy the template to `.github/workflows/factory-merge-gate.yml`, commit it, push, and open a PR into the default branch with the label `needs-human-review` (it's factory config, rule H3). If `develop` is a different branch, open a second PR from the same branch into `develop`.
   - Tell the user: these PRs are merged by a human, never by the gate. The gate only works once the file is on the **default branch** (comment and sweep events run that copy) and on `develop` (push events run the PR's copy).

## Report

```
GitHub setup  <owner/repo>
OK      gh login
OK      remote          private, WRITE
FIXED   develop         created from main
OK      labels
OK      actions
MISSING gate token      run: ! gh secret set FACTORY_GATE_TOKEN
OK      CI              ci.yml
MISSING merge gate      PR #3 (main), PR #4 (develop): merge them to turn the gate on
```

Then these notes, once:

- **Your approval is a label.** GitHub doesn't let you approve your own PRs, and the factory opens PRs as you. For a `needs-human-review` PR: review it, then add the `human-approved` label. Every new push removes it again. To ask for changes instead, comment on the PR (inline or not) and run the factory (`claude --agent factory`): each comment is fixed (its thread resolved) or answered with the reason.
- **Branch protection (optional):** if your plan supports it, protect `develop` and the default branch against direct pushes. Don't require approving reviews: the gate merges as GitHub Actions, and you can't approve your own PRs.
- **Stale PRs:** when a PR's target branch moved on (another story merged), the gate merges the target into the PR and waits for CI again. The reviewers' passes still count, because that merge is the only new commit. Branch and PR model: `~/.claude/references/branches.md`.
