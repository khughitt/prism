---
id: prism-9d063e
title: "Cut the cold full-render cost: first expanded rebuild peaks 21-24 ms in-host"
status: todo
priority: 2
size: m
complexity: high
process: planned
created: 2026-10-17T21:19:38Z
updated: 2026-10-17T21:19:51Z
depends: []
tags: [noctalia, performance]
agent: claude-code/claude-opus-5-5
---

In-host 2026-10-17 (prism-f15cbf, short-comparison-report.md): with every rack card expanded, the first cold render after expansion took 20.7, 21.4, 22.2 and 24.1 ms across four fresh runtimes, under the 25 ms budget without headroom; later cold renders are bimodal (~11 ms or 18-21 ms). Offline the cold path is 8704 Lua calls, above the 8.5k a pre-retention render cost, because every render computes the signatures it compares (a drag tick still costs 3211, 37% of a full render). Compact tokens (5f08fec) did not help in-host and were reverted. Candidates: skip signature work under a retained parent hit, cache per-structure signature strings across renders, or spread a cold rebuild over frame ticks. Acceptance: first cold render with all cards expanded under ~18 ms in-host, measured with the short-comparison tooling attached to prism-f15cbf.

## Notes

- 2026-10-17T21:19:38Z (fix/panel-render-budget): concerns: prism-dac509 extension — the closed render-budget work keeps the panel under the host budget but leaves the cold full render with little headroom.
- 2026-10-17T21:19:51Z (fix/panel-render-budget): Correction: the concerns line above does not apply; prism-dac509 was still open when this was filed, so this is a follow-up from its own close-out, not a concern on closed work.
