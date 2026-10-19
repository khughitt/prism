## Gates

- `just test-one <args>` runs `node --test` on what you name: test files
  (`just test-one test/cli.test.js`), narrowed by `--test-name-pattern=<regex>` given
  before them (node passes an option after the first file to the tests, so the run
  ignores it). The Lua plugin checks run only in the whole suite. `just test-fast` is
  the whole suite, since `node --test` has no affected-only selection; its wall time is
  set by the slowest file,
  `integrations/noctalia-plugin/contract.test.mjs`, which drives the real CLI. There is
  no CI: the pre-push hook carries the full suite (`ci_suite_refs` is empty).
- `just test` runs the suite (`npm test`); every recipe records its wall time through
  `tools/tt` for the cross-project test and CI audit (ops
  `docs/specs/2026-09-04-test-ci-audit-design.md`). `just check` is the pre-commit gate
  and `just gate` the pre-push one; install the hooks in a fresh clone with
  `git config core.hooksPath .githooks`.
- Design specs live under `docs/specs/` and implementation plans under `docs/plans/`;
  they are committed. `docs/superpowers/` holds the earlier ones and takes no new docs.

## Tasks workflow

- Run `tasks prime` at the start of a work session and `tasks ready` before choosing work.
- Run `tasks start ID` before implementation, add concise notes as evidence changes, and close the task with a one-line result on its branch before it merges.
- Never edit `tasks/*.md` directly; use the `tasks` CLI for every task mutation.
- Before completion, run `tasks check`. Require zero errors and report every warning. Registration-only `unreachable_dep` and `cycle_unverifiable` warnings are environmental on machines without all referenced projects; resolve every other warning.
