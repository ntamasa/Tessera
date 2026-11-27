# Spec rules & format

Written by the `to-spec` skill, read by `to-tickets`. Also covers `docs/business-rules.md`, which `to-spec` keeps up to date.

## Where things live

| Path | Kind | Content |
|---|---|---|
| `spec.md` | per-feature | Next to the intent.md. Everything about one intent: its objective and constraints, business rules, testable requirements and technical design. Published to Jira by `to-tickets`, then deleted by `planning-cleanup` on the final PR, just before it merges into `develop` (see `branches.md`) |
| `docs/business-rules.md` | living | Every business rule of the product, current state only. Linked from the project's README.md |

The intent is the short business brief. The spec carries over everything the intent says, fills its gaps and adds everything needed to build it. **The spec is self-contained:** once written, it replaces the intent, and no later step reads the intent. The intent itself is never edited by `to-spec`.

## Rules

- **Requirements are testable.** Each one is a Given / when / then with literal values (names, numbers, messages), so a test's expected value can be copied from it. No "should work correctly", no "appropriate message".
- **Nothing from the intent is lost.** Its objective goes into Objective. Every success criterion is covered by at least one requirement. Every constraint is listed under Constraints and covered by a requirement, the technical design or Out of scope. Everything it puts out of scope is under Out of scope.
- **Failures are requirements too.** Every behavior that takes input or depends on data or another system has requirements for its failure cases, next to the happy path: invalid and missing input, each limit (the last allowed value and the first rejected one), not found, conflicts, and failures of external systems. Each one names the exact error, status or message and what stays unchanged. Tests copy their expected values from these.
- **The technical design is concrete:** exact module, class, function and file names, signatures, paths (relative to the git root), data model and API contracts. No whole files and no boilerplate. A short snippet or pseudocode only where the logic is hard.
- **Only what was settled.** Everything comes from the intent, the design files, `docs/business-rules.md`, the codebase or the grilling. Mark decisions that come from grilling with "(from grilling)" in business rules.
- **IDs are stable.** Business rules are `B1`, `B2`…, requirements `R1`, `R2`…. When the spec is revised, existing IDs keep their number, removed ones disappear, new ones take the next free number.
- **Headings are unique**, because `to-tickets` publishes sections by heading.
- **Current state only:** no revision notes, no history, no dates.
- **Size:** each `###` section of the technical design goes into a Jira description, and the whole technical design goes into the epic, which holds at most about 12k characters of Markdown. Keep each subsection about one module or concern, so `to-tickets` can move subsections to stories when the epic gets too big.

## spec.md

```markdown
---
intent: ./intent.md
design: ./design-changes.md      # only when the feature changes the UI
type: feature                    # feature | bug
base_commit: <HEAD when to-spec started>
---

# Spec: <name>

## Objective
From the intent, condensed to one paragraph: the problem, who it's for, the business reason and the desired outcome.

## Summary
Two or three sentences: what changes for the user and what changes in the system.

## Constraints
- <constraint from the intent> → where it's covered (e.g. R4, Technical design → Data model, Out of scope)

## Business rules

### B1 — <title>
The rule in one to three sentences. (from grilling)

## Requirements

### R1 — <title>
**Given** <state, with literal values>, **when** <action>, **then** <observable result, with literal values>.
- **Rules:** B1
- **Screens:** `brews` (default, favorites-empty)

## Bug

### Reproduction
1. Step
2. Step

**Expected:** … **Actual:** …

### Cause
What goes wrong and where (`path:line`), verified in the code.

### Fix
The change, in prose.

## Technical design

### Overview
Which modules change and how they work together, in a few sentences.

### Data model
Tables, columns, constraints, migrations (file names).

### API
| Method | Path | Body | Response |
|---|---|---|---|

### <Module or layer, e.g. Backend, Frontend>
Files to create or change, with the classes/functions in each and their signatures.

### UI implementation
How DESIGN.md tokens and the prototype map into the app's styles and components.

### Seams and tests
| Seam | Covers | Setup | Mocked |
|---|---|---|---|
| HTTP API | R1, R2 | real test database | nothing |

### Conventions
Existing files to copy patterns from, with what to copy.

### Hard logic
Short snippet or pseudocode, only for what isn't obvious.

### Risks
What could break, and how the design handles it.

## Out of scope
- What this spec deliberately doesn't do.
```

- **Requirements:** "Rules" lists the business rules it applies. "Screens" lists the screens and states (from `design/screens/index.md`) it shows, and is omitted when there is no UI.
- **Bug section:** only when `type: bug`. The requirements then describe the correct behavior.
- **Technical design:** omit subsections that don't apply, and add one per module or layer the feature touches.

## docs/business-rules.md

```markdown
# Business rules

## <Area, e.g. Brews>
- **<Rule title>:** the rule, in one or two sentences.
```

- Grouped by area of the product, areas in the order the user meets them.
- Current state only: when a rule changes, the line is edited in place, never appended as "changed".
- No spec IDs: those are per feature.
- If the file doesn't exist, create it and add one line linking to it from the README.md (if there is one).
