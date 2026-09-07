---
id: prism-d6b600
title: "Additional glass noise types (CIE, HSV, ...)"
status: done
priority: 2
size: m
created: 2026-09-05T02:36:51Z
updated: 2026-09-07T21:21:34Z
depends: [material-6e7352]
tags: [material, noise]
spec: docs/specs/2026-09-06-glass-noise-type-design.md
---

Goal delivered: Focus has a shared Noise type select (white and fine; default fine), and the niri sink writes a quoted type into both glass materials. Native white/fine/lightness support is installed. Desktop comparison found fine and lightness similar, so Prism retains fine. GIMP CIE LCh/HSV comparison is a separate follow-up, prism-fb0f3e.

## Notes

- 2026-09-06T00:32:54Z (main): Observed 2026-09-05: current RGB white noise looks too grainy and coarse; native work filed as material-6e7352
- 2026-09-07T01:07:17Z (glass-noise-types): Scoped 2026-09-06 after brainstorming: shader-only type selector chosen over a blue-noise texture and over a spike; chroma/hue grain and dithering left out
- 2026-09-07T21:21:34Z (glass-noise-acceptance): Native types installed and Prism shared selector accepted; retain white/fine. GIMP comparison tracked separately in prism-fb0f3e.
