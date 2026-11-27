---
name: intent
description: Turn a short description of a new feature, bug fix, or change into a clarified intent.md (objective, constraints, success criteria) by grilling the user on the business reason and constraints. Use when the user gives a one- or few-sentence description of something they need and wants to start planning it, or asks to write an intent. To change an existing intent.md, use intent-revise instead.
argument-hint: "<one or a few sentences describing what is needed>"
---

**Input:** the arguments, a short description (one or a few sentences) of a new feature, bug fix, or change. If there are no arguments, ask for that description before anything else.

**Output:** a new `intent.md` file. It's the base that a design or detailed plan is built from later.

First read `~/.claude/references/intent-format.md` and follow its rules and format throughout.

## 1. Clarify

Call the Skill tool with "grilling" and grill the user on the description. The design tree's root is the description. Its branches are the areas listed under "What an intent covers" in `~/.claude/references/intent-format.md`.

## 2. Write intent.md

Once grilling is done (no open questions left), write `intent.md` in the current working directory (or the project folder the user named), using the format from `~/.claude/references/intent-format.md`. If an `intent.md` already exists there, don't overwrite it. Point the user to `intent-revise` for changing it, or ask for a different location.

## 3. Hand off

Decide from the intent whether it needs UI design: it adds or changes something the user sees (a screen, a state, a control, a message, a flow, the look).

**Called by factory** (the arguments end with `from factory`): don't ask Start or Later. End with exactly one line, `NEXT: to-design` or `NEXT: to-spec`, and the factory continues. When not sure, first ask with AskUserQuestion, options exactly "Design first" and "Spec directly": "Does this intent need UI design before the spec?"

Otherwise, ask with AskUserQuestion, options exactly "Start" and "Later":

- **UI design needed:** "This intent changes the UI. Start designing it now?" On Start, call the Skill tool with "to-design" and the intent's path (plus the path of a `design-brief.md` next to it, if there is one). On Later, name `to-design <intent path>` as the next step.
- **No UI design:** "This intent doesn't change the UI, so the next step is the spec. Start it now?" On Start, call the Skill tool with "to-spec" and the intent's path. On Later, name `to-spec <intent path>` as the next step.
- **Not sure:** ask instead, options exactly "Design first", "Spec directly" and "Later": "Does this intent need UI design before the spec?" Then call the matching skill as above.

Don't write a design, plan, tickets, or code. Finish by giving the file path, before the hand-off question.
