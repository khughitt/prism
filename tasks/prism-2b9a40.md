---
id: prism-2b9a40
title: Expose the niri accent-tint response weight
status: idea
priority: 2
created: 2026-10-03T13:03:58Z
updated: 2026-10-09T04:34:40Z
depends: []
tags: []
agent: claude-code/claude-opus-5-5
---

niri gained response accent-tint (0–1, default 0; recommended 1 on dark glass); see niri-material docs/specs/2026-10-03-accent-tint-design.md and docs/materials/material-config.md. Prism has no key for it yet.

## Notes

- 2026-10-09T04:34:40Z (main): scope: drop; prism-1bb833 (Add familiar to glass.tintSource) already owns emitting and exposing niri's attenuation tint, and its upstream blocker material-6f45a0 is done with spelling 'accent-tint' (0-1, default 0, recommended 1 on dark glass); proposal: drop as covered by prism-1bb833
