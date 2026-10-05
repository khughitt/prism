---
id: prism-be5abe
title: "Noise placement in the rack: a select, then drag between legal sites, through the niri sink"
status: todo
priority: 2
size: m
complexity: mid
created: 2026-10-05T01:45:48Z
updated: 2026-10-05T01:46:02Z
depends: [prism-eef38f, material-cf32e5]
parent: prism-a03862
tags: [ui, noctalia, material, bus]
agent: claude-code/claude-fable-5-1
---

Prism side of the first movable device. One flat key, glass.noiseSite (backdrop | glass | film), layered, profiled, and reset like any scalar. The niri sink emits it as the noise node's site attribute. The rack draws the noise card at its site in chain order and explains what changed: at the backdrop site the card has one amount and says why (per-output scope, from the schema); at film it says the grain lands over the ring and glint, glass only.

Expose placement through a select first, then drag: both write the same key. Drag uses Noctalia dragSource/dropZone with only the sites the schema allows for noise lit, and keeps a keyboard-accessible equivalent (the select). Arbitrary permutations are out of scope; prism-542904 stays shelved until a second device moves.

Depends on the schema design (prism-eef38f) for the legal sites and on the renderer work (material noise placement task) for the attribute to exist.
