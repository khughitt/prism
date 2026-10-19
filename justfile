# Front door for tests. Inner loop: `just test-one <files or --test-name-pattern=...>`
# on the test at hand, `just test-fast` before committing. Full suite: `just test`.
# Gates: `just check` at pre-commit, `just gate` at pre-push. The git hooks call the
# `hook-*` recipes instead, which run the very same commands under their own target names
# so the report can price the hooks separately from the targets people type.
# Fresh clone: `git config core.hooksPath .githooks` to install the hooks.
# Every recipe runs through the vendored timing wrapper `tools/tt` (source of truth:
# ops `bin/tt`), which appends one line per run to the shared timing log.
# Design: ops docs/specs/2026-09-04-test-ci-audit-design.md,
# docs/specs/2026-09-28-test-ci-act-design.md.

set quiet
set positional-arguments

tt := "python3 tools/tt"

# The three commands, each written once, so a hook can never drift from the gate it
# stands in for. `npm test` rather than the runner directly: package.json stays the one
# definition of what the suite is, and its reporters (dot progress, failures in full, one
# summary) keep a passing run to a few lines. --silent drops npm's own banners.
#
# fast_cmd is the same command as test_cmd: `node --test` has no affected-only selection
# and the suite is seconds of wall time, so there is nothing finer to select yet. The
# report showing the two targets with equal durations is the truth, not a gap to close.
fast_cmd := "npm test --silent"
test_cmd := "npm test --silent"
# No formatter, linter, or typechecker in this project; `tasks check` is the gate.
check_cmd := "python3 tools/ops-check && tasks check"

# Staged paths that cannot change the code checks' verdict: a commit staging only these
# runs docs_check_cmd instead of check_cmd. fnmatch globs, `*` crossing `/`. docs/notes/
# is left out because the suite reads docs/notes/pipeline-interactions.md.
docs_paths := "README.md AGENTS.md docs/specs/* docs/plans/* docs/superpowers/* tasks/*"
# check_cmd holds no code checks yet, so the docs path runs the same command; the hook
# still records it under its own target.
docs_check_cmd := check_cmd

# Remote refs whose push makes CI run the full suite. prism has no CI, so no ref is
# covered and every push takes the full gate (`hook-pre-push`).
ci_suite_refs := ""
ci_remote := "origin"
# The fixed fast set, which is the whole suite (fast_cmd). Unused while ci_suite_refs is
# empty.
push_fast_cmd := fast_cmd

# The node runner with the suite's reporters and no files: `test-one` appends the
# caller's arguments, each one intact. It takes test files and `--test-name-pattern=<re>`;
# the Lua plugin checks are `npm run test:plugin-lua`.
one_cmd := "npm run --silent test:node --"

# Affected-only: the inner loop.
test-fast:
    {{tt}} test-fast -- sh -c '{{fast_cmd}}'

# One file, one test, or a filter, while working on it. Needs at least one argument;
# the whole suite is `test`. The sh -c string never holds the arguments, so quotes, $
# and globs in them reach the runner untouched.
test-one +args:
    {{tt}} test-one -- sh -c '{{one_cmd}} "$@" 2>&1' test-one "$@"

# The full suite.
test:
    {{tt}} test -- sh -c '{{test_cmd}}'

# Seconds, not minutes.
check:
    {{tt}} check -- sh -c '{{check_cmd}}'

gate: check test

# What the pre-commit hook runs: `check`'s command under its own hook target.
hook-pre-commit:
    {{tt}} hook-pre-commit -- sh -c '{{check_cmd}}'

# What the pre-commit hook runs when every staged path is in docs_paths.
hook-pre-commit-docs:
    {{tt}} hook-pre-commit-docs -- sh -c '{{docs_check_cmd}}'

# What the pre-push hook runs: the same commands as `gate`, under one hook target.
hook-pre-push:
    {{tt}} hook-pre-push -- sh -c '{{check_cmd}} && {{test_cmd}}'

# What the pre-push hook runs when CI runs the full suite for every pushed ref.
hook-pre-push-fast:
    {{tt}} hook-pre-push-fast -- sh -c '{{check_cmd}} && {{push_fast_cmd}}'
