---
id: prism-f67834
title: Expose the signal accent strength and edge tint in the Ring group
status: todo
priority: 1
size: s
complexity: low
process: direct
created: 2026-10-02T10:32:21Z
updated: 2026-10-02T10:32:22Z
depends: [material-48b514]
tags: [material, noctalia]
agent: claude-code/claude-opus-5-5
---

Prism half of material-48b514: glass.ring.accent (0-3, default 1) emitted as ring-accent, and an Edge tint switch emitting attention "rim-orbit" (on, today's default) or "none", both bound for reload with defs/render/apply/presentation coverage like glass.ring.rest (prism-f71919). Hold off prism main until the niri carrying ring-accent is installed. The Ring group's labels should make clear that Glow and Resting ring scale the focus light only, and that Accent strength scales the familiar session hue.
