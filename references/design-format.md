# Design files format

Used by the `to-design` and `design-baseline` skills, and read by `to-spec` and `to-tickets`. All living design files live under `design/` at the project root (git root).

## File map

| Path | Kind | Format |
|---|---|---|
| `design/DESIGN.md` | living | Google Stitch DESIGN.md (see below) |
| `design/screens/index.md` | living | Markdown list of all screens |
| `design/screens/<screen>.md` | living | Markdown per-screen spec (see below) |
| `design/prototype/index.html` | living | HTML navigation between screens and states |
| `design/prototype/tokens.css` | living, generated | CSS custom properties generated from DESIGN.md. Never hand-edited |
| `design/prototype/screens/<screen>.html` | living | Static HTML per screen, `?state=` switch |
| `design/screenshots/<screen>.<state>.png` | living | Clean screenshot of the current design |
| `design/screenshots/<screen>.<state>_deprecated.png` | temporary | The "before" screenshot of a changed or removed screen. Deleted by `planning-cleanup` on the final PR (see `branches.md`), never by `to-design` |
| `design-changes.md` | per-feature | Changelog of this run, written next to the intent.md |
| `design-brief.md` | per-feature, optional input | The user's initial design idea (free-form Markdown), next to the intent.md. Read by `to-design`, never written by it |

`<screen>` is kebab-case and identical across all files of a screen (e.g. `todo-create`). `<state>` is kebab-case (e.g. `default`, `empty`, `loading`, `error`, `recurring-on`).

## DESIGN.md

Follow the Google Stitch DESIGN.md spec (google-labs-code/design.md, version alpha):

- YAML front matter with the tokens: `version`, `name`, `description`, `colors`, `typography`, `rounded`, `spacing`, `components`. Token references use `{group.token}`, e.g. `{colors.primary}`.
- Markdown `##` sections in this order (omit ones that don't apply): Overview, Colors, Typography, Layout, Elevation & Depth, Shapes, Components, Do's and Don'ts.
- `colors.primary` is required. Component variants are separate keys (`button-primary`, `button-primary-hover`).
- The full spec is in `~/.claude/references/design-md-spec.md`. Read it before creating or redesigning DESIGN.md.

Tooling (the `designmd` CLI, installed globally once):

- Lint: `designmd lint design/DESIGN.md`. Errors block; warnings are reported.
- Tokens: `designmd export --format css-tailwind design/DESIGN.md`, with the `@theme {` block opener replaced by `:root {`, written to `design/prototype/tokens.css`. The result must be plain CSS custom properties a browser understands without Tailwind. Variable names: `--color-<name>`, `--font-<name>`, `--text-<name>` (font size), `--font-weight-<name>`, `--radius-<name>`, `--spacing-<name>`. The export doesn't include `lineHeight`/`letterSpacing` or `components`: take those values from DESIGN.md and build component styles in the prototype from the exported variables.

In **evolve** runs, tokens may only be added, never changed or removed. Changing existing tokens happens only in a redesign.

## Prototype

- Every screen file is a full standalone page: `<!doctype html>`, charset and viewport metas, `<link rel="stylesheet" href="../tokens.css">`.
- Styles use only `var(--...)` values from tokens.css. No raw hex, px font sizes or colors that aren't tokens.
- States: a small inline script reads `?state=<state>` (default `default`) and shows the matching state. Every state listed in the screen's md must be reachable this way.
- `index.html` links every screen and each of its states.
- No external assets except Google Fonts stylesheets and scripts from cdnjs.cloudflare.com, cdn.jsdelivr.net/npm/ or unpkg.com with exact versions. Images are inline SVG or placeholders.
- Realistic dummy content, never lorem ipsum.

## screens/index.md

```markdown
# Screens

| Screen | Purpose | States |
|---|---|---|
| [todo-list](todo-list.md) | All todos, filterable | default, empty, loading, error |
```

Followed by a `## Flows` section: the user flows as `screen → screen` chains with the action that moves between them.

## screens/<screen>.md

```markdown
# <Screen title>

**Purpose:** what the user does here, in one or two sentences.
**Prototype:** `../prototype/screens/<screen>.html`

## Layout
Regions top to bottom, using DESIGN.md component and token names.

## Data shown
| Field | Source/type | Notes |

## States
| State | When | What differs |

## Interactions
- Action → result (navigation, validation, feedback).

## Design decisions
- Decision — why (from grilling).
```

## design-changes.md

Written next to the intent.md, describes everything this feature changed in the design. If `to-design` runs again for the same intent (e.g. called by `to-spec`), it rewrites the file to cover all the feature's changes and keeps the first run's `base_commit`. Read by the spec and tickets skills, so it must be understandable without reading any diff.

```markdown
---
intent: ./intent.md
brief: ./design-brief.md   # only if a brief was used
mode: evolve | redesign | fresh
base_commit: <HEAD before the feature's first to-design run>
---

# Design changes: <feature>

## Summary
Two or three sentences.

## Design system changes
New tokens/components (evolve) or the redesign of DESIGN.md. "None" if none.

## Screens

### <screen> — new | modified | removed
- **Before:** `design/screenshots/<screen>.<state>_deprecated.png` (modified/removed only)
- **After:** `design/screenshots/<screen>.<state>.png` (new/modified only)
- **Changes:** exact, element-level list (e.g. "Add 'Repeat' toggle below the due date; when on, show frequency select and end date").
- **New data fields:** field, type, notes.
- **New/changed states:** list.
- **Unchanged:** "Everything else on this screen stays as is. Do not restyle."
```
