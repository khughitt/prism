---
id: prism-b315f9
title: Explore exposing parameter interactions in the panel
status: idea
priority: 2
created: 2026-09-10T09:11:31Z
updated: 2026-09-11T23:39:09Z
depends: []
tags: [ui, noctalia, material]
---

When changing a parameter whose visible result is heavily influenced by another parameter (e.g. tint distance only reads once tint is non-neutral, refraction interacts with blur), surface that coupling in the UI: a small note in the margins naming the interacting parameter, and/or highlighting or coloring the sliders of the interacting parameters. Open questions: where the interaction knowledge lives (per-def metadata vs a curated table), how strength of interaction is graded, and how the affordance behaves while dragging.

## Notes

- 2026-09-11T23:39:09Z (main): material-0c7eed models parameter interactions and influence ordering; that model would tell the panel which interactions are worth exposing.
