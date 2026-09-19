---
id: prism-aec90f
title: "Compositional profile model: scratch edits, deltas above the look, typed commits"
status: doing
priority: 2
size: m
complexity: high
process: planned
owner: main
created: 2026-09-19T20:01:06Z
updated: 2026-09-19T20:31:04Z
started: 2026-09-19T20:01:22Z
depends: []
parent: prism-2f0b4b
tags: [profiles, store, noctalia]
agent: claude-code/claude-fable-5-1
spec: docs/specs/2026-09-19-compositional-profiles-design.md
---

Design the profile system as a fold over layers: defaults, base, profile (the look), context deltas (wallpaper first; theme, power later), and a scratch layer that takes every edit. Commits are typed (base, profile, save-as, wallpaper); revert clears scratch; the wallpaper hook folds scratch into the leaving wallpaper's delta. Settles prism-46035b, prism-bf3ae9, prism-ad2b12, prism-b8b589, prism-920f31, prism-8a8eac, prism-49a068, and frames prism-9298b9. Focus, urgency, and familiar identity stay compositor-side signals. Brainstormed 2026-09-19; rule chosen: scratch layer with commit gestures.

## Notes

- 2026-09-19T20:01:22Z (main): started
  provenance: {"harness_session":"claude-code:1f37680c-20bd-40a3-9a1e-849bd9e3e3f7","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-09-19T20:05:54Z (prism-aec90f): Brainstormed 2026-09-19: scratch layer with typed commits chosen over auto-capture and a scope selector; deltas move above the look; spec drafted for review
- 2026-09-19T20:15:49Z (prism-aec90f): Review round 1: validate before writing with a fixed multi-file write order; rotation refresh and id-checked wallpaper verbs in scope (absorbs prism-b6d7ee); save-as exempt from the empty-scratch refusal; save-as snapshots the screen, deltas included, so neutral-then-save-as is exact
- 2026-09-19T20:27:20Z (prism-aec90f): Review round 2: save-as activates before clearing scratch; the hook keeps scratch when no wallpaper is leaving; the slot records the path as given so the panel reconciles by string equality and issues the hook verb itself
- 2026-09-19T20:31:04Z (prism-aec90f): Review round 3: the hook stays the sole automatic writer and the panel refreshes describe every two seconds while open; given dropped; a slot carrying the retired pinned field is repaired once on read
