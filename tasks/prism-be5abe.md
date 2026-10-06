---
id: prism-be5abe
title: "Noise placement in the rack: a select, then drag between legal sites, through the niri sink"
status: todo
priority: 2
size: m
complexity: mid
created: 2026-10-05T01:45:48Z
updated: 2026-10-06T03:57:46Z
depends: [prism-eef38f, material-cf32e5, prism-e11d93, prism-a56441]
parent: prism-a03862
tags: [ui, noctalia, material, bus]
agent: claude-code/claude-fable-5-1
---

Prism side of the first movable device. One flat key, glass.noiseSite (backdrop | glass | film), layered, profiled, and reset like any scalar. The niri sink emits it as the noise node's site attribute. The rack draws the noise card at its site in chain order and explains what changed: at the backdrop site the card has one amount and says why (per-output scope, from the schema); at film it says the grain lands over the ring and glint, glass only.

Expose placement through a select first, then drag: both write the same key. Drag uses Noctalia dragSource/dropZone with only the sites the schema allows for noise lit, and keeps a keyboard-accessible equivalent (the select). Arbitrary permutations are out of scope; prism-542904 stays shelved until a second device moves.

Depends on the schema design (prism-eef38f) for the legal sites and on the renderer work (material noise placement task) for the attribute to exist.

## Notes

- 2026-10-06T03:57:46Z (main): Schema vendored by prism-a56441 (niri-material 1d2777aa). For the rack: the spec's Section 5 shadows sentence is wrong (renderer spec plan §6), and the interaction document needs the measured softening and cost prose: backdrop grain keeps 4% at one blur pass and nothing above the 8-bit floor from three passes or any roughness level above 0, so site=backdrop reads as grain only with backdrop-blur false and roughness 0; cost per backdrop damage ~1.8 ms GPU at either site (grain pass ~0.09 ms), a dragged backdrop amount ~1.4 ms per change vs 0.29 ms for glass. Evidence: niri-material docs/materials/2026-10-05-noise-placement-evidence.md. Owner's look at the backdrop site still pending.
