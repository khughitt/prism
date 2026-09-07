---
id: prism-51f23b
title: Emit the glass noise type and expose it as a Focus select
status: todo
priority: 2
size: m
created: 2026-09-07T01:05:12Z
updated: 2026-09-07T19:44:26Z
depends: [material-6e7352]
parent: prism-d6b600
tags: [glass, noctalia, niri]
spec: docs/specs/2026-09-06-glass-noise-type-design.md
plan: docs/plans/2026-09-07-glass-noise-type.md
---

Prism piece of prism-d6b600: the glass.noiseType enum definition (white, fine, lightness; default fine) rendered as a select under the Noise row, the niri sink writing noise <amount> type=<type> into both materials, the manifest binding, tests, docs, and the live panel check of the select control. Lands only after the native build with the type property is installed, because the generated fragment fails niri validate without it.

## Notes

- 2026-09-07T19:40:17Z (glass-noise-types): Design review corrections committed in e2f07ed: require valid-select regression and JSON-quoted noise types. Implementation planning follows.
- 2026-09-07T19:44:26Z (glass-noise-types): Implementation plan written with three ordered children. Its exact Lua regression was checked in a temporary copy: fails before the validator fix and passes after. just check passes with one pre-existing cycle_unverifiable warning.
