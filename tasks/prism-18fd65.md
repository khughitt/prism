---
id: prism-18fd65
title: Make the wallpaper layer the write target automatically and drop the pin
status: dropped
priority: 2
size: s
complexity: mid
created: 2026-09-11T01:13:09Z
updated: 2026-09-19T21:15:37Z
depends: []
parent: prism-46035b
tags: [quick-add, profiles, store, cli]
source: "mindful:thought:1e2513d2f5ea48609022559f3c687d01"
---

Store rule: with no profile loaded, writes go to the active wallpaper's layer without a pin. Remove prism context pin|unpin, the pinned field of describe, and the panel's pin toggle and its shadowing rule for wallpaper rows (a wallpaper row is now the target, never above it).

Decide and document how base is edited once the wallpaper always captures (no wallpaper reported, or an explicit mode). Revise docs/specs/2026-09-05-prism-context-layers-design.md in the same change.

## Notes

- 2026-09-19T21:15:37Z (prism-aec90f): dropped
  provenance: {"harness_session":"claude-code:1f37680c-20bd-40a3-9a1e-849bd9e3e3f7","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-09-19T21:15:37Z (prism-aec90f): superseded: the pin is gone and the hook folds scratch into the leaving wallpaper (prism-aec90f)
  provenance: {"harness_session":"claude-code:1f37680c-20bd-40a3-9a1e-849bd9e3e3f7","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
