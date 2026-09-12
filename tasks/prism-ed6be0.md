---
id: prism-ed6be0
title: Investigate intermittent slow material GPU draws
status: todo
priority: 2
size: m
complexity: high
created: 2026-09-08T20:15:43Z
updated: 2026-09-12T16:46:10Z
depends: []
tags: [performance, material, investigation]
source: "docs/notes/2026-09-07-glass-noise-dulling-spike-results.md#completed-actual-output-resolution-check"
---

Follow up the completed Dulling spike prism-ba5f59. At 3440x1440, GIMP-style Dulling 2 had run p95s of 1.097728 / 0.036864 / 1.598464 ms; noise-off also reached 1.207296 ms. Repeat ranges overlap, so the spike does not isolate Dulling overhead or the cause of slow draws.

Evidence: docs/notes/2026-09-07-glass-noise-dulling-spike-results.md; local artifact root /mnt/ssd3/tmp/prism-dulling-spike. Start with hardware-output-006/verified.json and raw GPU CSVs/Tracy traces, then the 60-case hardware-matrix-006 controls. Frozen prototype source is native branch spike/glass-dulling at 17dfe00a, based on 691a1320; prototype.patch, benchmark-driver.patch, provenance.json and benchmark-provenance.json preserve source/binary identity.

Scope:
- Preserve the completed spike as an immutable snapshot in niri-experiments (report, reproducible scripts/fixtures, patches or a native Git bundle, hashes, and an indexed durable location for raw traces). Keep the existing native prototype branch intact; investigate on a fresh branch. Do not merge prototype compositor changes into production or merge unrelated repository histories.
- Reuse existing captures to locate slow draws, checking the GPU span boundaries and whether damage/coverage, render target, cache invalidation, CPU submission, or query behavior separates slow and ordinary draws.
- For focused follow-up captures, record per-draw damage/coverage and GPU clocks/utilization/power state. Compare noise-off, fine and Dulling 2 under the same workload; do not presume a Dulling-specific cause or replace GPU evidence with CPU/FPS.
- Prefer a small discriminating experiment to another broad matrix sweep. Keep background-load observations separate from causal claims.

Done when slow draws have a reproducible cause, or a bounded measurement limitation is established, with evidence and a concrete next action that supports or revises the Dulling cost conclusion. Production Dulling implementation and live visual acceptance remain separate work.

## Notes

- 2026-09-08T20:20:00Z (glass-noise-spike-plan): User clarified that the benchmark tests ran while the machine was in use. No continuous GPU-heavy tasks were running, but intermittent desktop activity could have contributed to slow draws. This is a possible confound, not an established cause; capture activity and GPU state during focused follow-up measurements.
- 2026-09-08T20:29:51Z (glass-noise-spike-plan): Preservation prepared and restore-tested: niri-experiments results/glass-dulling at ebea8e25; 2725 hash-verified evidence files, self-contained native bundle 17dfe00a and all 26 HEAD Git LFS objects. Package/import helper is in Prism .local-artifacts/glass-dulling-2026-09-08. Destination import awaits user execution because niri-experiments is outside writable roots; investigation remains todo.
