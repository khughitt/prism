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
updated: 2026-09-21T10:17:57Z
started: 2026-09-19T20:01:22Z
depends: []
parent: prism-2f0b4b
tags: [profiles, store, noctalia]
agent: claude-code/claude-fable-5-1
---

Design the profile system as a fold over layers: defaults, base, profile (the look), context deltas (wallpaper first; theme, power later), and a scratch layer that takes every edit. Commits are typed (base, profile, save-as, wallpaper); revert clears scratch; the wallpaper hook folds scratch into the leaving wallpaper's delta. Settles prism-46035b, prism-bf3ae9, prism-ad2b12, prism-b8b589, prism-920f31, prism-8a8eac, prism-49a068, and frames prism-9298b9. Focus, urgency, and familiar identity stay compositor-side signals. Brainstormed 2026-09-19; rule chosen: scratch layer with commit gestures.

## Notes

- 2026-09-19T20:01:22Z (main): started
  provenance: {"harness_session":"claude-code:1f37680c-20bd-40a3-9a1e-849bd9e3e3f7","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-09-21T10:17:57Z (main): rollout 2026-09-21: ~/bin/prism now points at the prism-1514d3-bridge worktree (this branch + fe7b59f cherry-picked, 464/464) because the installed niri 649c731b rejects ring-sweep-ms and main cannot read _wallpapers; a plain merge of main into this branch conflicts in src/cli.js and src/context-cli.js (~900 lines, main's commands.js refactor) — merge main before finishing, reuse the bridge's test re-pointing (242e113), then remove the bridge worktree and point ~/bin/prism back at main
