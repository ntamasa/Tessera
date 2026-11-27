---
name: jira-setup
description: "Set up a project so the jira skill works: the Jira variables in the project's .env (the user adds the API token themselves), .env git-ignored, .env.example listing the variables, then a live check of login, issue types, link type and permissions. Use when a project doesn't have Jira set up yet, when the jira skill's check fails, or when the user asks to set up or connect Jira."
---

**Output:** the project's `.env` with the four Jira variables, `.env` git-ignored, `.env.example` listing the variables, a passing `check`, and a commit of `.gitignore` and `.env.example`.

The script is `node ~/.claude/skills/jira/scripts/jira.mjs` (the `jira` skill). Run it from inside the project.

**Secrets rule for every step:** never read, print or `cat` `.env`, and never ask for the API token in chat: anything typed in chat stays in the conversation. To see what's set, use the script's `env` command, which hides the token. Write to `.env` only by appending a line or replacing one `JIRA_` line, without displaying the file.

## 1. Check the basics

1. Stop and explain if the project isn't a git repository.
2. Run `node --version`. Below 18: install the current LTS as `~/.claude/references/installs.md` says.
3. Run the script's `env` command and keep its output: it shows whether `.env` exists, whether it's git-ignored or tracked, and which variables are set.

## 2. Protect .env

1. **Not ignored:** add a `.env` line to the `.gitignore` at the git root (create the file if needed). Run `env` again to confirm.
2. **Tracked by git:** ask with AskUserQuestion, options "Untrack it (Recommended)" and "Leave it": ".env is committed to git, so its secrets are in the repository. Stop tracking it with `git rm --cached .env`? The file stays on disk." On "Untrack it", run the command. Either way, tell the user that any secret already committed is in the git history and should be rotated.

## 3. Set the plain values

For each of these that `env` shows as missing, ask the user in chat, all in one message:

| Variable | Ask for | Normalize |
|---|---|---|
| `JIRA_BASE_URL` | The Jira site address | Keep only `https://<site>.atlassian.net`: drop paths, queries and a trailing `/` |
| `JIRA_EMAIL` | The email of the Jira account the factory acts as | – |
| `JIRA_PROJECT_KEY` | The project key (the prefix of the project's issue keys, e.g. `BREW` in `BREW-12`) | Uppercase |

Then write them to `.env` (create it if needed): make sure the file ends with a newline, then append `NAME=value` per variable. If the user wants to change a value that's already set, replace only that `JIRA_` line. Run `env` again to confirm.

## 4. The API token

If `JIRA_API_TOKEN` is missing, tell the user to:

1. Create an API token at https://id.atlassian.com/manage-profile/security/api-tokens while logged in as the account from `JIRA_EMAIL`. Use **Create API token**, not the "with scopes" variant: the script logs in with email and token on the site address.
2. Add one line to the project's `.env` themselves: `JIRA_API_TOKEN=<the token>`.
3. Say when it's done.

Wait. Then run `env` again and confirm the token shows as set.

## 5. .env.example

So teammates know what to set, make sure `.env.example` at the git root lists the four variables with empty values (`JIRA_BASE_URL=` and so on). Create the file if needed, and add only missing names to an existing one. Never put real values in it.

## 6. Live check

Run the script's `check`. If it fails, explain the fix, wait for the user to make it, and run `check` again until it prints `OK`.

| Problem | Fix |
|---|---|
| 401 Unauthorized | Email or token wrong, or the token expired or was revoked. Create a new token (step 4). |
| 404 or "No project could be found" | Wrong project key, or the account can't see the project. |
| No epic / story / bug / subtask issue type | Add the issue type to the project. Team-managed: Project settings → Issue types. Company-managed: a Jira admin changes the project's issue type scheme. For sub-tasks: a Jira admin enables them in Jira settings → Issues → Sub-tasks. |
| No story points field | Make story points settable on stories. Team-managed: turn on Estimation in Project settings → Features (field "Story point estimate"). Company-managed: a Jira admin adds "Story Points" to the Story create and edit screens. If the field has another name, set `JIRA_STORY_POINTS_FIELD=<field id>` in `.env` (step 3 rules apply: it's not a secret). |
| No "Blocks" link type | A Jira admin enables issue linking, or recreates "Blocks", in Jira settings → Issues → Issue linking. |
| Missing project permissions | A project admin grants the listed permissions to the account. |
| `.env` is not git-ignored | Go back to step 2. |

## 7. Commit

Commit `.gitignore` and `.env.example` (only if changed). Never commit `.env`. If the current branch is `main`, `master` or `develop`, ask which branch to commit on first.

Finish with the site, project key and account (never the token), and say that the `jira` skill and `to-tickets` are ready to use.
