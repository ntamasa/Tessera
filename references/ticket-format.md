# Ticket rules & format

Written by the `to-tickets` skill from a spec.md (see `spec-format.md`), published to Jira with the `jira` skill. Read by the implementation phase: a cheap coder model implements one subtask at a time from its subtask, its story and its epic, without designing anything itself.

## Breakdown rules

- **Epic:** one per intent. Holds the spec's objective, summary, constraints and technical design. A bug about an existing feature goes under that feature's epic, or under none, as the user decides.
- **Story:** one vertical slice through every layer (data, API, UI, tests) that can be demoed on its own. Never one layer ("backend story"). Every requirement of the spec belongs to exactly one story. A story may be blocked by other stories.
- **Story points:** every story gets story points, and **no story is bigger than 3**. Bugs, subtasks and the epic get none. See "Story points" below.
- **Bug:** for a `type: bug` spec, one Bug item takes the place of the stories.
- **Subtask:** one step of one story or bug, sized for one fresh coder session, testable at one seam. After each subtask the build and the whole test suite are green, except after a bug's reproduction subtask, which leaves exactly its own new test failing. Subtasks of a story are ordered with blocking links. A subtask never spans two stories.
- **Bug subtasks:** the first one writes a failing test that reproduces the bug; its "Done when" says that test fails for the reason in the spec's Cause. The fix subtask is blocked by it, writes no new test for the bug, and must not edit that test: its "Done when" is that test passing and the whole suite green.
- **Done issues are never changed.** A change to a Done subtask is a new subtask (`Change: …` or `Fix: …`) under its story or bug; a change to a Done story is a new story `Change: …` under the epic. The new issue goes through the whole factory loop. The script enforces it (the jira skill's "Done issues are frozen").
- **Coverage:** every requirement in a story or bug, every business rule attached where it applies, every technical design subsection used by at least one subtask, and every behavior tested with happy-path and negative cases.

## Story points

Story points size a story relative to other stories: amount of work, complexity and uncertainty together, never hours. Scale: 1, 2, 3, 5, 8, 13.

| Points | A story that… |
|---|---|
| 1 | changes one small behavior with existing patterns, at one seam. About 1–2 subtasks, nothing unknown |
| 2 | adds one behavior through the layers it needs, following existing patterns. About 2–4 subtasks |
| 3 | adds several related behaviors, or one that needs a new module, migration or pattern, or has some unknowns. About 4–6 subtasks |
| 5 or more | too big: split it |

- **Maximum 3.** Estimate each story first. A story over 3 is split until every part is 3 or less: an 8 can become 3 + 3 + 2 or 2 + 2 + 2 + 2, whatever the slices naturally are.
- **Split vertically**, never by layer. Each part is still a demoable slice with its own happy-path and negative tests. Ways to split: by business rule, by operation (create, edit, delete), by data variation, by workflow step, or simple case first and its variations in later stories.
- **Requirements stay whole:** every requirement is still in exactly one story. If one requirement alone is over 3 points, it can't be split here: stop and propose splitting it in the spec (`to-spec` with a change request).
- Points go into the manifest as `storyPoints`, with `"maxStoryPoints": 3` at the top, so `publish` rejects any story over 3.

## Drafts

Next to the spec.md:

```
tickets.json        manifest for `jira.mjs publish` (format in the jira skill)
tickets/S1.md       story S1: only the new text
tickets/S1.1.md     subtask 1 of S1
tickets/BUG1.md     bug: only the new text
tickets/BUG1.1.md   subtask 1 of the bug
```

IDs: stories `S1`, `S2`…, bugs `BUG1`…, subtasks `<parent>.<n>`. Drafts hold only text that isn't in the spec. Everything from the spec is pulled in by the manifest with `{ "from": "<spec>", "heading": "..." }`, never copied into a draft.

## Epic

Manifest only, no draft file:

```json
"epic": {
  "summary": "<spec name>",
  "description": [
    { "from": "<spec>", "heading": "Objective" },
    { "from": "<spec>", "heading": "Summary" },
    { "from": "<spec>", "heading": "Constraints" },
    { "from": "<spec>", "heading": "Technical design" }
  ]
}
```

If the epic is over the size limit, publish its technical design subsection by subsection instead: keep the shared ones (overview, data model, API, conventions, seams, risks) in the epic and move each subsection that only one story uses into that story's description.

## Story

Draft `tickets/S1.md`:

```markdown
As a <actor>, I want <capability>, so that <benefit>.

**Demo:** what can be shown when this story is done.

## Design
- **Screens:** `brews` (default, favorites-empty), `brew-detail` (default)
- **Screenshots:** attached. `brews.default.png` is the new design, `brews.default_deprecated.png` the design before this feature.
```

Manifest description: the draft, then `{ "text": "## Acceptance criteria" }` and the story's requirements by heading (`R1`, `R2`…), then `{ "text": "## Business rules" }` and the business rules they reference (`B1`…).

Attachments (UI stories only): for every screen state in "Screens", `design/screenshots/<screen>.<state>.png`, and for screens this feature modified, also the `_deprecated` "before" file if it exists. Leave out the Design section when the story has no UI.

## Bug

Draft `tickets/BUG1.md`:

```markdown
<one sentence: what's wrong, from the user's side>
```

Manifest description: the draft, then the spec's `Reproduction`, `Cause` and `Fix` sections by heading, `{ "text": "## Acceptance criteria" }` and the requirements, then the spec's `Technical design`. Attachments: the screenshots of the expected states, if the bug is on a designed screen.

## Subtask

Draft `tickets/S1.1.md`, in this order. Leave out sections that don't apply.

````markdown
**Goal:** one sentence.

**Read first:**
- Epic → Technical design → API, Data model
- `design/DESIGN.md`, `design/screens/brews.md`, `design/prototype/screens/brews.html`, `design/screenshots/brews.favorites-empty.png`

## Files that change
- create `path/File.ext`: what it holds
- modify `path/Other.ext`: what changes

## Names and signatures
- `BrewService.setFavorite(UUID id, boolean favorite): BrewDto`

## Tests that prove it
**Seam:** HTTP API · **Setup:** like `path/BrewApiTest.java` · **Mocked:** nothing
**Happy path**
1. Given <state>, when <action>, then <result with literal values>.

**Negative**
2. Given <state>, when <action with invalid input>, then <exact error, status or message>, and <what stays unchanged>.

## Hard logic
```ts
// only the part that needs thinking
```

## Out of scope
- What this subtask must not touch (and which subtask does it).

## Done when
- `<test command>` passes, and the whole suite is green.
````

- **Read first:** the epic sections it relies on, by name (the coder reads them with `jira.mjs read <KEY> --parents`), and for UI subtasks the exact design files: DESIGN.md, the screen spec, the prototype screen it builds and the screenshots of its states. Only its own files, never "the whole design folder". Backend subtasks list no design files.
- **Files and names:** exact paths and names. The coder doesn't choose names.
- **Tests:** behavior and literal expected values, never test code. Each test case traces to a requirement of the story. Every subtask lists both **happy path** and **negative** cases for each behavior it builds: invalid and missing input, values just outside each limit, not found, conflicts, boundary failures. Each negative case gives the exact error, status or message and what stays unchanged.
- **Red step:** if the subtask has no test seam (only config, CI, infra, global styles or dependencies), start "Tests that prove it" with `No unit seam (<what>): checked by <checks>. No red commit.`, and list the checks with what each shows before and after the change. If its tests cover behavior the code already has (a fix that only adds or tightens tests), start it with `Test-only: no red commit.` and add one mutation check per test (`temporarily <smallest edit to the code>, and test <n> fails; revert`). Either way, "Done when" ends with "one green commit".
- **Hard logic:** only where a coder would have to think: an algorithm, a tricky query, a state machine, an optimistic update. Never whole files, imports or boilerplate.
- **Never repeat** what the epic, the story or the design files already say: point to it.
