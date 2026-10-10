---
id: prism-2d5c61
title: "Lower slider maxima: spacing 60, bevel 20, pane offset +/-12, saturation 2, ring gap 20"
status: todo
priority: 2
size: s
complexity: low
process: direct
created: 2026-10-10T16:18:11Z
updated: 2026-10-10T16:18:11Z
depends: []
tags: [defs, ui]
agent: claude-code/claude-opus-5-5
---

New ranges: compositor.gaps (Window spacing) [0, 60]; glass.paneLip (Edge bevel) [0, 20]; glass.paneShiftX and glass.paneShiftY (Pane offset) [-12, 12]; glass.saturation and glass.inactive.saturation [0, 2]; glass.ring.gap (Ring gap) [0, 20]. Each span stays an integer multiple of its ui.step (defs.js checks it).

Stored values outside the new ranges become invalid and block the store (checked 2026-10-10 across values.yaml and contexts): compositor.gaps 78, glass.paneLip 34, glass.paneShiftX -63, glass.saturation 2.5, glass.ring.gap 82, one each. Clamp them to the new bound with a backup (migration or a one-off repair), then prism doctor clean. Update the tests that pin these ranges and check the niri sink does not clamp differently.
