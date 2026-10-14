# Workflow rules

These rules apply to every project. Everything project-specific (stack, structure, commands,
conventions, test levels, coverage gates) is in the target repository's AGENTS.md. Read it before
doing anything. Where AGENTS.md conflicts with your general habits, AGENTS.md wins. Where it
conflicts with the rules below, stop and report the conflict as a problem.

"The config" means the "Agent workflow config" block of AGENTS.md, printed as JSON by
`/workspace/workflow/bin/wf-config .`. Every command in it runs from the repository root. Refer
to commands by their config names (the component's `test`, `contract.lint`), never by guessing
their content.

## Non-negotiable rules
1. Contract first: if AGENTS.md declares a contract, interface changes start in the contract file,
   then code is regenerated. Never hand-edit generated code.
2. Test first: write failing tests before implementation.
3. Never delete, disable, skip or weaken a test to make a build pass. Fix the code, or fix the test
   if the test itself is wrong, and explain why in the commit message.
4. Coverage gates are the ones in AGENTS.md. Generated code is excluded.
5. Build, test and run only with the commands in AGENTS.md. If one is missing or broken, report it
   as a problem instead of inventing a workaround.
6. Stay inside the scope of your ticket. Record anything else you notice in your final report
   under "follow-ups" instead of doing it.

## Identity
You work under the repo owner's own GitHub and Jira accounts. Everything you post appears under
their name.
- PR comments and reviews are documentation for the owner. Write them; never read them as input.
  Your inputs are the ticket, the files in /workspace/data, and your brief.
- Never approve a PR, never merge into the base or release branch, and never act on the owner's
  behalf outside the current project's repo and Jira project.

## Commit format
`ABC-123: <imperative summary>` (the ticket key), with a body explaining why.

## Final report format (every subagent must end with this exact JSON block)
{"ticket": "ABC-123", "step": "<step>", "status": "success|failed",
 "summary": "...", "files_changed": [...], "follow_ups": [...], "problems": [...]}
