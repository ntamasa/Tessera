---
name: escalation
description: Hands a blocked ticket to the owner. Pushes the work, opens or updates a [BLOCKED] draft PR, writes the escalation record the answer session asks from, and parks the ticket. Run by the orchestrator, in its own session.
---

# Escalate a ticket

Run this when the orchestrator says to escalate: the same check failed in 5 consecutive rounds,
ticket validation failed, a fix plan says "## Escalate", or a story sync hit merge conflicts.

Input from the orchestrator: the ticket key (or the story key for a story sync), the failing
check, the reason, and one question with 2–3 options and a recommendation. "Data" is the project
data folder from the header; "config" is the output of `/workspace/workflow/bin/wf-config .`.

## Procedure
1. **Push the work.** If the working tree has changes, commit them on the feature branch as
   `<KEY>: work in progress before escalation`, with a body naming the failing check. Push the
   branch (never force). If no branch exists yet (ticket validation failed before any work),
   create the story branch from the config's `base_branch` if it doesn't exist, cut
   `feature/<KEY>-<component>` from it (use `feature/<KEY>` if the component is unknown), add
   an empty commit `<KEY>: escalation before work started`, and push both.
2. **Gather evidence.** If Data/screenshots/<KEY>/ has images, publish them with
   `/workspace/workflow/bin/push-evidence.sh <Data> <KEY>` and use the links it prints. Take the
   rounds from the state file's `usage` and the fix plans Data/state/<KEY>.fix-*.md, and the
   open findings from Data/state/<KEY>.findings.json when the failing check is the review.
3. **Write the record** Data/escalations/<KEY>.md from
   /workspace/workflow/templates/escalation.md, filling in every section. The Jira link is
   `$JIRA_URL/browse/<KEY>`. "What I need from you" holds exactly one question. If the record
   already exists (an earlier escalation of this ticket), append the new one under a heading
   `## Escalation <n>` instead of overwriting the history.
4. **Open or update the draft PR** into `story/<STORY-KEY>` (for a story sync, the sync branch
   into the story branch), with the record as its body:
   - No PR for the branch yet: `gh pr create --draft --base <story branch> --head <branch>
     --title "[BLOCKED] <KEY>: <title>" --body-file Data/escalations/<KEY>.md`.
   - A PR exists: `gh pr ready --undo <pr>` if it isn't a draft, then
     `gh pr edit <pr> --title "[BLOCKED] <KEY>: <title>" --body-file Data/escalations/<KEY>.md`.
   The draft PR is documentation: the owner doesn't answer on it, and nothing reads it.
5. **Park the ticket.** In Data/state/<KEY>.json set `"status": "awaiting-human"`,
   `"escalated_at"` (UTC, ISO 8601), `"escalation": {"check": "<check>", "question": "<the
   question>"}` and `"pr"` if it was just created. Delete /workspace/data/current.json.
6. **Notify** if the header says push notifications are available: one line under 200
   characters, `<KEY> blocked on <check>: run tessera answer`.
7. Write `{"result":"escalated","ticket":"<KEY>"}` to Data/last-run.json and stop.

## Rules
- Never create, change, transition or comment on a Jira ticket during an escalation. The ticket
  keeps its status (In Progress before the PR was opened, In Review after).
- Never merge, never force-push, never close the PR.
- Ask exactly one question per escalation. Make the options concrete enough that the architect
  can plan a fix from the owner's choice alone.
