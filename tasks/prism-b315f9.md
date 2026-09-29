---
id: prism-b315f9
title: Explore exposing parameter interactions in the panel
status: shelved
priority: 2
created: 2026-09-10T09:11:31Z
updated: 2026-09-29T22:43:30Z
depends: []
parent: prism-179840
tags: [ui, noctalia, material]
---

When changing a parameter whose visible result is heavily influenced by another parameter (e.g. tint distance only reads once tint is non-neutral, refraction interacts with blur), surface that coupling in the UI: a small note in the margins naming the interacting parameter, and/or highlighting or coloring the sliders of the interacting parameters. Open questions: where the interaction knowledge lives (per-def metadata vs a curated table), how strength of interaction is graded, and how the affordance behaves while dragging.

## Notes

- 2026-09-11T23:39:09Z (main): material-0c7eed models parameter interactions and influence ordering; that model would tell the panel which interactions are worth exposing.
- 2026-09-29T22:43:30Z (main): shelved: Wake when material-0c7eed or a documented, validated parameter interaction supplies a concrete hint and its applicability; then unshelve and scope the panel consumer.
- 2026-09-29T22:43:30Z (main): scope: shelved; parented under prism-179840; interaction guidance awaits an evidence-backed hint from material-0c7eed or a validated concrete interaction; brief: docs/notes/2026-09-29-look-exploration-brief.md
