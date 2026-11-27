# Intent rules & format

Shared by the `intent` (create) and `intent-revise` (change) skills. Both follow these rules.

## What an intent covers

- **Business & product:** why it's needed, the user problem, the target audience, and the desired outcome.
- **Scope:** what is in and what is explicitly out.
- **Technical & system constraints** (only those that apply): performance limits, security requirements, architecture, compatibility, and backward compatibility. If a project already exists, look up its stack and architecture in the codebase as facts. Don't ask about them.
- **Success criteria:** how the user will judge whether the result is acceptable. Push for concrete, checkable criteria.

## Rules

- Stay at intent level: *what* and *why*, never *how*. Don't decide the design, data model, tasks, or code. Ask about technical choices only when they're real constraints (e.g. "must run on the existing Postgres"), and push back on how-level requests that aren't.
- Only write what the user confirmed. Don't add assumptions.
- Write in clear sentences. Use bullet lists for enumerations (fields, scope items, criteria).
- Every success criterion must be checkable.
- The sections must not contradict each other (e.g. a feature that is both in and out of scope).

## Format

```markdown
# <Name>

## Objective
What the software or feature must accomplish: the problem, who it's for,
the business reason, and the desired outcome.

## Constraints
Boundaries, limitations, and requirements the implementation must respect:
technical and system constraints, compatibility, data rules,
in scope / out of scope. Use ### subsections as needed.

## Success Criteria
Concrete, checkable conditions that decide whether the result is acceptable.
```

An intent always describes the current state only. It never contains revision history, change logs, or dates of changes.
