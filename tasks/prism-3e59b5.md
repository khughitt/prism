---
id: prism-3e59b5
title: Wallpaper properties and user nudges as data
status: idea
priority: 2
created: 2026-09-11T23:34:15Z
updated: 2026-09-29T22:43:31Z
depends: []
parent: prism-179840
tags: [quick-add, adaptive, cross-project, wallpaper, profiles]
source: "mindful:thought:a476e6bcd1fd4297b70824758235d821"
---

Pre-compute useful image properties per wallpaper (brightness, contrast, busyness, dominant palette, possibly embeddings) and record every parameter change the user makes together with the wallpaper active at the time. This is the dataset for learning wallpaper-conditioned parameter sets. Builds on prism-2f0b4b (per-wallpaper profiles are the mechanism that applies a learned set) and prism-d46d07. wali (walictl) already keeps like/dislike stats per image and is the natural owner of the property precompute if that work materializes; it is not a registered tasks project yet.

Source: mindful:thought:a476e6bcd1fd4297b70824758235d821

## Notes

- 2026-09-11T23:39:09Z (main): prism-284a61 (dice) is a ready-made random-modulation surface; the explicit rating idea filed alongside supplies labels.
- 2026-09-29T22:43:31Z (main): scope: briefed; parented under prism-179840; prism-6aca8a separates user gestures from rotation-carried scratch and checks image-property ownership; original Mindful source unavailable locally; brief: docs/notes/2026-09-29-look-exploration-brief.md
