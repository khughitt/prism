---
id: prism-014c34
title: Verify the native and desktop contract before landing
status: doing
priority: 2
size: s
owner: glass-noise-types
created: 2026-09-07T19:43:19Z
updated: 2026-09-07T20:44:12Z
depends: [prism-049c8c]
parent: prism-51f23b
tags: [niri]
spec: docs/specs/2026-09-06-glass-noise-type-design.md
plan: docs/plans/2026-09-07-glass-noise-type.md
step: "Task 3: Verify the native and desktop contract before landing"
---

Validate all generated types on the installed native parser, test matching worktree CLI and plugin, record the lightness desktop gate, and correct status when landing.

## Notes

- 2026-09-07T20:26:17Z (glass-noise-types): Plan corrected from user review: active data-home plugin path and exact asynchronous disable/enable reload; user performs select clicks and grain acceptance; installed/running native hashes checked against implementation.
- 2026-09-07T20:44:12Z (glass-noise-types): Automated acceptance: six generated parser cases pass; installed and running niri f0370f52 both descend from 098bcdca; just gate passes 206 tests with only the environmental unreachable prism-fc8491 cycle warning. Live Noctalia select clicks, grain comparison, and lightness retention decision remain pending; no user store or desktop links were changed.
