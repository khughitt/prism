---
id: prism-ea3efb
title: Panel notice when the host has disabled it
status: idea
priority: 2
reviewed: true
reviewed_at: 2026-10-17T21:27:53Z
created: 2026-10-17T21:19:38Z
updated: 2026-10-17T21:27:53Z
depends: [prism-220e66]
parent: prism-ab3a3d
tags: []
agent: claude-code/claude-opus-5-5
---

From prism-dac509's spec, Follow-ups: the host's one-time notification is easy to miss; a panel-side heartbeat cannot run while the runtime is disabled. Upstream #3893 tracks the host side.

## Notes

- 2026-10-17T21:27:53Z (main): scope: briefed; parented under goal prism-ab3a3d, waits on probe prism-220e66 (can the bar widget see a stale panel heartbeat and hot-reload the panel?); host facts read from Noctalia fork 7f547389f, upstream #3893 still open 2026-10-12; brief: docs/notes/2026-10-17-panel-disabled-notice-brief.md
