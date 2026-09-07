---
id: prism-014c34
title: Verify the native and desktop contract
status: done
priority: 2
size: s
owner: glass-noise-acceptance
created: 2026-09-07T19:43:19Z
updated: 2026-09-07T21:24:30Z
depends: [prism-049c8c]
parent: prism-51f23b
tags: [niri]
spec: docs/specs/2026-09-06-glass-noise-type-design.md
plan: docs/plans/2026-09-07-glass-noise-type.md
step: "Task 3: Verify the native and desktop contract"
---

Validate all generated types on the installed native parser, test matching worktree CLI and plugin, record the lightness desktop gate, and correct status when landing.

## Notes

- 2026-09-07T20:26:17Z (glass-noise-types): Plan corrected from user review: active data-home plugin path and exact asynchronous disable/enable reload; user performs select clicks and grain acceptance; installed/running native hashes checked against implementation.
- 2026-09-07T20:44:12Z (glass-noise-types): Automated acceptance: six generated parser cases pass; installed and running niri f0370f52 both descend from 098bcdca; just gate passes 206 tests with only the environmental unreachable prism-fc8491 cycle warning. Live Noctalia select clicks, grain comparison, and lightness retention decision remain pending; no user store or desktop links were changed.
- 2026-09-07T21:01:19Z (main): User requested merge into main before desktop acceptance, then plugin reload for testing. Native checks already pass; actual clicks, grain comparison, and lightness retention remain pending. Existing active CLI/plugin links point at main.
- 2026-09-07T21:01:43Z (main): took over a live claim held by session glass-noise-native (owner glass-noise-types, host titan, worktree /mnt/ssd/Dropbox/prism/.worktrees/glass-noise-types, since 2026-09-07T20:41:01Z, age 1242s, live)
- 2026-09-07T21:03:52Z (main): Merged into main as 3d9f568 at user request. Merged just gate passes 212 tests and Lua; tasks check has zero errors/warnings. Shell IPC disable/enable succeeded and panel-open returned ok after asynchronous registration. CLI/plugin links already resolve to main. prism apply and actual panel/grain acceptance still require the user terminal/live check.
- 2026-09-07T21:16:08Z (glass-noise-acceptance): User reports updated panel works and fine/lightness look very similar; retain fine and remove lightness from the Prism selector. No saved lightness overrides found in current Prism config. Compare GIMP CIE LCh/HSV noise as a separate follow-up.
- 2026-09-07T21:21:34Z (glass-noise-acceptance): User confirms panel works; retain white/fine after similar fine/lightness comparison. Cleanup passes 212 Node tests plus Lua and four niri parser cases; installed/running f0370f52 descends from 098bcdca. Native project owner handles its acceptance record.
- 2026-09-07T21:24:30Z (glass-noise-acceptance): Selector cleanup e3cef3f fast-forwarded into main. Main just gate passes 212 Node tests plus Lua; plugin disable/enable and delayed panel-open succeed, plugin list confirms enabled.
