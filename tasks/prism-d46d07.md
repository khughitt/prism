---
id: prism-d46d07
title: "Modulate the wallpaper behind windows: blur, desaturation, noise, brightness/contrast"
status: idea
priority: 2
reviewed: true
created: 2026-09-11T01:13:09Z
updated: 2026-10-14T11:11:38Z
depends: [prism-a67714]
parent: prism-85caf6
tags: [quick-add, wallpaper, integration, defs]
source: "mindful:thought:1e2513d2f5ea48609022559f3c687d01"
---

The wallpaper peeks through the gaps around and between windows. It is usually an unprocessed photo, so it reads as busier and noisier than the glass on top of it, with visible artifacts. Subtle processing (blur, desaturation, a little noise, brightness/contrast) would make it feel like background.

Proposal: expose the adjustments as ordinary prism parameters so they ride the profile, wallpaper, and state layers like every other value, and appear in the panel beside them.

Open questions: where the processing lives (wali pre-processing the image before hand-off, Noctalia's wallpaper layer, or a niri backdrop layer; see the Noctalia and wali boundary section of docs/superpowers/specs/2026-08-29-prism-debug-backdrop-design.md), and how subtle it must stay so the softened wallpaper does not compete with the glass material where the wallpaper shows through terminals (niri-material).

## Notes

- 2026-10-14T11:11:37Z (main): scope: briefed; parented under prism-85caf6; waits on research prism-a67714. Evidence: niri 26.04 layer-rule background-effect (blur, saturation, noise; xray blur cached) on a Bottom-layer surface would soften the gaps while the glass keeps refracting Layer::Background; Noctalia's wallpaper config has no adjustments and its [backdrop] is the overview backdrop; brief: docs/notes/2026-10-14-wallpaper-softening-brief.md
