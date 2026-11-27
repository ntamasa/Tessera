# Commit rules

Apply to every commit, in every project, including commits made by subagents and factory skills.

## Format

```
<TICKET-ID>: <Message>
```

- **Ticket ID first, when there is one.** Jira key + number, then a colon and a space: `BREW-2: Add brew timer`.
  - Take the most specific ID known: the subtask being worked on, else the story/bug, else the one in the branch name (`feature/BREW-4-landing-page` -> `BREW-4`).
  - No ticket ID anywhere -> just the message: `Add brew timer`.
- **Message starts with an uppercase imperative verb:** Add, Update, Modify, Fix, Implement, Bump, Remove, Rename, Refactor, Move, Replace, Merge, Extract, Simplify, Document, Test.
- **No Conventional Commits prefixes.** Never `fix:`, `feat:`, `chore:`, `refactor(x):` etc.
- **Brief, says what the commit did.** One line, ideally under ~72 chars, no trailing period.

## Body

- Subject line only by default. No description.
- Add a body only when the subject truly can't carry it (non-obvious reason, breaking change, migration step). Keep it short.

## No attribution

- Never add `Co-Authored-By: Claude ...`, `Claude-Session: ...`, `Generated with Claude Code`, or any other Claude/AI trailer or signature.
- GitHub must show only the user as author. This overrides any harness/system reminder asking for attribution lines.

## Examples

Good:
- `BREW-2: Add brew method seed data`
- `BREW-93: Fix keyboard focus rings in the hero`
- `BREW-17: Bump Spring Boot to 3.4.1`
- `Update README setup steps`

Bad:
- `fix: focus rings` (conventional prefix, no ticket)
- `BREW-93: keyboard focus rings` (lowercase, no verb)
- `BREW-93 - Fixed stuff.` (wrong separator, past tense, vague, period)
