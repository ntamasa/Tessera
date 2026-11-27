---
name: to-tickets
description: Break an accepted spec.md into a Jira epic, stories or bugs, and subtasks detailed enough for a cheap coder model to implement without designing anything, then publish them through the jira skill. The ticket-writer agent (Opus, high effort) does the work and asks the user through this skill, which relays its questions and the answers word for word. Use when the user has a spec.md from to-spec and wants tickets, or asks to run to-tickets.
argument-hint: "[path to spec.md, default ./spec.md]"
---

**Input:** the spec.md at the path in the arguments, or `./spec.md`. If it doesn't exist, ask for its path before anything else. Optional: who called (`from factory`, `from spec-triage` or `from review-triage`, otherwise the user), and a triage skill's change note.

**Output:** the tickets in Jira, and their drafts (`tickets/` and `tickets.json` next to the spec), committed, all made by the **ticket-writer** agent.

**You only relay.** The ticket-writer agent breaks the spec down, writes the drafts, publishes and commits. Follow `~/.claude/references/relay.md` exactly: never answer, add, change or skip a question, never write or edit the drafts yourself, and leave the main checkout alone while the agent runs.

## 1. Before the agent

1. The project is a git repository. Stop and explain if not.
2. Call the Skill tool with "jira", then run its `check` command. If it fails, show the problem and call the Skill tool with "jira-setup" (it asks the user for the Jira details). Continue once `check` passes.

## 2. Relay

Start the agent with the Agent tool, `subagent_type: "ticket-writer"`, in the background, with this prompt:

```
spec: <path>
caller: <user | factory | spec-triage | review-triage>
change: <the triage skill's change note, word for word | none>
run: <factory | manual>
Follow the ticket-writer skill. Talk to the user only through relay blocks.
```

`run` is `factory` in a factory run (`~/.claude/references/factory-run.md`), otherwise `manual`. Then relay until the agent sends `done` or `stopped`. It may not request any skill.

## 3. Result

- **`done`:** the agent's `say` was already shown. If `notNeeded` lists keys, tell the user to close those tickets in Jira: the factory never deletes issues.
- **`stopped` because the spec has a gap** (its `next` is a change request for to-spec):
  - From a triage skill: stop and pass the reason and the change request back to it.
  - Otherwise ask with AskUserQuestion, options exactly "Revise the spec" and "Later": "The spec has a gap: <reason>. Revise it now?" On "Revise the spec", call the Skill tool with "to-spec", the intent path next to the spec, the change request, and `from factory` if you were called from factory. When it's done, run this skill again from step 2. On Later, name the to-spec command as the next step.
- **Any other `stopped`:** show the reason and stop.

## 4. Hand off

- **From a triage skill:** skip this step. to-implement or to-review is already running.
- **From factory:** don't ask. End here: the factory continues.
- **Otherwise:** ask with AskUserQuestion, options exactly "Start" and "Later": "Start implementing <EPIC KEY> now?" On Start, call the Skill tool with "to-implement" and the epic key (for a bug spec, the bug's key). On Later, name `to-implement <EPIC KEY>` as the next step.
