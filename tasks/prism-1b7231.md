---
id: prism-1b7231
title: Hide Accent strength outside the familiar ring source
status: todo
priority: 3
size: xs
complexity: low
process: direct
created: 2026-10-03T11:19:01Z
updated: 2026-10-03T11:19:02Z
depends: []
parent: prism-980a29
tags: [ui, material]
---

Why: niri render emits accent "none" unless glass.ring.colorSource is familiar (integrations/niri/render.js responseBlock), so glass.ring.accent does nothing under noctalia or manual. The ring-axis spec's success line says a control that does nothing under the current source is not shown, but its Applied-to table omits this key (final review of prism-4f8bab/prism-b4d118). Candidate: ui.when {param: glass.ring.colorSource, in: [familiar], otherwise: hidden}. Edge tint stays (independent of source). Owner's call whether the gate is wanted.

## Notes

- 2026-10-03T11:19:01Z (prism-4f8bab): concerns: prism-b4d118 extension — gate Accent strength on the familiar ring source, applying the spec's own success criterion
