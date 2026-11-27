---
name: tdd
description: Implement tickets test-first, in red → green vertical slices, testing only at the seams the tickets agree on, with expected values taken from the tickets. Use when the implementation phase calls it with tickets, when the user wants to build tickets test-first, mentions TDD or "red-green", or asks to run tdd.
---

<!-- Adapted from mattpocock/skills (skills/engineering/tdd), MIT License, Copyright (c) Matt Pocock. -->

**Input:** the tickets to implement.

**Output:** tests and app code that implement the tickets.

Read [tests.md](tests.md) and [mocking.md](mocking.md) before step 2, and follow them on every cycle.

## What a good test is

A test checks behavior through a public interface, not implementation details. The code behind it can change completely; the test shouldn't. A good test reads like a specification: "user can checkout with valid cart" says exactly what capability exists, and it survives refactors because it doesn't care about internal structure.

**Expected values come from an independent source of truth:** the tickets, or a worked example in them. Never from the code under test.

## Seams: where tests go

A **seam** is the public boundary you test at: the interface where you observe behavior without reaching inside (e.g. an HTTP endpoint, a service's public methods, a rendered component and the user's actions on it). Tests live at seams, never against internals.

**Test only at the seams the tickets agree on.** You can't test everything: the plan put the testing effort on the critical paths and complex logic, not every edge case. The same goes for which system boundaries are mocked.

## 1. Read

1. Read the tickets.
2. Explore the code they touch: stack, existing modules and their public interfaces, the test framework, how tests are run, and existing test conventions.
3. Run the existing tests once and note any that already fail.
4. If the tickets don't settle the seams, the boundaries to mock, or the test setup, stop and ask. Don't decide them yourself.

## 2. Slice

List the slices in order: one behavior each, written as a test name in the tickets' language, each at one of the tickets' seams.

**Every behavior gets a happy path and negative tests.** For each behavior, list its happy-path slice first, then its negative slices: invalid input, missing or empty data, values just outside each limit, not found, conflicts, and failures at system boundaries. Values just inside each limit belong to the happy path. See [tests.md](tests.md#happy-path-and-negative-tests). A behavior isn't done until both kinds pass. If the tickets don't say what a failure should produce (error, status, message), stop and ask. Don't make it up.

## 3. Red → green

One slice at a time:

1. **Red:** write one test for the slice at its seam. Run it and check it fails for the expected reason (the missing behavior, not a typo, import error or broken setup).
2. **Green:** write only enough code to pass it. Run the whole suite: the new test passes and nothing that passed before fails.
3. Report the slice as done in one line, then start the next one.

Each slice is a **tracer bullet**: let what the last cycle taught you shape the next test, and re-order or adjust the remaining slices when needed. If a slice reveals a behavior or a gap the tickets don't cover, stop and ask. Don't decide it yourself, and don't change the tickets.

### Anti-patterns

- **Implementation-coupled:** mocks internal collaborators, tests private methods, or checks through a side channel (querying the database instead of using the interface). The tell: the test breaks when you refactor but behavior hasn't changed.
- **Tautological:** the assertion recomputes the expected value the way the code does (`expect(add(a, b)).toBe(a + b)`, a snapshot derived by hand the same way, a constant asserted equal to itself), so it passes by construction and can never disagree with the code.
- **Horizontal slicing:** writing all tests first, then all the code. Bulk tests check _imagined_ behavior: they test the _shape_ of things rather than user-facing behavior, they go insensitive to real changes, and they lock in a test structure before you understand the implementation.

### Rules of the loop

- **Red before green.** Never write code for a behavior before its test has failed.
- **One slice at a time.** One seam, one test, one minimal implementation per cycle. Don't anticipate later tests or add speculative features.
- **No refactoring in the loop.** Refactoring needs come back from the `to-review` step as review findings, and are built as their own fix subtasks, not in the red → green cycle.
- **Stop and ask** means: in a session with the user, ask. Inside an agent that can't ask (the `implementer`), stop and report the question as its skill says.

## 4. Finish

Run the whole suite once more. All tests pass, except ones that already failed in step 1.

Don't refactor and don't change the tickets. Don't commit, unless the caller gives commit rules (the `implementer` skill commits each red test and each green step): then follow those. Finish by listing the tests written per ticket, marked happy path or negative, any behavior in the tickets left without a happy-path or negative test and why, and any already-failing tests.
