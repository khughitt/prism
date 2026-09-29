---
id: prism-d47f43
title: Design safe orphan cleanup from the store maintenance brief
status: todo
priority: 2
size: s
complexity: high
process: planned
created: 2026-09-29T22:48:48Z
updated: 2026-09-29T22:48:48Z
depends: []
parent: prism-5a7c8a
tags: [store, cli]
source: docs/notes/2026-09-29-store-maintenance-brief.md
agent: codex
---

Question: What is the smallest safe all-store orphan-removal command for the current look/pair/runtime layout?

Where to start: docs/notes/2026-09-29-store-maintenance-brief.md; src/cli.js doctor and unset; src/migrate.js planMigration, replacements, writeBackup and writeMigrated; src/contexts.js look/runtime readers; test/cli.test.js and test/write-order.test.js.

Bound: Produce a reviewed design and implementation plan for orphan cleanup only. Decide doctor --prune versus a dedicated prune verb; enumerate Default, every named look and every pair, plus runtime scratch. Distinguish true orphans from known replacement keys, preserve saved values and metadata, and define backup, validation-before-write, malformed-file refusal, interrupted-prefix reporting/retry, bus refresh and sink application. Reuse current locking and backup primitives; do not add journalling or change ordinary unset semantics. No implementation in this task.

Expected result: Attach the reviewed spec and plan, acceptance cases for two orphans, inactive pairs, replacement keys, malformed inputs, no-op reruns and partial I/O failure, and a bounded implementation decomposition. Update the brief with settled decisions.

Ideas it wakes: On completion, run tasks note on prism-6c4469 with the approved cleanup contract and remaining implementation work, in the same commit as this result.
