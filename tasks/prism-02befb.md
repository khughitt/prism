---
id: prism-02befb
title: Expose Noctalia select notifyOnReselect to plugin panels
status: done
priority: 3
size: xs
complexity: low
process: direct
owner: main
created: 2026-09-20T12:30:47Z
updated: 2026-09-29T18:36:55Z
started: 2026-09-29T18:27:42Z
completed: 2026-09-29T18:36:55Z
depends: []
tags: [noctalia, ui]
agent: codex
---

Noctalia-side follow-up: Select already has setNotifyOnReselect, but declarative select properties do not expose it. Add opt-in property so Prism can receive a genuine user click on the already-selected profile. Programmatic reconciliation remains silent. Not a dependency of profile-wallpaper pairs; existing Keep for wallpaper handles current-pair save.

## Notes

- 2026-09-29T18:27:42Z (main): started
- 2026-09-29T18:36:51Z (main): Implemented in the noctalia fork, commit 7f547389f on feat/plugin-select-notify-on-reselect (worktree .worktrees/plugin-select-notify-on-reselect): declarative notifyOnReselect prop on ui.select, applied unconditionally so a dropped prop restores silence, registered as plugin API 32 with reconciler tests and docs; full suite 113/113, clang-tidy clean on the touched sources.
- 2026-09-29T18:36:55Z (main): done
- 2026-09-29T18:36:55Z (main): Exposed notifyOnReselect to plugin panels: the noctalia fork gained a declarative ui.select prop (plugin API 32, commit 7f547389f, branch feat/plugin-select-notify-on-reselect) with reconciler tests and docs; panel adoption filed as prism-8a8e7b pending an installed shell with API 32.
