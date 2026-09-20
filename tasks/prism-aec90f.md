---
id: prism-aec90f
title: "Compositional profile model: scratch edits, deltas above the look, typed commits"
status: doing
priority: 2
size: m
complexity: high
process: planned
owner: prism-aec90f
created: 2026-09-19T20:01:06Z
updated: 2026-09-20T12:12:54Z
started: 2026-09-19T20:01:22Z
depends: []
parent: prism-2f0b4b
tags: [profiles, store, noctalia]
agent: claude-code/claude-fable-5-1
spec: docs/specs/2026-09-19-compositional-profiles-design.md
plan: docs/plans/2026-09-19-compositional-profiles.md
---

Design the profile system as a fold over layers: defaults, base, profile (the look), context deltas (wallpaper first; theme, power later), and a scratch layer that takes every edit. Commits are typed (base, profile, save-as, wallpaper); revert clears scratch; the wallpaper hook folds scratch into the leaving wallpaper's delta. Settles prism-46035b, prism-bf3ae9, prism-ad2b12, prism-b8b589, prism-920f31, prism-8a8eac, prism-49a068, and frames prism-9298b9. Focus, urgency, and familiar identity stay compositor-side signals. Brainstormed 2026-09-19; rule chosen: scratch layer with commit gestures.

## Notes

- 2026-09-19T20:01:22Z (main): started
  provenance: {"harness_session":"claude-code:1f37680c-20bd-40a3-9a1e-849bd9e3e3f7","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-09-19T20:05:54Z (prism-aec90f): Brainstormed 2026-09-19: scratch layer with typed commits chosen over auto-capture and a scope selector; deltas move above the look; spec drafted for review
- 2026-09-19T20:15:49Z (prism-aec90f): Review round 1: validate before writing with a fixed multi-file write order; rotation refresh and id-checked wallpaper verbs in scope (absorbs prism-b6d7ee); save-as exempt from the empty-scratch refusal; save-as snapshots the screen, deltas included, so neutral-then-save-as is exact
- 2026-09-19T20:27:20Z (prism-aec90f): Review round 2: save-as activates before clearing scratch; the hook keeps scratch when no wallpaper is leaving; the slot records the path as given so the panel reconciles by string equality and issues the hook verb itself
- 2026-09-19T20:31:04Z (prism-aec90f): Review round 3: the hook stays the sole automatic writer and the panel refreshes describe every two seconds while open; given dropped; a slot carrying the retired pinned field is repaired once on read
- 2026-09-19T20:44:03Z (prism-aec90f): Spec approved 2026-09-19. Plan detail from review: requirements (src/cli.js) calls loadStore unlocked; route it through the locked snapshot helper before readActive gains the pinned repair write
- 2026-09-19T21:15:37Z (prism-aec90f): Plan docs/plans/2026-09-19-compositional-profiles.md written 2026-09-19 with 13 steps filed as children; superseded tasks dropped and reframed ideas noted per spec Section 12
- 2026-09-19T21:15:52Z (prism-aec90f): parked (waiting on user, review): Plan review: the user reviews docs/plans/2026-09-19-compositional-profiles.md, then execution starts at Task 1 (prism-0dc242) in this worktree
  provenance: {"harness_session":"claude-code:1f37680c-20bd-40a3-9a1e-849bd9e3e3f7","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-09-19T21:29:24Z (prism-aec90f): Plan review round 1: clear computes its next state with the delta removed; commit awaited inside the CLI try; writes invalidate an in-flight describe; save-as adds the name to the selector list; fixtures avoid shipped defaults; tasks grouped into five green commits
- 2026-09-19T22:47:33Z (prism-aec90f): resumed
  provenance: {"harness_session":"codex:01a0bbd8-f021-7163-9af3-bf80490291a9","harness_session_source":"CODEX_SESSION_ID"}
- 2026-09-19T22:50:48Z (prism-aec90f): Approved plan implementation started with subagent-driven development. Baseline 327 Node tests plus Lua passes. Preflight moves pinned repair into atomic store/panel switch, validates migration and commit next states before writes, and broadens interruption coverage; execution order 1,2,3,4,5,6,7,9,10,8,11,12,13.
- 2026-09-20T00:41:39Z (prism-aec90f): Tasks 1–12 implemented and reviewed; final corrections add38b9 passed scoped review. Main ring-sweep work integrated at 5b03957; 385 Node tests plus Lua pass. Desktop preflight: installed niri 597aba66, running session 7526af1d; restart required before manual acceptance.
- 2026-09-20T00:47:41Z (prism-aec90f): parked (waiting on user, review): Implementation and reviews complete through48bf463; waiting for user session restart and six desktop acceptance observations on prism-439774. Then controller performs closeout and merge.
  provenance: {"harness_session":"codex:01a0bbd8-f021-7163-9af3-bf80490291a9","harness_session_source":"CODEX_SESSION_ID"}
- 2026-09-20T11:47:13Z (prism-aec90f): resumed
  provenance: {"harness_session":"codex:01a0bbd8-f021-7163-9af3-bf80490291a9","harness_session_source":"CODEX_SESSION_ID"}
- 2026-09-20T11:57:17Z (prism-aec90f): parked (waiting on user, review): Review proposed profile/wallpaper pair amendment in prism-a3484e. Count bug fixed in fde3bc8; pair semantics remain unchanged until spec and plan review, implementation, and renewed acceptance.
  provenance: {"harness_session":"codex:01a0bbd8-f021-7163-9af3-bf80490291a9","harness_session_source":"CODEX_SESSION_ID"}
- 2026-09-20T11:57:54Z (prism-aec90f): resumed
  provenance: {"harness_session":"codex:01a0bbd8-f021-7163-9af3-bf80490291a9","harness_session_source":"CODEX_SESSION_ID"}
- 2026-09-20T12:12:54Z (prism-aec90f): parked (waiting on user, review): Count bug fde3bc8 is reviewed, tested and loaded in the live panel. Pair-model spec approved; review its new implementation plan under prism-a3484e before execution and renewed desktop acceptance.
  provenance: {"harness_session":"codex:01a0bbd8-f021-7163-9af3-bf80490291a9","harness_session_source":"CODEX_SESSION_ID"}
