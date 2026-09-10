---
id: prism-91edc5
title: Symmetric and near-zero reset modes alongside reset-to-defaults
status: doing
priority: 2
size: m
owner: reset-modes
created: 2026-09-10T09:11:19Z
updated: 2026-09-10T10:13:55Z
depends: []
tags: [ui, noctalia, store]
---

Panel resets (row and section) unset overrides, so every parameter falls back to its def default, and those defaults differ per focus state (e.g. glass.roughness 0.08 vs glass.inactive.roughness 0.5 in defs/glass.yaml). Two additions: (1) a symmetric reset that gives focused and unfocused the same settings, so the split starts from parity; (2) a neutral reset that zeroes or clears most parameters while keeping a small curated set at non-zero values, giving users a baseline where each parameter's effect can be explored in relative isolation as it is brought back in. Neutral-set curation is part of the work: pick the few parameters a pane needs to stay legible.

## Notes

- 2026-09-10T10:13:55Z (reset-modes): Design approved and written to docs/specs/2026-09-10-reset-modes-design.md. Three modes behind one batched CLI verb (prism reset defaults|symmetric|neutral), a neutral: field on every visible def with glass.focusSplit exempt via neutralize: false, and describe gaining neutral and heldInTarget. paneLip 0 is provisional pending desktop acceptance. Undo filed separately as prism-b25061.
