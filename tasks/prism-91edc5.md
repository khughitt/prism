---
id: prism-91edc5
title: Symmetric and near-zero reset modes alongside reset-to-defaults
status: done
priority: 2
size: m
owner: reset-modes
created: 2026-09-10T09:11:19Z
updated: 2026-09-10T11:48:17Z
depends: []
tags: [ui, noctalia, store]
---

Panel resets (row and section) unset overrides, so every parameter falls back to its def default, and those defaults differ per focus state (e.g. glass.roughness 0.08 vs glass.inactive.roughness 0.5 in defs/glass.yaml). Two additions: (1) a symmetric reset that gives focused and unfocused the same settings, so the split starts from parity; (2) a neutral reset that zeroes or clears most parameters while keeping a small curated set at non-zero values, giving users a baseline where each parameter's effect can be explored in relative isolation as it is brought back in. Neutral-set curation is part of the work: pick the few parameters a pane needs to stay legible.

## Notes

- 2026-09-10T10:13:55Z (reset-modes): Design approved and written to docs/specs/2026-09-10-reset-modes-design.md. Three modes behind one batched CLI verb (prism reset defaults|symmetric|neutral), a neutral: field on every visible def with glass.focusSplit exempt via neutralize: false, and describe gaining neutral and heldInTarget. paneLip 0 is provisional pending desktop acceptance. Undo filed separately as prism-b25061.
- 2026-09-10T11:14:08Z (reset-modes): took over session 0d303e11-37da-4a7e-b12c-f1d4619bb172 (owner reset-modes, host titan, pid 2878284, worktree /mnt/ssd/Dropbox/prism/.worktrees/reset-modes, since 2026-09-10T10:11:18Z, age 3770s, stale: pid 2878284 is gone)
- 2026-09-10T11:16:20Z (reset-modes): Implementation started from approved 5503adc in reset-modes: definitions and planner delegated with separate file ownership; describe and CLI integration in progress. Desktop acceptance remains pending.
- 2026-09-10T11:27:48Z (reset-modes): Definitions, batched reset CLI, describe ownership, and panel controls implemented. Full gate passes 304 Node tests plus Lua; independent review found no material issues. Worktree CLI/plugin loaded together and live panel render verified; awaiting desktop effect acceptance.
- 2026-09-10T11:29:42Z (reset-modes): parked (waiting on user): Implementation committed through 23fd4d1; gate passes 304 Node tests plus Lua, final review clean, live panel renders. Await user desktop acceptance: zero-bevel refraction/paneLip verdict, dependency behavior, symmetric parity, and one-reload restore. Both installed symlinks point at reset-modes; restore at merge.
- 2026-09-10T11:44:33Z (reset-modes): Desktop acceptance: Neutralize All produced bevel 0 and niri rejected both materials because the inherited ring requires inset 5 + width 2.6 <= bevel and forbids zero width. Curated neutral lip changed to 8 (6 would also fail with zero offsets). Regression reproduced red at 0, passes at 8; installed niri validates full neutral with split on/off. Applied corrected lip to current profile: reload succeeded and doctor OK. Broader existing small-geometry validation tracked as prism-71b7d1; desktop effect observations still pending.
- 2026-09-10T11:45:14Z (reset-modes): parked (waiting on user): Continue desktop effect acceptance with corrected neutral Edge bevel 8: raise Refraction, check blur dependencies, symmetric parity, and one-reload restore. Gate passes 305 Node tests plus Lua; actual niri validates split on/off and live doctor OK. Review clean. Both symlinks remain on reset-modes; restore at merge.
- 2026-09-10T11:48:17Z (reset-modes): User confirms Neutralize All works after the 8px bevel correction and explicitly authorizes closure, merge, and worktree cleanup. Acceptance recorded without claiming separate observations for every suggested effect check; broader small-geometry validation remains prism-71b7d1.
- 2026-09-10T11:48:17Z (reset-modes): Shipped batched defaults, symmetric, and neutral resets with panel controls; user accepted the corrected 8px neutral bevel.
