---
id: prism-e08ee6
title: "Wallpaper header: edited indicator and a reset-wallpaper-layer button instead of the filename"
status: todo
priority: 2
size: s
complexity: mid
created: 2026-09-11T01:13:09Z
updated: 2026-09-12T16:46:10Z
depends: []
parent: prism-46035b
tags: [quick-add, profiles, ui, noctalia]
source: "mindful:thought:1e2513d2f5ea48609022559f3c687d01"
---

Replace the wallpaper header row from prism-3b7c07. Drop the basename display; show an icon when the wallpaper layer holds overrides, and a button that clears only that layer (the profile and base layers stay as they are). Needs a CLI verb or reset mode that unsets every key of one wallpaper context. Presentation and queue modules carry the layout contract, so the Lua tests must cover the new row.
