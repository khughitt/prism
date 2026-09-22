---
id: prism-a2c205
title: Decide whether Prism should expose the ring filament width
status: doing
priority: 2
size: xs
complexity: low
process: direct
owner: main
created: 2026-09-22T13:19:50Z
updated: 2026-09-22T13:54:09Z
started: 2026-09-22T13:54:09Z
depends: []
tags: [niri]
agent: "claude-code/claude-opus-5[1m]"
---

prism-d8ee06's one unfinished clause. Native ring-width is >0 through 128, default 2.6; prism inherits it and emits nothing, which keeps the 'ring-width must be positive' validation error out of reach of a panel slider. The owner accepted the shipped filament on the 2026-09-21 ring beam sheets (niri-material docs/materials/2026-09-19-ring-beam-evidence.md), so the width is part of an accepted look rather than a gap. Reopen if the band should be tunable per profile; a slider would need a positive-only lower bound, not zero.

## Notes

- 2026-09-22T13:54:09Z (main): Owner decision 2026-09-22: yes, expose it. Native ring-width is >0 through 128, default 2.6; zero is rejected ('ring-width must be positive'), so the def's lower bound must be strictly positive.
- 2026-09-22T13:54:09Z (main): started
  provenance: {"harness_session":"claude-code:86218c99-e333-49f8-965c-e0e30c526e78","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
