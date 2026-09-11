---
id: prism-46035b
title: "Wallpaper autosave: the wallpaper layer captures edits without a pin"
status: todo
priority: 2
size: m
created: 2026-09-11T01:13:09Z
updated: 2026-09-11T01:13:09Z
depends: []
parent: prism-2f0b4b
tags: [quick-add, profiles, store, noctalia]
source: "mindful:thought:1e2513d2f5ea48609022559f3c687d01"
---

Goal: tuning while a wallpaper is showing should persist for that wallpaper automatically. Today the wallpaper layer is an automatic overlay that reapplies its delta and never captures edits unless the user pins it (decision of 2026-09-06, prism-fc8491). The pin is a step users should not need.

This reverses that decision, so the brainstorm must settle what the write target is when no profile is loaded and a wallpaper is showing: if the wallpaper layer always captures, base is only reachable with no wallpaper, or through an explicit 'edit the default' mode. Decide it together with the default-profile idea from this seed.

Layers are already stored separately and composed at resolve (prism-6fd864), so clearing the wallpaper layer alone is a real operation. Affects prism-bf3ae9 (panel-wide restore under a pinned wallpaper).

Pieces: the store rule and pin removal; the panel header (edited indicator and reset-wallpaper-layer button replacing the filename).
