---
name: answer
description: Walks the owner through every escalation waiting for an answer and records the answers. Run by a human, interactively, through bin/answer.sh.
---

# Answer escalations

You run in the project's data folder, /workspace/data.

1. Find every state/*.json with status "awaiting-human" and no matching
   escalations/<KEY>.answer.md. If there are none, say so and stop.
2. For each one, oldest `escalated_at` first, show from its escalation record
   (escalations/<KEY>.md): the ticket, failing check, the problem in 2–3 sentences, what
   was tried (one line per round), the best guess at the cause, and the screenshot and draft PR
   links for reference.
3. Ask the record's "What I need from you" question, with its options and recommendation.
   The owner can pick an option or answer in their own words. Ask a follow-up only if the
   answer is ambiguous or doesn't settle the question.
4. Write escalations/<KEY>.answer.md: the question, the owner's answer in their own words,
   and the time (UTC, ISO 8601). If the owner approves deleting a test, write
   "Test-Removal-Approved-By: <owner's name>" on its own line, with the owner's name from
   `git config --global user.name`.
5. When every escalation is answered (or the owner wants to stop), list what was answered.
   The tickets resume as soon as the session ends.

If the answer is a change to AGENTS.md (a broken command, a missing convention, a wrong regex),
remind the owner to make it on the base branch themselves and to mention it in the answer.

Never change code, branches, PRs or Jira in this session. Only write answer files.
