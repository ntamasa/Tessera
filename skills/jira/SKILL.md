---
name: jira
description: Read, search, create, update, link, attach, transition and comment Jira issues, and publish a whole ticket set from a manifest, through the factory's Jira REST script, with config from the project's .env. Use whenever a factory skill or the user needs to do anything in Jira. Never use a Jira MCP tool instead.
---

All Jira work goes through one script. Never use a Jira MCP tool, and never call the Jira REST API by hand.

```
node ~/.claude/skills/jira/scripts/jira.mjs <command> ...
```

Run it from inside the project: it finds the git root and reads the config there.

## Config

From the `.env` file at the project's git root. Its values win over the shell's environment.

| Variable | Example |
|---|---|
| `JIRA_BASE_URL` | `https://<site>.atlassian.net` |
| `JIRA_EMAIL` | the Jira account's email |
| `JIRA_API_TOKEN` | an Atlassian API token |
| `JIRA_PROJECT_KEY` | `BREW` |
| `JIRA_STORY_POINTS_FIELD` | optional, e.g. `customfield_10016`. Only needed if the script can't find the story points field by name |

- Never print, echo or `cat` the `.env` file or the token, and never copy the token anywhere else. The only copies are the git-ignored ones Claude Code puts into agent worktrees through `.worktreeinclude`.
- If a variable is missing, the script names it. To set up a project, use the `jira-setup` skill.
- `.env` must be git-ignored. `check` reports it if it isn't.

## Commands

| Command | Does |
|---|---|
| `env` | Offline: shows which config variables are set and where from (`.env` or shell), never the token's value, and whether `.env` is git-ignored or tracked. |
| `check` | Checks config, login, the project's issue types (epic, story, bug, subtask), the "Blocks" link type, the story points field, your project permissions and that `.env` is git-ignored. Run it once before other commands in a session. |
| `read <KEY> [--parents]` | Prints the issue as Markdown: type, status, story points, parent, blocking links, subtasks, attachment names, description. `--parents` also prints its parent, the parent's parent, and so on up to the epic. |
| `search "<JQL>" [--max N]` | One line per issue: key, type, status, summary, parent. Default max 50. |
| `create --type <epic\|story\|bug\|subtask> --summary <text> [--description-file f.md] [--parent KEY] [--labels a,b] [--points N]` | Creates one issue and prints its key and URL. `--points` sets the story points (stories). |
| `update <KEY> [--summary <text>] [--description-file f.md] [--labels a,b] [--points N]` | Replaces the given fields. Refuses a Done issue. |
| `link <BLOCKER> blocks <BLOCKED>` | Creates a "Blocks" link (skips it if it exists, and checks the direction). |
| `attach <KEY> <file>...` | Uploads files. An attachment with the same file name is replaced. Refuses a Done issue. |
| `transition <KEY> "<status>"` | Moves the issue to a status (or by transition name). Lists the options if none matches. |
| `comment <KEY> (--file f.md \| --text "...")` | Adds a comment. |
| `publish <tickets.json> [--dry-run]` | Creates or updates a whole ticket set from a manifest (below). Never changes a Done issue. |
| `sync-done <tickets.json>` | Marks every manifest issue (and the epic) that is Done in Jira with `"done": true`, and lists all Done ones. |
| `convert <file.md> [--heading <text>]` | Prints the Jira document (ADF) for a Markdown file or one of its sections, and its size. For checking, offline. |

**Markdown in, Markdown out.** Descriptions and comments are written as Markdown, and the script converts them to Jira's format. Supported: headings, paragraphs, bold, italic, strikethrough, inline code, links, bullet and numbered lists (nested), `- [ ]` checkboxes, code blocks with language, tables, quotes, horizontal rules. Reads come back as Markdown.

**Size limit.** A description or comment can hold at most 32,767 characters as Jira's format, roughly 12–15k characters of Markdown. The script refuses anything bigger, naming the issue and size. It never truncates. Split the content instead.

**Attachments are copies.** Uploading never moves, renames or deletes the local file.

## Publishing a ticket set

`publish` takes a manifest, so a ticket set is created in one call and no text is typed twice: descriptions are assembled from files, including sections of other Markdown files picked by heading.

```json
{
  "maxStoryPoints": 3,
  "epic": {
    "key": null,
    "summary": "Favorite brews",
    "description": [
      { "from": "docs/features/favorites/spec.md", "heading": "Objective" },
      { "from": "docs/features/favorites/spec.md", "heading": "Summary" },
      { "from": "docs/features/favorites/spec.md", "heading": "Technical design" }
    ]
  },
  "issues": [
    {
      "id": "S1",
      "type": "story",
      "key": null,
      "summary": "Mark a brew as favorite",
      "storyPoints": 2,
      "description": [
        { "file": "docs/features/favorites/tickets/S1.md" },
        { "text": "## Acceptance criteria" },
        { "from": "docs/features/favorites/spec.md", "heading": "R1" }
      ],
      "attachments": ["design/screenshots/brews.default.png"],
      "blockedBy": []
    },
    {
      "id": "S1.1",
      "type": "subtask",
      "key": null,
      "parent": "S1",
      "summary": "Backend: favorite flag and toggle endpoint",
      "description": [{ "file": "docs/features/favorites/tickets/S1.1.md" }],
      "blockedBy": []
    }
  ]
}
```

- **Paths** are relative to the git root.
- **Description parts**, joined with a blank line:
  - `{ "file": path }`: the whole file
  - `{ "from": path, "heading": text }`: one section of a Markdown file: the heading whose text is `text` or starts with `text` followed by a space (`"R1"` matches `### R1 — Mark as favorite`, not `R10`), down to the next heading of the same or a higher level. The heading must match exactly once.
  - `{ "text": "..." }`: literal Markdown, for short connecting text like a section title
- **epic** (optional): `key` set and no `summary` means "use this existing epic as the parent". Stories, bugs and tasks get the epic as their parent.
- **issues:** `id` is a local id, unique in the manifest. `type` is `story`, `bug`, `task` or `subtask`. A subtask's `parent` is the id of a story or bug in the manifest, or an existing Jira key. `blockedBy` lists ids or Jira keys. `attachments` and `labels` are optional. `storyPoints` (stories only) sets the story points.
- **maxStoryPoints** (optional): a story with more points fails validation.
- **Order:** parents and blockers are created first, whatever the order in the file.
- **Validation first:** before calling Jira, the script checks every id, reference, file, heading, attachment and description size. If anything fails, it lists all problems and publishes nothing. `--dry-run` runs only this check, offline, and prints each issue with its description size.
- **Idempotent:** after creating an issue, the script writes its key into the manifest at once. Running `publish` again updates the issues that have a key (summary, description, attachments) and creates the rest, so an interrupted run can simply be run again. Links that already exist are skipped.

- **Done issues are frozen.** An issue whose status is in Jira's Done category is never changed again: `publish` first runs `sync-done`, marks it `"done": true` in the manifest, and from then on skips it (its summary, description, points, attachments and its own blocker links are neither checked nor sent), so a spec section it pulled in may change or disappear. `update` and `attach` refuse Done issues. A new subtask whose parent is a Done story fails validation. A change to Done work always goes into a **new** issue (see `to-tickets`). `--dry-run` is offline, so it only skips issues already marked: run `sync-done` before it. The mark is never removed, even if the issue is reopened.

The script never deletes issues. If a ticket is no longer needed, tell the user its key.
