## Summary
<2–4 sentences: what this sub-task delivers, for which story, and how it fits with the other
sub-tasks of the story.>

## Component
<component name from the AGENTS.md config>

## Context
- Story: <STORY-KEY>
- Depends on: <KEY> (<what it provides>), or "none"
- Patterns to copy: <path> (<symbol>), named again in the steps where they're used

## Acceptance criteria (technical)
- GIVEN <precondition> WHEN <input or call> THEN <exact observable result: value, status, error code>
- GIVEN <boundary or invalid input> THEN <exact result>
- GIVEN <unauthorized or missing precondition> THEN <exact result>

## Contract steps
<Numbered steps for the contract-writer, or "none". Example shape:>
1. Open `<contract file>`. Under `<quoted existing line>`, add exactly:
       <the full snippet, including error responses>
2. Run the config's `contract.lint`. Expected: no errors.
3. Run the config's `contract.generate`. Expected: `<generated file>` now contains `<symbol>`.

## Test steps
<Numbered steps for the implementer's test phase, or "none". Example shape:>
1. Open `<test file>`. Copy the test `<existing test>` and rename the copy `<new test>`.
2. In the copy, replace `<quoted line>` with `<new line>`.
n. Run the component's `test`. Expected: exactly the new tests fail, with <the assertion or
   stub message>; every other test passes.

## Code steps
<Numbered steps for the implementer's code phase, or "none". Example shape:>
1. Open `<source file>`, function `<symbol>`.
2. After the line `<quoted existing line>`, add:
       <the exact code>
n. Run the component's `test`. Expected: all tests pass.

## Design reference
<design/bundle/screens/<screen> — states: <state>, <state>. Or "none".>

## Out of scope
<what a reasonable developer might do here but must not; link the ticket that does it, or "none">

<!-- How steps are written (the same rules apply to the architect's fix plans):
- One action per step: open, add, replace, delete, rename, copy, or run, never two at once.
- Exact locations: every step names the file path and the function, type or symbol, and points
  to the spot by quoting an existing line, never by line number.
- Exact content: the full code to add, or the exact text to replace and what replaces it.
- Checks: every section ends with a step that runs a command from the config and states the
  expected result.
- No decisions left: no "appropriately", "as needed", "if necessary", "choose", "consider",
  "similar to" or "etc."; if something depends on what the agent finds, name both cases.
- Nothing implicit: imports, constructor parameters, registrations, config entries and
  fixtures each get their own step.
Every section must be present; one that doesn't apply says "none". The orchestrator escalates a
ticket with a missing section. -->
