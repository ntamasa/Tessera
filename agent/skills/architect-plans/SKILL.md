---
name: architect-plans
description: Turns a specification into non-technical stories and step-by-step sub-task guides a low-tier model can follow, then creates the Jira tickets. Interactive, with the user. Use when the user runs /architect-plans <spec> or asks to plan an epic.
model: claude-fable-5-1
effort: medium
---

# Plan an epic

## Procedure
1. Read the spec file given as the argument, AGENTS.md (including its config block, printed as
   JSON by `/workspace/workflow/bin/wf-config .`), the contract if one is declared, and design/
   if it exists. Then read, not skim, every file the spec touches and every file you will name
   as a pattern to copy: the steps you write must quote real lines from them.
2. List every open decision. Drop any that are:
   - already settled by the spec or AGENTS.md,
   - covered by a common default (state the default in the plan so the user can object),
   - pure implementation detail a competent developer would just decide.
3. Ask the remaining questions at most 4 at a time. Each question: context in 1–2 sentences,
   2–3 options, your recommendation and why.
4. Write docs/spec/plans/<epic>.md in two passes.
   a. Stories, using /workspace/workflow/templates/story.md: the big plan in plain words, for a
      person. No file names, code, endpoints, tables, libraries or error codes. Show the user
      the stories and their dependency graph first, and agree on them.
   b. Sub-tasks, using /workspace/workflow/templates/subtask.md: one per component each story
      touches, the contract change on the provider's sub-task, then the step-by-step guides
      (contract steps, test steps, code steps) following "How steps are written" below. Write
      each answer from step 3 into the steps it affects. Split any sub-task that is too big
      (sizing rule below).
   If the project has a UI, write design/routes.json entries for every screen state:
   `{"screen", "state", "ticket", "design", "route", "setup"}`, where `design` is the path of
   the design export (HTML, optionally with a `#state` fragment, or an image) and `setup` is a
   command in the target repo that puts the app into that state (or omit it).
   Ask the user to approve the plan. Apply requested changes.
5. On approval, look up the Jira project for this repo in /workspace/workflow/projects.yaml and
   create the Epic, Stories and Sub-tasks via the jira MCP, using the two templates verbatim.
   Sub-task titles are `[<component>] <summary>`. Add "is blocked by" links (consumer
   sub-tasks are blocked by the provider sub-task that changes the contract; stories are
   blocked by the stories they depend on), labels (`agent-ready`, `comp-<component>`), and
   rank them in dependency order.
6. Commit the plan (and design/routes.json) on a branch `docs/<epic>-plan`, push it, and open a
   PR into the config's `base_branch` for the user to merge. Never push to the base or release
   branch yourself.
7. Print the created ticket keys and the dependency order.

## Jira structure
| Level | Represents |
|---|---|
| Epic | One spec file / feature area |
| Story | One user-visible capability, delivered end to end. The big plan in plain words, no technical detail |
| Sub-task `[<component>]` | The part of the story in one component: a brief summary, then a step-by-step guide for a low-tier model |

A story gets one sub-task per component it touches. If the story changes the contract, the
sub-task of the component that *provides* the interface carries the contract change, and the
sub-tasks of the components that *consume* it are blocked by it.

## How steps are written
- One action per step. Open, add, replace, delete, rename, copy, or run, never two at once.
- Exact locations. Every step names the file path and the function, type or symbol. It points
  to the spot by quoting an existing line ("after the line `…`"), never by line number, because
  line numbers shift as earlier steps run.
- Exact content. The full code to add, or the exact text to replace and what replaces it. When a
  pattern is copied, the step names the file and symbol to copy from and says what to change in
  the copy.
- Checks. Every section ends with a step that runs a command from the config and states the
  expected result. Long sections also check in between.
- No decisions left. Words like "appropriately", "as needed", "if necessary", "choose",
  "consider", "similar to" or "etc." are not allowed. If something depends on what the agent
  finds, the step names both cases and what to do in each.
- Nothing implicit. New imports, constructor parameters, registrations, config entries and
  fixtures each get their own step.

**Sizing rule:** split a sub-task that would touch more than ~12 files or need more than ~40
steps in total. Keep one only when splitting would create meaningless tickets.

## Quality bar
- A story is ready when someone who doesn't code understands what the user gets and how it
  behaves, and it contains nothing technical.
- A sub-task is ready when a low-tier model that has never seen the codebase could finish it by
  following the steps in order, without making a single decision. Re-read every step and ask:
  could it be done two ways? Then it isn't finished. Quote real lines, give the full code, and
  end every section with a check.
