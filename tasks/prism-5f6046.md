---
id: prism-5f6046
title: Wallpaper rotation keeps the screen and pending edits; only a saved incoming pair changes settings
status: doing
priority: 2
size: m
complexity: mid
process: planned
owner: main
created: 2026-09-27T15:59:52Z
updated: 2026-09-27T16:24:01Z
started: 2026-09-27T15:59:52Z
depends: []
parent: prism-2f0b4b
tags: [wallpaper, profiles, noctalia]
agent: claude-code/claude-opus-5-5
spec: docs/specs/2026-09-27-rotation-keeps-edits-design.md
plan: docs/plans/2026-09-27-rotation-keeps-edits.md
---

Every Noctalia/wali rotation (every 30 min) runs 'prism context wallpaper', whose changeSlots saves scratch into the outgoing look-wallpaper pair, clears scratch, and re-resolves: unsaved edits vanish from screen and the profile reloads. Wanted (user, 2026-09-27): a rotation changes only the wallpaper and Noctalia's colorscheme; prism settings change only when the incoming wallpaper has a saved pair for the current look. Decided: no outgoing autosave on rotation (pairs come only from Keep for wallpaper); one rule — a rotation changes only the keys the incoming pair sets, every other visible value stays, carried as pending scratch (so leaving a paired wallpaper turns its values into pending edits); existing ~70 pairs are kept, no migration. Profile selection rows of the 2026-09-20 pairs design are unchanged. Amends the Rotate row of docs/specs/2026-09-20-profile-wallpaper-pairs-design.md.

## Notes

- 2026-09-27T15:59:52Z (main): started
  provenance: {"harness_session":"claude-code:f8e92955-b9e0-4c68-8462-c120c2170535","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
