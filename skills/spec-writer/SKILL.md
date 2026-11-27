---
name: spec-writer
description: Rules for the spec-writer agent - turn an intent.md (and design files, if any) into a spec.md with the business rules, testable requirements and technical design needed to build it, grilling the user through the relay, and keep docs/business-rules.md up to date. Use only inside the spec-writer agent started by the to-spec skill.
---

You reach the user only through the relay (`~/.claude/references/relay.md`): end every message with exactly one relay block. "Ask" below always means a `questions` block.

**Input (from to-spec's prompt):**
- `intent`: the path of the intent.md
- `change`: a change request, or `none`. A change request means revise mode.
- `caller`: `user`, `factory`, `spec-triage` or `review-triage`
- `run`: `factory` or `manual`. In a factory run the user follows at a glance: keep `say` to what step 4 names for it, never recap answers or decisions, and send `done` without a `say`.

Also read when present: `design-changes.md` next to the intent, the living design files under `design/`, `docs/business-rules.md`, the project's CLAUDE.md and README.md, and the codebase.

**Output:** `spec.md` next to the intent.md, an updated `docs/business-rules.md`, a commit, and a `done` block: `{ "spec": "<path>", "commit": "<hash>", "branch": "<branch>" }`, with no `say` (in a manual run: the spec's path and a short summary: number of business rules and requirements, the main technical decisions, the risks).

First read `~/.claude/references/spec-format.md` and follow its rules and format throughout. If the feature has design files, also read `~/.claude/references/design-format.md`.

**Never decide anything yourself.** Every decision belongs to the user, business or technical, big or small: names, limits, messages, data shapes, library choices, edge-case behavior. If something has to be decided, ask it in grilling, with your recommended answer. Only facts the project already settles (the intent, the design files, `docs/business-rules.md`, the codebase) may go into the spec without asking. When unsure whether something is a fact or a decision, it's a decision: ask. If a new open decision turns up while writing or revising the spec, stop writing and ask it before continuing. Never fill a gap with a default, an assumption or "common practice".

## 1. Read

1. Preconditions. Send `stopped` with the reason if any fails:
   - The project is a git repository.
   - `git status --porcelain -- <spec path> docs/business-rules.md README.md` prints nothing.
2. **Revise mode** (`change` isn't `none`): `spec.md` exists next to the intent. Blocker reports and review findings never come here directly: `spec-triage` or `review-triage` turns them into the change request. Grill (step 2) only on the change and what it affects, edit the spec in place leaving everything else word for word, then continue at step 4. If `spec.md` doesn't exist, send `stopped`.
3. Record the current `HEAD` hash as `base_commit`.
4. Read the intent and work out from it whether it's a feature or a bug. If it doesn't say clearly, ask.
5. If there's a `design-changes.md` next to the intent, read it, then `design/DESIGN.md`, `design/screens/index.md`, and the screen specs and prototype screens of the screens it names.
6. Read `docs/business-rules.md` if it exists. Its rules are settled.
7. Explore the codebase for what the spec needs: the stack, the modules the feature touches, existing patterns to copy (with paths), how tests are set up and run, the seams already tested, migrations, API conventions, and for UI work how design tokens and prototype styles map into the app. For a bug: find the cause in the code (`path:line`) and confirm it, by reasoning or by running a test, before step 2.

## 2. Grill

Call the Skill tool with "grilling", in its relay mode. The design tree's root is everything spec.md needs that isn't settled yet. Its branches:

- **Business gaps:** what the brief intent leaves open, for example edge cases, validation and limits, what happens on each kind of wrong input or failure and the exact messages, empty states, ordering, data rules, and how the feature interacts with existing business rules.
- **Technical decisions:** data model and migrations, API contracts, module boundaries and names, where logic lives, the seams under test and what is mocked, test setup, and risks.

Skip anything the intent, the design files, `docs/business-rules.md` or the codebase already settle. Facts come from the codebase, decisions from the user.

- **Conflicts:** if an answer contradicts the intent or an existing business rule, ask which one wins. Never overwrite silently. The intent itself is never edited: the spec records the decision.
- **UI impact:** if a decision changes something the user sees that the design files don't show (a new state, message, control or screen), finish the current grilling round, then send a `request`: `{ "skill": "to-design", "args": "<intent path>  New UI requirements: <the requirements from the grilling>", "why": "..." }`. When the result says it committed, re-read the design files it changed and continue grilling. If it stopped, ask the user how to go on.

## 3. Write spec.md

Write `spec.md` next to the intent in the format from the reference: the intent's objective and constraints, the business rules settled in the intent and in grilling, the requirements, the bug section for a bug, the technical design and what's out of scope. The spec must be self-contained: no later step reads the intent. Then check it:

- Nothing from the intent is lost: its objective is in Objective, every success criterion is covered by a requirement, every constraint is listed under Constraints and covered, and everything it puts out of scope is under Out of scope.
- Every behavior has its failure cases as requirements, next to the happy path, each with the exact error and what stays unchanged.
- Every requirement is testable with literal values, references existing business rules, and names screens and states that exist in `design/screens/index.md`.
- Every path the design says to modify exists, and every path it says to create doesn't.

## 4. Accepted by default

Don't ask the user to accept the spec: it's accepted once it's written and checked. Go straight on to step 5.

The user looks at it only when they want to. A `RELAY USER MESSAGE` asking for changes before you sent `done`: go back to step 2 with those changes only, edit the spec in place, then continue here. Later changes go through `to-spec` with a change request (revise mode).

## 5. Package

1. **Business rules:** update `docs/business-rules.md` from the spec's business rules, as the reference describes: add new rules, edit changed ones in place, remove ones the spec drops. If the file is new, link it from the README.md.
2. **Commit** on the feature's planning branch (`~/.claude/references/branches.md`): if the current branch is a `plan/`, `epic/` or `bug/` branch, use it. Otherwise create `plan/<feature folder name>` from `origin/develop` (`develop` if there's no remote; ask which base to use if neither exists) with `git switch -c`, so uncommitted files come along. Commit `spec.md`, `intent.md` and `design-brief.md` (if not committed yet), `docs/business-rules.md` and the README.md (if changed). On an `epic/` or `bug/` branch (revise mode, called by a triage skill), also push it. Never push a `plan/` branch.
3. Send `done`.

Don't edit the intent, don't edit design files except through the `to-design` request, and don't write tickets or code. From here on, the spec replaces the intent.
