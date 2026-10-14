# AGENTS.md

<!-- Starting point for onboarding a target repository to Tessera. Copy it to the target repo's
root and replace every <placeholder>. Every agent reads this file, and reviewers judge code
against it: a convention that isn't written here can't be a review finding. Write what a skilled
developer new to the project would need. Delete these comments when you're done. -->

## Overview
<What the product is and who it is for, in 3–5 sentences.>

## Stack
<Languages, frameworks, runtime versions, data stores, key libraries. Versions are pinned in mise.toml.>

## Repository map
| Path | What lives there |
|---|---|
| <path> | <purpose> |

## Architecture and conventions
<Layering or module boundaries, naming, error handling, logging, configuration, anything a
reviewer should enforce. Name one exemplary file per kind of code for agents to copy.>

## Testing
<Which test levels exist (unit, integration, end-to-end, …), which framework each uses, where
each kind lives, what each level is for, and how external dependencies are handled (fakes,
containers, mock servers). Name one exemplary test file per level.>

## Running locally
<How to run the app and with which data, for humans and for the visual verifier.>

## Agent workflow config
Read by the workflow's scripts and hooks. Agents never edit this file; only a human changes it.
Every command runs from the repository root.

```yaml
stack: [<short free-form tags>]       # informational, for you and the agents
jira_project: <KEY>                   # the Jira project that tracks this repo, e.g. ABC
base_branch: develop                  # integration branch: you merge finished stories here
release_branch: main                  # only you merge here
setup: <command that installs toolchain and dependencies after a fresh clone or pull>
contract:                             # omit the whole block if there is no interface contract
  path: <contract file>
  lint: <command that validates it>
  generate: <command that regenerates code from it>
components:
  - name: <short id, used in Jira labels and branch names>
    kind: service | ui | library | cli | job | infra     # `ui` enables the accessibility reviewer
    path: <directory>
    build: <command that compiles/bundles, including tests>
    test: <command that runs the fast tests>
    verify: <command that runs every test and FAILS below the coverage gate>
    coverage_gate: 95                 # informational; `verify` must enforce it
    lint: <command>
    audit: <dependency vulnerability scan command>
    generated: [<path prefixes of generated code, never hand-edited>]
    tests:
      paths: [<git pathspecs where tests live>]
      case_pattern: '<POSIX extended regex matching one test case declaration>'
      skip_pattern: '<POSIX extended regex matching a skipped, disabled or focused test>'
    ui:                               # only for components with a user interface
      start: <command that serves the app against mock or seed data>
      base_url: http://localhost:<port>
      viewports: [[1440, 900], [768, 1024], [375, 812]]
      # diff_threshold: 0.015         # share of differing pixels design-diff.mjs accepts
required_checks: [<your CI check names>, test-integrity / check, agent-review]
```

<!-- Checklist before the first autonomous ticket:
- `<tessera>/bin/wf-config .` prints the block above as JSON (needs jq and yq; or run it inside
  `tessera shell` as `/workspace/workflow/bin/wf-config .`).
- `git grep -E '<case_pattern>' -- <tests.paths>` finds exactly your test cases, and
  `git grep -E '<skip_pattern>' -- <tests.paths>` finds nothing (or only what you expect).
- Each component has at least one real example of each kind of code and each test level named
  above (a walking skeleton): agents copy existing patterns.
- A project without an interface contract omits `contract`; a single-component project lists
  one component. -->
