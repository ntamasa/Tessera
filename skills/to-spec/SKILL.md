---
name: to-spec
description: Turn an intent.md (and design files, if any) into a spec.md with the business rules, testable requirements and technical design needed to build it, and keep docs/business-rules.md up to date. The spec-writer agent (Opus, extra-high effort) does the work and grills the user through this skill, which relays its questions and the answers word for word. Calls to-design when a decision changes the UI. Use when the user has an intent (and design) and wants to plan the implementation, asks for a spec, or asks to run to-spec.
argument-hint: "[path to intent.md, default ./intent.md] [change request, only to revise an existing spec.md]"
---

**Input:** the intent.md at the path in the arguments, or `./intent.md`. If it doesn't exist, ask for its path before anything else. Optional: a change request (revise mode), and who called: `from factory`, `from spec-triage` or `from review-triage` (otherwise the user).

**Output:** `spec.md` next to the intent, an updated `docs/business-rules.md` and a commit, all made by the **spec-writer** agent.

**You only relay.** The spec-writer agent reads, grills, writes and commits. Follow `~/.claude/references/relay.md` exactly: never answer, add, change or skip a question, never write or edit the spec yourself, and leave the main checkout alone while the agent runs.

## 1. Before the agent

1. The project is a git repository. Stop and explain if not.
2. **Existing spec, no change request:** if `spec.md` already exists next to the intent and the arguments hold no change request, ask with AskUserQuestion, options exactly "Revise" and "Stop": "spec.md already exists next to the intent. Revise it?" On Revise, ask in chat what should change: the user's answer, word for word, is the change request.

## 2. Relay

Start the agent with the Agent tool, `subagent_type: "spec-writer"`, in the background, with this prompt:

```
intent: <path>
change: <the change request, word for word | none>
caller: <user | factory | spec-triage | review-triage>
run: <factory | manual>
Follow the spec-writer skill. Talk to the user only through relay blocks.
```

`run` is `factory` in a factory run (`~/.claude/references/factory-run.md`), otherwise `manual`. Then relay until the agent sends `done` or `stopped`. The one request you may run: **`to-design`** (call the Skill tool with "to-design" and the request's args).

## 3. Result

- **`stopped`:** show the reason and stop. The calling skill (if any) gets that reason.
- **`done`:** the spec's path, branch and commit are in the block, and the agent's `say` was already shown. From here on, the spec replaces the intent.

## 4. Hand off

- **From a triage skill:** skip this step. The triage skill calls `to-tickets` itself.
- **From factory:** don't ask. End here: the factory continues.
- **Otherwise:** ask with AskUserQuestion, options exactly "Start" and "Later": "Create the tickets for this spec now?" On Start, call the Skill tool with "to-tickets" and the spec's path. On Later, name `to-tickets <spec path>` as the next step.
