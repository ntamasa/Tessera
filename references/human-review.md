# When a PR needs a human review

Read by `to-pr` (decides from the diff when it opens the PR) and by every reviewer agent (escalates what it finds). Applies to story PRs and to a bug's final PR. Never to a feature's final PR (epic → `develop`): every story PR inside it already passed these rules (see `branches.md`).

A PR that matches **any** rule gets the `needs-human-review` label: the merge gate merges it only after a human has reviewed it and added the `human-approved` label (removed again on every new commit that isn't a target merge or the cleanup commit). Everything else is merged by the merge gate once every reviewer has passed on the PR's current head. A PR with `factory-stopped` (loop cap) is never merged by the gate: a human finishes and merges it.

Judge from the diff (`git diff <target>...<branch>`), not from file names alone. When unsure whether a rule applies, it applies.

| # | Rule | Signals in the diff |
|---|---|---|
| H1 | **Irreversible** | A migration that drops or renames a table or column, changes a column's type, or deletes or rewrites existing data. Code that permanently deletes stored data. New calls that send something to an outside system that can't be taken back (email, SMS, payment, webhook, third-party API write). |
| H2 | **Security feature** | Authentication, authorization (permissions, roles, ownership checks), sessions, tokens, cookies, password handling, cryptography, secrets handling, CORS, CSP and other security headers, rate limiting. |
| H3 | **Infra, CI or factory config** | `.github/` and other CI files, `Dockerfile`, `docker-compose*`, infra and deploy files (Terraform, Kubernetes, Helm), build and release scripts, `.claude/`, `CLAUDE.md`, `.gitignore`, `.worktreeinclude`, `.env.example`. |
| H4 | **Contract or data** | A breaking change to a public API (an endpoint or field removed or renamed, a type or status code changed, a new required input). Money, billing or prices. Collecting, storing, exposing or deleting personal data (PII). |

Write the reasons as `H<n>: <what, path:line>`, one per line, in the PR body and in the label's comment.
