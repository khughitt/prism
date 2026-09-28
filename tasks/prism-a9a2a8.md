---
id: prism-a9a2a8
title: Test + CI iteration cost audit
status: doing
priority: 2
size: m
complexity: low
process: direct
owner: main
created: 2026-09-04T21:44:54Z
updated: 2026-09-28T10:27:50Z
depends: [ops-31f038]
tags: [testing]
---

Piece of ops-65837b (the cross-project audit in the ops hub). 1. Measure: full-suite wall time, and roughly how often agent full-suite runs fail here. 2. Add a fast or affected-only test target for the inner loop and point AGENTS.md at it; keep the full suite for commit and CI. 3. Use a quiet reporter so test output does not flood agent context. 4. Fix suite hygiene: sleeps, real network, unshared fixtures. Record the before and after numbers in a note on this task.

## Notes

- 2026-09-05T02:38:40Z (main): design: ops docs/specs/2026-09-04-test-ci-audit-design.md; follow §5: (1) justfile + vendored tools/tt, route existing hooks, CI, and documented test commands through it, verify a line lands under each agent; (2) after a week of runs, add a note reading 'baseline <date>: <tt-report --project numbers>'; (3) gates to §4.6, AGENTS.md line, hygiene; (4) close with before/after numbers
- 2026-09-05T11:41:44Z (test-ci-audit): step 1 (instrument, no policy change): justfile front door, vendored tools/tt (version 2), .githooks + core.hooksPath, README and AGENTS.md test commands routed through it; no prior hooks and no CI here, so the template gates are the first ones. Measured full suite 150 tests, 1.3s median / 1.4s p90 wall over 3 runs of `just test`, 0 failures; `tasks check` is 0.0s. No affected-only selection for node --test, so test-fast = test. Verified one line each under claude (shared log), codex (worktree .tt fallback, harvested by tt-report), and by hand. Wall time is not the cost here: the spec reporter prints 150 lines per run, so the quiet reporter is the step 3 hygiene item.
- 2026-09-05T22:56:36Z (main): Suite hygiene item found while merging prism-6fd864: prism-e76678 — test/fanout.test.js's timeout test spends its 100ms sink budget on node interpreter startup, so it fails under full-suite contention and passes alone. Measured here: node -e '' is 20-30ms at load ~24, sh -c ':' is ~0ms.
- 2026-09-06T09:00:50Z (main): step 4 hygiene: prism-e76678 landed (fan-out timeout test now measures the kill path, not node startup); reproduced and verified under 96 CPU burners on the 32-core box.
- 2026-09-09T01:55:28Z (main): Step 4 cost datapoint: prism-52bc13's contract test is the most expensive single test in the suite -- two 'prism describe' spawns plus one lua spawn, ~300ms of a ~1.87s full suite (was ~1.78s). Process spawns, not compute; nothing to trim without giving up the end-to-end check.
- 2026-09-19T22:49:16Z (prism-aec90f): Process metadata repaired during compositional-profile preflight: the recorded audit steps and existing implementation settle approach and verification; no new design is needed.
- 2026-09-28T08:34:21Z (main): baseline 2026-09-28 (tt-report --project prism --since 2026-09-05 --until 2026-09-24; 18 active days, before step 3): test 177 runs median 4.1s p90 8.3s fail 0.16, 14 min total; test-fast 5 runs median 1.5s p90 4.4s fail 0.00, 0 min total; check 145 runs median 0.1s p90 0.2s fail 0.03, 0 min total; hook-pre-commit 272 runs median 0.1s p90 0.3s fail 0.01, 0 min total; front-door total 0.24 h (1 min per active day), ad-hoc targets 0 min; fast/full by agents 0.03; bypasses 122
- 2026-09-28T08:35:59Z (main): Baseline window 2026-09-05..09-24 closes the day before ops host-budget worker sizing (09-25), the first timing change after step 1; no step-3 change had landed. Front-door total counts wrapper seconds of test, test-fast, check and both hooks. Next: step 3 (gates to ops design §4.6, the AGENTS.md inner-loop line, hygiene the numbers point at), then an after-window read with tt-report --since/--until.
- 2026-09-28T10:27:50Z (main): Step 3 now follows ops docs/specs/2026-09-28-test-ci-act-design.md: copy templates/justfile's test-one, docs_paths/docs_check_cmd/hook-pre-commit-docs, ci_suite_refs/ci_remote/push_fast_cmd/hook-pre-push-fast and both templates/githooks; set ci_suite_refs from the refs CI actually runs the full suite for (say which in a note); add the AGENTS.md Gates line (templates/AGENTS.md). Then the after-window against this piece's baseline note.
