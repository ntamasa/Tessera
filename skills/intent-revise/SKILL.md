---
name: intent-revise
description: Change an existing intent.md created by the intent skill. Clarifies the requested change by grilling the user on it and what it affects, checks consistency, shows a diff, then edits the file in place. Use when the user wants to modify, fix, extend, or remove something in an already generated intent.md.
argument-hint: "<path/to/intent.md> <short description of the change>"
---

**Input (both required):**
1. The path to an existing `intent.md`.
2. A short change request (one or a few sentences), e.g. "add photo upload", "drop method renaming", "success criteria are too vague".

Check both before doing anything else, and don't search for or guess either one:
- **Path missing** (or the file doesn't exist): stop immediately and ask the user for the path to the `intent.md`.
- **Change request missing:** stop immediately and ask the user what the change should be.

Continue only once both are provided.

**Output:** the same `intent.md`, edited in place.

First read `~/.claude/references/intent-format.md` and follow its rules and format throughout.

## 1. Understand

Read the whole intent and the change request. Work out which sections and lines the change touches, directly and through knock-on effects. For example, adding photos touches scope, out of scope, storage constraints, and success criteria.

Everything the intent already says counts as a **settled decision**. Don't reopen it unless the change conflicts with it.

## 2. Clarify

Call the Skill tool with "grilling". The design tree's root is the change request, and its branches are the parts of the intent it affects, plus any new open decisions it introduces. Only grill on those. Specifically:

- **Conflicts:** if the change contradicts an existing line (e.g. a feature listed as out of scope), ask which one wins. Never silently overwrite.
- **Knock-on effects:** for each affected section, confirm how it changes. In particular, every new or changed behaviour needs a checkable success criterion.
- **How-level requests:** if the change is about *how* to build something rather than a real constraint, push back as the format rules require.

## 3. Review the diff

After grilling is done (no open questions left), give the user a short log of what changes and why (a few bullets, in chat only), then a unified diff of the planned changes to `intent.md`. Only touch the affected lines and leave everything else word for word. Then use one AskUserQuestion call: "Apply these changes to intent.md?", with options "Apply (Recommended)" / "Adjust". On "Adjust", take the feedback, return to step 2 if needed, and show the diff again.

## 4. Apply

Edit the file in place so it reads exactly as if `intent` had originally generated it this way. Leave no trace of the revision: no revision or changelog section, no dates, no notes, and no wording like "now", "added", "no longer", "changed to", or "previously". Then re-read the whole file and check it against the format rules: no contradictions, and all success criteria checkable. Finish by giving the file path and a one-line summary.

Don't write a design, plan, tickets, or code.
