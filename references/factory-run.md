# Factory run: what the user sees

A **factory run** starts when the user runs `/factory` (new work or continuing a feature) and lasts until the end of the session. Every skill you run in it, directly or through another skill, is one step of one automation: these rules **override** what any of them says about what to show the user. Outside a factory run, skills show what they say.

The user follows the run at a glance and opens the files when they want the details. Everything a step produces is already in its files, its commits, Jira and the PRs.

## Show

- **Questions**, as the skills ask them (grilling, the design review, setup steps). Before the design review, only its artifact link. Nothing else around them.
- **Status lines, only these, one per status change:**

  | Step | Line |
  |---|---|
  | setup | `Setup ✓` |
  | intent | `Intent ✓ <path>` |
  | design | `Design ✓ <artifact link>`, then the path of every new or changed screenshot, one per line |
  | spec | `Spec ✓ <path>` |
  | spec revised (triage) | `Spec ✓ revised <path>` |
  | tickets | `Tickets ✓ <KEY>: <n> stories (<p> pts), <b> bugs, <s> subtasks` |
  | tickets updated (triage) | `Tickets ✓ updated <KEY>`, then the ticket-writer's per-issue lines |
  | ticket split | `<KEY> split: <why, one sentence>` |
  | build start | `Build: <n> started, <w> waiting` |
  | a story or bug | `<KEY> started`, `<KEY> restarted`, `<KEY> done`, `<KEY> blocked → triage`, `<KEY> stopped` |
  | triage | one line per blocker or finding: `<KEY>: class <X>` |
  | PRs | `PR #<n> <KEY> opened`, `PR #<n> <reviewer> passed`, `PR #<n> <reviewer>: <k> findings → triage`, `PR #<n> passed`, `PR #<n>: <k> of your comments → triage`, `PR #<n> merged`, `PR #<n> needs your review` |
- **Nothing else, ever.** No prose before, between or after the lines, and none at the end of a turn while work runs in the background (the user sees what runs). In particular never: what a blocker or gap was, loop counts or limits, why something waits or hasn't started yet, what an agent was asked to do, that the user will or won't be needed later, that nothing is waiting, which stories are building, what a finished agent changed, checked or found, leftover worktrees (final report only). An agent finishing gets its status line and nothing more. A question that comes next just comes.
- **A stop of the whole run:** one sentence on what and why, then how to continue (`/factory <intent path or key>`). A single item stopping is just `<KEY> stopped`: the user sees it at the end.
- **Installs:** the one sentence from `~/.claude/references/installs.md`.

## Don't show

- Summaries of what a file contains or what changed: design changes, spec contents, ticket trees, the build plan, review reports.
- Commit hashes, branch names, check and lint results, lists of files written, step-by-step narration.
- Recaps of the user's answers or decisions.

Show any of these only when the user asks for it.

## When the user discusses a question

The user answers a question with a question, a doubt or a wish to talk it through ("Chat about this", or their own answer):

1. **An agent asked it** (through the relay): send their text to that agent, as the relay says. Nothing else.
2. **You asked it, and what you already know answers it:** answer in a few lines.
3. **You asked it, and answering needs looking things up** (code, docs, the web): don't research in this session. Start a fork (the Agent tool, `subagent_type: "fork"`) with the user's text, the question it's about and its options, asking for a short answer only. Show its answer word for word.

Then ask the decision again, with updated options if the answer changed them.

## Agents

The relay agents (spec-writer, ticket-writer) follow these rules too: start them with `run: factory` in their prompt. Show their `say` only when it carries a question for the user; when they finish, show only the step's line from the table above.
