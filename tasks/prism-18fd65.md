---
id: prism-18fd65
title: Make the wallpaper layer the write target automatically and drop the pin
status: todo
priority: 2
size: s
complexity: mid
created: 2026-09-11T01:13:09Z
updated: 2026-09-12T16:46:10Z
depends: []
parent: prism-46035b
tags: [quick-add, profiles, store, cli]
source: "mindful:thought:1e2513d2f5ea48609022559f3c687d01"
---

Store rule: with no profile loaded, writes go to the active wallpaper's layer without a pin. Remove prism context pin|unpin, the pinned field of describe, and the panel's pin toggle and its shadowing rule for wallpaper rows (a wallpaper row is now the target, never above it).

Decide and document how base is edited once the wallpaper always captures (no wallpaper reported, or an explicit mode). Revise docs/specs/2026-09-05-prism-context-layers-design.md in the same change.
