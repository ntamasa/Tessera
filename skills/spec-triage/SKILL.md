---
name: spec-triage
description: Route the blocker reports of the implement phase back into the factory. For each blocker, find which artifact is wrong (the spec has a gap or conflict, the spec is ambiguous, or the spec is clear but the ticket didn't carry it) from the report and the evidence, then fix it through to-spec (revise mode) and/or to-tickets (update mode) so the implementer can continue. Use when the to-implement skill hands over blocker reports, or the user asks to run spec-triage on a blocker.
argument-hint: "[path to the blocker reports, or the reports inline]"
---

**Input:** one or more blocker reports from the `implementer`, each listing one or more blockers (format in `~/.claude/skills/implementer/SKILL.md`), all for tickets of the **same spec**. If they belong to different specs, handle one spec at a time.

**Output:** the spec and/or the tickets changed so that every blocker is answered, and a short result for the `to-implement` skill: which blocked subtasks were updated in place, which new subtasks were created, per story.

**Never decide anything about the product.** You only find *where* the answer is or should be, and you decide that yourself from the evidence: the user isn't asked to confirm a class. Answers to open questions come from the user, through `to-spec`'s grilling.

## 1. Find the spec

1. For each blocked subtask key, find the `tickets.json` that holds it (search the repo for the key in `**/tickets.json`). The spec is the `spec.md` next to it. Stop and say so if no manifest holds the key.
2. Read the spec, the blocked subtask with its story and epic (`jira read <KEY> --parents`, through the `jira` skill), the subtask's draft in `tickets/`, and the code the report points to.

## 2. Classify each blocker

Put every blocker into exactly one class:

| Class | When | Fix |
|---|---|---|
| **A. Gap or conflict** | The spec doesn't answer the question, or contradicts itself, the codebase, or `docs/business-rules.md`. | `to-spec` revise → `to-tickets` update |
| **B. Ambiguous spec** | The spec answers it, but the text can be read in more than one way (quote the passage and name each reading). | `to-spec` revise (asks which reading was meant, rewords it) → `to-tickets` update |
| **C. Ticket didn't carry it** | The spec answers it clearly, but the subtask doesn't contain or point to that part ("Read first", tests, names), or the implementer misread a clear ticket. | `to-tickets` update only: no spec change |

Evidence for every class: quote the spec section (heading) and the ticket text, or state that there is none.

**When the evidence doesn't settle it,** pick the class that goes back further: A over B, B over C. A wrong A only costs a question in `to-spec`; a wrong C hides a spec gap.

Outside a factory run, show the user one block per blocker (the blocked subtask, the question, the class, the evidence); in a factory run, only the triage line per item. Then go straight on to step 3. Don't wait for a confirmation.

## 3. Fix

1. **A and B:** call the Skill tool with "to-spec", arguments: the spec's intent path, `from spec-triage`, and one change request that lists every A and B blocker (the question, the evidence, and for B the readings). `to-spec` grills the user, revises the spec in place and commits. Don't answer any question for it.
2. **Tickets, always:** call the Skill tool with "to-tickets", arguments: the spec path and a change note listing:
   - every blocked subtask and what it must now contain or point to (C blockers: the spec section that answers it),
   - `from spec-triage`, so it runs its update mode without asking "Update or Stop" and applies the done-work rule.

   `to-tickets` updates not-done subtasks in place and creates new subtasks for changes to done work.
3. If `to-spec` or `to-tickets` stops with a gap it can't resolve, stop and pass its message on.

## 4. Result

End with a block for `to-implement`:

```
TRIAGE RESULT  spec: <path>  commit: <hash>
BREW-103  class A  updated in place
BREW-102  done     new subtask BREW-120 "Change: ..." (blocked by BREW-104)
```

Don't write code, and don't change the intent or the design files except through `to-spec`.
