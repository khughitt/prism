---
id: prism-1c111f
title: Show one focused and one unfocused window while tuning a parameter that affects both
status: idea
priority: 2
reviewed: true
created: 2026-10-09T14:58:40Z
updated: 2026-10-14T11:03:15Z
depends: [prism-c0500d]
parent: prism-67b1b2
tags: [quick-add]
source: "mindful:thought:82d0e293ab66c2893b45ee06e0013efd"
agent: claude-code/claude-opus-5-5
---

When adjusting a property that affects focused and unfocused windows, arrange (if possible) for the workspace to show two windows, one focused and one not, so the effect on both is visible at once. Related: prism-9bbe0a, prism-4f8bab.

## Notes

- 2026-10-14T11:03:14Z (main): scope: briefed; parented under prism-67b1b2; waits on research prism-c0500d. Materials are assigned by is-active (render.js), which per niri's docs survives the panel's exclusive keyboard focus, so both materials show whenever a second terminal is in view; open: detecting that case and a remedy that keeps the active window; brief: docs/notes/2026-10-14-panel-ergonomics-brief.md
