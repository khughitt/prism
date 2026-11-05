## Gates

- `just test-one <args>` runs `node --test` on what you name: test files
  (`just test-one test/cli.test.js`), narrowed by `--test-name-pattern=<regex>` given
  before them (node reads anything after the first file as another file pattern, and
  drops one that matches nothing without a word). The Lua plugin checks run only in the
  whole suite. `just test-fast` is the whole suite, since `node --test` has no
  affected-only selection; its wall time is set by the slowest file,
  `integrations/noctalia-plugin/contract.test.mjs`, which drives the real CLI. There is
  no CI: the pre-push hook carries the full suite (`ci_suite_refs` is empty).
- `just test` runs the suite (`npm test`); every recipe records its wall time through
  `tools/tt` for the cross-project test and CI audit (ops
  `docs/tooling.md`). `just check` is the pre-commit gate
  and `just gate` the pre-push one; install the hooks in a fresh clone with
  `git config core.hooksPath .githooks`.
- New design specs, implementation plans, briefs and handoffs go under the
  project's records directory (`tasks where` names it; `docs/specs/`, `docs/plans/`,
  `docs/notes/` there), committed in the records repository, never in this tree. The
  documents this tree already tracks under `docs/specs/`, `docs/plans/`, `docs/notes/`
  and `docs/superpowers/` stay here and are revised in place.

## Tasks workflow

- Run `tasks prime` at the start of a work session and `tasks ready` before choosing work.
- Run `tasks start ID` before implementation, add concise notes as evidence changes, and close the task with a one-line result on its branch before it merges.
- Never edit `tasks/*.md` directly; use the `tasks` CLI for every task mutation.
- Before completion, run `tasks check`. Require zero errors and report every warning. Registration-only `unreachable_dep` and `cycle_unverifiable` warnings are environmental on machines without all referenced projects; resolve every other warning.
