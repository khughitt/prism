---
id: prism-859bb7
title: prism writes runtime contexts under the tracked per-host config dir
status: idea
priority: 2
created: 2026-09-12T10:23:31Z
updated: 2026-09-29T22:48:51Z
depends: []
parent: prism-5a7c8a
tags: [dotfiles]
---

prism context <name> creates prism/<host>/contexts/<name>/ inside the dotfiles tree (setup.sh ensure_dirs contexts/ there and $XDG_CONFIG_HOME/prism links to it). Those are runtime values, not configuration: dotfiles-health's leak check flags every one as unowned and Dropbox carries them to the other machine. Route contexts to XDG_STATE_HOME/prism and read them from there; dotfiles then drops the ensure_dir and its 'real directory' health check.

## Notes

- 2026-09-29T22:48:51Z (main): scope: drop; current runtime slots and scratch are in state/active.json, while saved looks and pairs deliberately remain configuration; host dotfiles cleanup was not inspected; brief: docs/notes/2026-09-29-store-maintenance-brief.md; proposal: drop blanket context relocation as superseded by adeeebd and prism-01554f; file a concrete remaining host leak separately if observed
