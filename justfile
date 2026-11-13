# Front door for tests. Inner loop: `just test-one [--test-name-pattern=<re>] <files>`
# on the test at hand. Broad targets observe .tt.toml; deliberate full suite:
# `just test-full`. While policy is enabled, run `just test-fast` before committing.
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
# No formatter, linter, or typechecker in this project. tools/ops-check and tools/ops-docs
# are vendored from ops (see tools/README.md): shared hygiene, then the guides against
# identity.toml; `tasks check` last.
check_cmd := "python3 tools/ops-check && python3 tools/ops-docs check && tasks check"

# Staged paths that cannot change the code checks' verdict: a commit staging only these
# runs docs_check_cmd instead of check_cmd. definitions.md stays outside the explicit
# list because the suite reads and verifies its generated interaction block.
docs_paths := "README.md AGENTS.md CLAUDE.md identity.toml docs/usage.md docs/store.md docs/desktop.md docs/noctalia-plugin.md"
# check_cmd holds no code checks yet, so the docs path runs the same command; the hook
# still records it under its own target.
docs_check_cmd := check_cmd

# Remote refs whose pushes have qualified full-suite CI. Keep empty until the
# prepared workflow completes its approved hosted qualification.
ci_suite_refs := ""
ci_remote := "origin"

# The node runner with the suite's reporters and no files: `test-one` appends the
# caller's arguments, each one intact. It takes test files, and `--test-name-pattern=<re>`
# before them: node reads anything after the first file as another file pattern and
# drops one that matches nothing. test-plugin-lua runs the standalone Lua checks.
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

# Explicit full verification, including when automatic broad verification is off.
test-full:
    TT_FORCE=1 just test

# Focused checks for changes to the plugin's Lua modules.
test-plugin-lua:
    {{tt}} test-plugin-lua -- npm run --silent test:plugin-lua

# Seconds, not minutes.
check:
    {{tt}} check -- sh -c '{{check_cmd}}'

gate: check test

# Regenerate the identity regions in README.md and AGENTS.md from identity.toml.
docs:
    python3 tools/ops-docs write

# What the pre-commit hook runs: `check`'s command under its own hook target.
hook-pre-commit:
    {{tt}} hook-pre-commit -- sh -c '{{check_cmd}}'

# What the pre-commit hook runs when every staged path is in docs_paths.
hook-pre-commit-docs:
    {{tt}} hook-pre-commit-docs -- sh -c '{{docs_check_cmd}}'

# Time mandatory hygiene once; the broad child records its own execution or skip.
hook-pre-push:
    {{tt}} hook-pre-push -- sh -c '{{check_cmd}}'
    just test

# What the pre-push hook runs when CI runs the full suite for every pushed ref.
hook-pre-push-fast:
    {{tt}} hook-pre-push-fast -- sh -c '{{check_cmd}}'
    just test-fast
