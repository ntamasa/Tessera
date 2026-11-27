---
name: grilling
description: Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test their thinking, or uses any 'grill' trigger phrases.
---

<!-- Adapted from mattpocock/skills (skills/productivity/grilling), MIT License, Copyright (c) Matt Pocock. -->

Interview the user relentlessly until you reach a shared understanding. Map this as a **design tree**: every decision branches into the decisions that hang off it.

Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are already settled: the questions you can ask _now_ without guessing at answers you haven't heard yet. Ask the whole frontier in one round: number each question and give your recommended answer. Then wait for the user's answers before the next round.

Ask every question with the **AskUserQuestion** tool, one question per call:

- `header`: short topic chip (max 12 chars), e.g. "Stack", "Database".
- `question`: self-contained, with any context it needs (the user may see only the dialog). Prefix it with its number in the round, e.g. "Q2/4:".
- `options`: 2–4 concrete, mutually exclusive answers. Put your **recommended answer first**, with " (Recommended)" at the end of its label. Each `description` states the trade-off in one sentence. Use `preview` only to compare concrete artifacts (code, schemas, layouts).
- Use `multiSelect: true` only when the answers aren't mutually exclusive.

If the user answers via "Other" with a question, doubt, or wish to discuss instead of an answer, talk it through in plain chat until it's resolved, then re-ask that decision with updated options. If an answer makes a later question in the round moot, or adds one that must come first, recompute before asking the next one.

Each round the user answers reshapes the tree: settled decisions push the frontier outward and unblock questions that depended on them. Recompute the frontier and ask the next round. A question whose answer depends on another question still open in this round belongs to a _later_ round, not this one.

Finding _facts_ is your job, never the user's. When a frontier question needs a fact from the environment (filesystem, tools, etc.), dispatch a sub-agent with a fresh context window to find it; don't ask the user for anything you could look up yourself. Don't block on it: a running exploration is an unsettled prerequisite, so only the questions downstream of it wait for the sub-agent to report; ask the rest of the frontier now. The _decisions_ are the user's: put each to them and wait.

A fact is only something the current project or context already settles (e.g. the repo already uses Kafka, so the queue is Kafka). If the answer isn't already in the project or conversation, it's a decision, not a fact. Never settle it yourself from general knowledge or web research. Example: the project uses no message queue and one is needed. Ask the user. You may still mark one option "(Recommended)" and give trade-off descriptions (web research can inform both), but the user makes the choice. Never treat your recommendation as settled. When unsure whether something is settled, ask.

The session is done when the frontier is empty: every branch of the design tree visited, nothing left silently assumed. Then go straight on: don't ask the user to confirm the shared understanding or their answers. They interrupt if they want to change one.

## Relay mode (inside an agent)

When you run inside an agent that talks to the user through the relay (`~/.claude/references/relay.md`), everything above holds, with these changes:

- **A round is one `questions` block**, not AskUserQuestion calls. Each question keeps the same fields and rules (header, numbered question, 2–4 options with the recommended one first, descriptions, previews, multiSelect). The relay asks them in order and sends all answers back in one message. Never recap the answers in `say`.
- **Moot questions:** the relay can't skip a question for you. If an answer makes a later question in the same round moot, ignore that question's answer.
- **Discussion:** an "Other" answer with a question, doubt or wish to discuss arrives as the user's text. Answer it in your next `say`, then ask that decision again with updated options in the same block.
- **Facts:** you can't start sub-agents. Look facts up yourself before asking the round that needs them.