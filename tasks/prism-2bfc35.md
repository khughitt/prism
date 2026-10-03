---
id: prism-2bfc35
title: Harden ui.when and subgroup validation for rack cards and matrix rows
status: todo
priority: 4
size: s
complexity: low
process: direct
created: 2026-10-03T11:19:01Z
updated: 2026-10-03T11:19:02Z
depends: []
parent: prism-980a29
tags: [ui]
---

From the final review of prism-b4d118, unreachable with shipped defs: (1) validateRack and Presentation.rack refuse otherwise: hidden only on a card's mix row; a bypass key with otherwise: hidden would vanish silently — refuse it the same way. (2) checkSubgroups does not require a matrix row's two halves to name one subgroup; refuse a split like the twin ui.when check. (3) appendSection computes hasMatrix before gating, so a section whose matrix rows are all hidden still draws the column header. (4) plugin_test.lua's hidden-mix reset test checks the Revert section (1) count but never clicks it; assert the issued argv reverts glass.tintAccentMix. (5) integrations/niri/apply: a report temp file is left if the KDL write fails before validate; a rollback that throws masks the validate error.

## Notes

- 2026-10-03T11:19:01Z (prism-4f8bab): concerns: prism-b4d118 extension — validation and test hardening deferred from its final review
