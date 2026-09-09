---
id: prism-eab1a9
title: Move rack effect descriptions from info icons to label tooltips
status: doing
priority: 2
size: s
owner: rack-ui-polish
created: 2026-09-09T13:08:43Z
updated: 2026-09-09T13:43:07Z
depends: []
parent: prism-a03862
tags: [ui, noctalia]
source: docs/notes/2026-09-09-device-chain-rack-ui.png
---

Remove the separate circle-i icons from rack and parameter names and show the existing descriptions on name hover, reducing clutter. Use the native tooltip hit area. User live review on 2026-09-09 explicitly requested removing the additional click-to-expand help: name clicks must neither open inline text nor write parameters. Preserve the tooltip when controls are shadowed or unavailable. Related: prism-33f4ae documented native tooltip hit-area requirements. Acceptance: descriptions remain available on hover, with no separate info icons or click-expanded help. Reference: docs/notes/2026-09-09-device-chain-rack-ui.png.

## Notes

- 2026-09-09T13:28:04Z (rack-ui-polish): Replaced row info icons with ghost name buttons carrying native tooltips. Pointer/keyboard activation toggles the same description inline without writes; Lua coverage passes, including fallback text. Full gate and native lint pass; live hover/keyboard acceptance remains before closeout.
- 2026-09-09T13:43:07Z (rack-ui-polish): User accepted hover tooltips and requested deletion of redundant inline help. Removed help state and rendering; name clicks retain only the inert handler required for native tooltip hit testing.
