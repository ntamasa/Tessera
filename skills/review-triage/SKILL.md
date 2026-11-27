---
name: review-triage
description: Route the findings of the factory's reviewers back into the factory. For each finding, find what is wrong (the code against a clear spec, the spec itself, the design itself, or the reviewer) or decide a judgement call (fix it or keep the code) from the finding and the evidence, then fix it through to-tickets, to-spec and/or to-design, so to-implement can build the fix. Use when the to-review skill hands over review findings, or the user asks to run review-triage.
argument-hint: "[the findings inline, or a path to them]"
---

**Input:** findings from REVIEW REPORTs (every finding blocks; each is `[rule]` or `[judgement]`) (format in `~/.claude/skills/reviewer/SKILL.md`), each with its reviewer, PR and story, all for stories of the **same spec**. A finding from `ci` is a failing CI check with its log: classify it like any other (usually F; S or a human when the failure isn't in the PR's code). On a feature's **final PR** (epic → develop) the stories are already Done: name the story whose code the finding is in, and to-tickets' done-work rule turns the fix into a new `Change:` story under the epic. If they belong to different specs, handle one spec at a time.

**Output:** the design, spec and/or tickets changed so that every finding that isn't dismissed or kept has a subtask to fix it, and a result for `to-review`.

**Never decide anything about the product.** You only find *what* is wrong, and you decide that yourself from the evidence: the user isn't asked to confirm a class. How the product should behave or look comes from the user, through the grilling of `to-spec` and `to-design`.

## 1. Read

1. The spec: the `spec.md` next to the `tickets.json` that holds the story's key. Its frontmatter gives the intent's path. If no manifest holds the key, stop: there's no spec to fix, so the finding goes to a human.
2. For each finding: the story and its subtasks (`jira read <KEY> --parents`), the code at `where`, and the source the finding quotes (spec section, ticket, design file, standard).

## 2. Classify each finding

Put every finding into exactly one class:

| Class | When | Fix |
|---|---|---|
| **F. Code is wrong** | The spec, ticket, design or documented standard the finding quotes is clear, and the code or test doesn't follow it. Includes UI that doesn't match a correct design. | `to-tickets`: a new `Fix:` subtask |
| **S. Spec is wrong or silent** | Following the spec still gives the finding: the spec has a gap (an unhandled case, a security risk it never considered, an architecture choice it left open) or a contradiction. | `to-spec` revise → `to-tickets` |
| **D. Design is wrong** | A UI or UX finding the design itself causes: the design has no state for it, or its flow or look is the problem (the ui-ux reviewer marks these "(design)", but check). | `to-design` → `to-spec` revise → `to-tickets` |
| **X. Finding is wrong** | The reviewer misread the source, quoted the wrong requirement, or the code does follow it. | Dismiss, with the reason |
| **J. Judgement call** | A `[judgement]` finding: no written source is broken (a smell, a heuristic, an improvement), and fixing it changes nothing the user sees or the spec settles. | You decide: **fix** (`to-tickets`: a new `Fix:` subtask) or **keep** (the code stays, with the reason) |

Evidence for every class: quote the source and the code. A `[rule]` finding, including one the reviewer was unsure about, is never X for being a judgement call: X only when the evidence shows the reviewer is wrong.

**J: decide it yourself**, from the codebase and the project's standards. It's a code-quality call, not a product decision. **Fix** when the change makes the code clearer, safer or easier to change and stays inside the spec and tickets. **Keep** when the code follows an existing pattern of the codebase, the change costs more than it gains, or it would go against the spec, the tickets or a documented standard. Either way, write the reason in one sentence. A judgement finding that would change behavior, data, an API or anything the user sees isn't J: classify it S or D (the user decides through grilling).

**When the evidence doesn't settle it,** pick the class that goes back further: D or S over F.

**X only on clear evidence:** quote the source that shows the reviewer is wrong. **Disputes and repeats**, checked against the PR's review threads (`node ~/.claude/skills/to-review/scripts/pr-threads.mjs list <n>`: the replies with a `decision=` marker; on a final PR, also its epic's story PRs):
- **`[disputes decision]`** (the reviewer re-raised a finding dismissed or kept earlier, with new evidence that it breaks a written source): decide it again from all the evidence, the reviewer's new evidence first. Any class is possible, X and a kept J too. This second decision is **final**: the reviewer accepts it and can't dispute it again.
- **Repeat:** a finding that matches a decided one (the same code and the same issue, whatever its title) without a proper dispute, or any finding against a `final` decision: drop it, citing that decision. Nothing new is recorded.

**The human's comments** (reviewer `human`: what the user wrote on the PR, inline or not) are the user's own word, not a reviewer's:
- Never a kept J, never a repeat, never `final`. A human reply that disagrees with a decision is decided again, and is never X again.
- For S or D, the comment is the user's decision: pass it to to-spec or to-design quoted, as decided, so they don't ask it again. Ask only what it leaves open.
- X only when the code already does what it asks (say where) or it asks for no change (a question: answer it in the reason). The reason is the reply the user reads on the PR.

Show the user one block per finding (reviewer, PR, story, the finding, the class, the evidence), then go straight on to step 3. Don't wait for a confirmation.

## 3. Fix

In this order, each skill once with all its findings:

1. **D:** call the Skill tool with "to-design", arguments: the intent's path and the D findings as new UI requirements ("called by review-triage"). It grills the user, updates the design files, gets the user's acceptance and commits.
2. **S, and D after to-design:** call the Skill tool with "to-spec", arguments: the intent's path, `from review-triage`, and one change request listing every S finding, and for D the design changes to carry into the spec (`design-changes.md`). It grills, revises the spec, waits for acceptance and commits.
3. **Tickets, for F, S and D:** call the Skill tool with "to-tickets", arguments: the spec path and a change note with `from review-triage` and, per finding, the story and what the fix subtask must make true (for F: the quoted source the code must follow). Its done-work rule turns every change to finished work into a new issue: a `Fix:` subtask under a story that's in review, or a new `Change:` story under the epic when the story is Done (a feature's final PR).
4. If any of them stops with a gap it can't resolve, stop and pass its message on.

## 4. Result

```
REVIEW TRIAGE  spec: <path>  commit: <hash>
BREW-101  F  new subtask BREW-130 "Fix: negative test for R4"   (finding: tests #1 t:4698, PR #12)
BREW-101  X  dismissed: R2 allows 0, the reviewer read "> 0"     (finding: spec #2 t:4699, PR #12)
BREW-101  J  kept: same mapper pattern as src/brews/brew.mapper.ts (finding: code #3 t:4700, PR #12)
BREW-101  X  dismissed (final): R2 still allows 0              (finding: spec #1 [disputes decision] t:4699, PR #12)
BREW-101  -  repeat of decision on code #3, dropped               (finding: code #2 t:4710, PR #12)
BREW-101  J  fix: new subtask BREW-131 "Fix: rename tmp to favoriteIds" (finding: code #1 t:4711, PR #12)
BREW-101  F  new subtask BREW-132 "Fix: name the CI steps"    (finding: human t:4712, PR #12)
BREW-101  X  no change needed: R7 already runs the tests, see backend.yml:21 (finding: human c:7168, PR #12)
```
