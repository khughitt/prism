---
id: prism-5172ea
title: Give panel renders real headroom under the host CPU budget
status: idea
priority: 2
created: 2026-09-30T22:57:13Z
updated: 2026-09-30T22:57:17Z
depends: []
tags: [noctalia, performance]
agent: claude-code/claude-opus-5-5
---

After prism-831604 no callback renders twice, but one render still costs 10-14 ms of the 25 ms budget in-host, a describe that changes the model costs ~19 ms (decode 2 + validate ~5 + render), and on 2026-09-30 a single-render onFrameTick overran once during a drag. Options: move described's render to the next frame tick (splits decode from render; touches ~35 test describe sites), cache per-model Presentation derivations, throttle drag renders below frame rate, or ask Noctalia to meter the budget without a clock_gettime(CLOCK_THREAD_CPUTIME_ID) syscall on every Luau interrupt (~570 ns each, ~5.6k per render).

## Notes

- 2026-09-30T22:57:17Z (fix/panel-budget): concerns: prism-831604 extension — remaining single-render and changed-describe margin
