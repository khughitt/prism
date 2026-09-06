---
id: prism-e140ef
title: Color the main panel sections as a visual aid
status: todo
priority: 2
size: s
created: 2026-09-06T00:32:53Z
updated: 2026-09-06T09:26:09Z
depends: []
tags: [noctalia, ui]
---

Give each main section of the Prism panel (Title/Glass, Focus, ...) its own subtle color so the eye finds a group without reading headers. Constrained by what plugin API 22 exposes for headers and rows; prism-686374 records what is available. If per-section color needs a Noctalia contribution, note that and fold into prism-ed35d4.

## Notes

- 2026-09-06T09:26:09Z (main): Scoped by prism-46ad16 (checked against v5.0.1 source and upstream docs): NO Noctalia contribution needed. ui.column/ui.row accept fill, radius, border, borderWidth, padding; ui.separator and ui.label accept color. Wrap each section in a column with fill = '<role>/<alpha>' (roles: primary, secondary, tertiary, error, surface, surface_variant, outline; alpha suffix resolves live against the theme) or color the header label and separator per section.
