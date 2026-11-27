# Installs: missing or outdated tools

When a step needs a tool that is missing or too old (Node.js below the version the project needs, git, gh, Playwright and Chromium, the design.md CLI, a plugin, the project's dependencies):

1. **Don't ask, and don't hand the user a command** for something you can install. Say one sentence: what's wrong and what you install. For example: "Node 22 found, the project needs 24: installing Node 24."
2. **Never install in the main session**: the output fills its context. Start the **installer** agent (the Agent tool, `subagent_type: "installer"`, in the foreground) with this prompt, one block per tool, in the order they depend on each other:

   ```
   install: <tool> <minimum version, if any>
   why: <the step that needs it>
   command: <the install command the skill or check names | none>
   check: <the command that must pass afterwards>
   ```

3. **Its one-line answer:**
   - `INSTALLED`: carry on without another word.
   - `RESTART NEEDED`: stop. One line: "Restart the terminal and Claude Code, then run `<the command to continue>`."
   - `NEEDS USER`: show its step in one line and ask with AskUserQuestion, options exactly "Done" and "Stop": "<tool> needs you: done?" On Done, start the installer again for the same tool (it checks first). On Stop, stop.
   - `FAILED`: stop the step and show that line.

Things only the user can do aren't installs: logins (`gh auth login`), tokens and secrets, the Jira site. The skills that need them (setup-factory, jira-setup, github-setup) guide the user through them.
