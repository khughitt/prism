---
id: prism-8d5d8e
title: "Rethink the Ring layout: scope headings instead of a half-empty focus axis"
status: todo
priority: 2
size: s
complexity: mid
created: 2026-10-03T11:48:36Z
updated: 2026-10-03T11:48:37Z
depends: []
parent: prism-980a29
tags: [ui, material]
---

Owner acceptance of prism-4f8bab (2026-10-03) passed but found the layout confusing: Band rows span both columns yet read as belonging to neither; Focus light leaves the Unfocused column all dashes; Signal accent is unexplained and goes back to one column; no Ring param differs per state, so the column header promises a split that never appears. Facts: Band (gap, width, color, light bending) and Signal accent (accent strength, edge tint) apply to every window; Focus light only to the focused one. prism writes one response block into both terminal-glass and terminal-glass-inactive, so per-state ring values need no upstream change (geometry differences would jump the band on a material swap, cf. material-5a5fff). Recommendation: drop ui.column from the Ring and the column header with it; order Band, Signal accent, Focus light, with headings that say the scope (every window / every window, familiar source / focused window only). Rejected: per-state accent strength to make Signal accent a real matrix row — adds params nobody has asked to vary. Owner picks.

## Notes

- 2026-10-03T11:48:36Z (main): concerns: prism-4f8bab change — owner found the focus-axis layout awkward at acceptance; wants clearer scope per subgroup
