---
id: prism-46ad16
title: Scope one Noctalia contribution for the panel's color needs
status: done
priority: 2
size: s
owner: main
created: 2026-09-06T00:38:34Z
updated: 2026-09-06T09:26:22Z
depends: []
tags: [noctalia, ui]
---

Three panel wants all run into the plugin API 22 limits recorded on prism-686374: a tint swatch (prism-d299f0), per-section color (prism-e140ef), and accent-colored icon buttons (prism-ed35d4). Check each against what API 22 renders today; for whatever needs a shell change, write one combined upstream proposal (checkouts under software/noctalia) rather than three, and record which of the three prism tasks can proceed without it.

## Notes

- 2026-09-06T09:26:22Z (main): Checked all three against v5.0.1 source (installed, API 30) and upstream docs. Tint swatch (prism-d299f0) and section color (prism-e140ef) need no shell change: box/column fill with hex or role/alpha tokens does both. Only accent-colored icon buttons (prism-ed35d4) need a contribution; the combined proposal (button color prop, container tooltip) is written in the noctalia fork at docs/superpowers/specs/2026-09-06-plugin-ui-button-color-and-container-tooltip.md, uncommitted.
