---
id: prism-51f23b
title: Emit the glass noise type and expose it as a Focus select
status: done
priority: 2
size: m
created: 2026-09-07T01:05:12Z
updated: 2026-09-07T21:21:34Z
depends: [material-6e7352]
parent: prism-d6b600
tags: [glass, noctalia, niri]
spec: docs/specs/2026-09-06-glass-noise-type-design.md
plan: docs/plans/2026-09-07-glass-noise-type.md
---

Prism piece of prism-d6b600: glass.noiseType exposes white and fine (default) below the Focus Noise row; the sink writes a quoted type into both materials and the single-material path. Native build installed and parser checks pass. The user confirms the updated panel works; fine and lightness look similar, so the final Prism enum omits lightness.

## Notes

- 2026-09-07T19:40:17Z (glass-noise-types): Design review corrections committed in e2f07ed: require valid-select regression and JSON-quoted noise types. Implementation planning follows.
- 2026-09-07T19:44:26Z (glass-noise-types): Implementation plan written with three ordered children. Its exact Lua regression was checked in a temporary copy: fails before the validator fix and passes after. just check passes with one pre-existing cycle_unverifiable warning.
- 2026-09-07T21:21:34Z (glass-noise-acceptance): Shared white/fine selector, quoted type output, and desktop acceptance complete; fine remains default.
