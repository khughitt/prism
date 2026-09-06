---
id: prism-a9a2a8
title: Test + CI iteration cost audit
status: doing
priority: 2
size: m
owner: main
created: 2026-09-04T21:44:54Z
updated: 2026-09-06T09:00:50Z
depends: [ops-31f038]
tags: [testing]
---

Piece of ops-65837b (the cross-project audit in the ops hub). 1. Measure: full-suite wall time, and roughly how often agent full-suite runs fail here. 2. Add a fast or affected-only test target for the inner loop and point AGENTS.md at it; keep the full suite for commit and CI. 3. Use a quiet reporter so test output does not flood agent context. 4. Fix suite hygiene: sleeps, real network, unshared fixtures. Record the before and after numbers in a note on this task.

## Notes

- 2026-09-05T02:38:40Z (main): design: ops docs/specs/2026-09-04-test-ci-audit-design.md; follow §5: (1) justfile + vendored tools/tt, route existing hooks, CI, and documented test commands through it, verify a line lands under each agent; (2) after a week of runs, add a note reading 'baseline <date>: <tt-report --project numbers>'; (3) gates to §4.6, AGENTS.md line, hygiene; (4) close with before/after numbers
- 2026-09-05T11:41:44Z (test-ci-audit): step 1 (instrument, no policy change): justfile front door, vendored tools/tt (version 2), .githooks + core.hooksPath, README and AGENTS.md test commands routed through it; no prior hooks and no CI here, so the template gates are the first ones. Measured full suite 150 tests, 1.3s median / 1.4s p90 wall over 3 runs of `just test`, 0 failures; `tasks check` is 0.0s. No affected-only selection for node --test, so test-fast = test. Verified one line each under claude (shared log), codex (worktree .tt fallback, harvested by tt-report), and by hand. Wall time is not the cost here: the spec reporter prints 150 lines per run, so the quiet reporter is the step 3 hygiene item.
- 2026-09-05T22:56:36Z (main): Suite hygiene item found while merging prism-6fd864: prism-e76678 — test/fanout.test.js's timeout test spends its 100ms sink budget on node interpreter startup, so it fails under full-suite contention and passes alone. Measured here: node -e '' is 20-30ms at load ~24, sh -c ':' is ~0ms.
- 2026-09-06T09:00:50Z (main): step 4 hygiene: prism-e76678 landed (fan-out timeout test now measures the kill path, not node startup); reproduced and verified under 96 CPU burners on the 32-core box.
