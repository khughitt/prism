---
id: prism-a03862
title: "Device chain: frame the glass bus as an ordered rack of effects with a mix per device"
status: idea
priority: 2
created: 2026-09-09T00:48:50Z
updated: 2026-09-09T00:48:50Z
depends: []
tags: [ui, material, noctalia, bus]
---

Reframe the parameter bus and its panel as a device chain, after the insert chains in DAWs and VST racks (eq, filter, reverb, saturation, compression, ...). Today the bus is a flat key/value map and the panel is a Focus matrix of one row per optic; the shader in niri-material already applies those optics in a fixed sequence, but nothing in prism names that sequence.

## Framings

- Serial insert chain: an ordered list of devices, each a bundle of parameters plus a mix (wet/dry) and a bypass. The material's real pass order (backdrop blur, refraction and depth, tint, fringing, distortion, directional blur, noise, saturation) becomes explicit data instead of a group order number.
- Mixer with sends: some things sum rather than chain. Stacking several noises (white plus fine, each with a gain) is parallel sources onto a noise bus with one mix into the material, not a serial step.
- Nested racks (Ableton racks, Bitwig FX layers): a chain node is a device or a list of parallel chains with a mixer. Recursive and general; probably more than a dozen optics need.
- Layer stack (Photoshop): each device is a layer with opacity and a blend. Same combinator as wet/dry, more familiar vocabulary, and order is visually the stack.
- Coating stack (physical): layers of glass and coatings where order is physically meaningful. Grounds why sequence matters; less flexible.

## Benefits

- Stack several noises and other generators instead of one noiseType select.
- One mix knob visible on every device; the rest of a device's parameters expandable.
- Colored lights per device category (generator, optic, post) as the visual grouping; a bypass light doubles as an on/off.
- Per-device cost meters, DAW-style, once prism-d54be4 (per-parameter GPU cost) exists.

## Functional programming ideas

- A device is Frame -> Frame; a chain is composition (a fold). Mix is the generic combinator lerp(identity, device, mix), which makes wet/dry free for every device and bypass just mix 0.
- Parallel stacking is a weighted sum (a monoid over sources); a mixer is a fold with gains.
- The layer system (defaults, base, wallpaper, profile) is a right-biased map merge over flat keys. A chain makes a value structured: an ordered list. The merge must decide whether a layer replaces the whole chain or patches devices by id. This is the real design question and it decides whether profiles can say "just bump the noise mix".
- Describe, then interpret: the bus stays data, each sink compiles it. The niri sink lowers a chain to the fixed material fields it has today; a later shader sink could honour arbitrary order.
- Modulation (Bitwig modulators, DAW macros): focus is a 0/1 modulation source with a per-parameter depth. Modelled that way, glass.inactive.* collapses into glass.* plus a focus depth per device, which also answers prism-7e4766 (unset inactive follows focused).

## Constraints and open questions

- The executor is niri-material's shader: arbitrary order or N noise layers needs shader work there (uniform arrays or baked noise textures). Prism can model the chain now and compile it down; only the model and the panel are prism's.
- Noctalia's declarative vocabulary has no knob or canvas (prism-686374), so a rack is rows of slider, toggle, glyph, and label. It does have dragSource and dropZone, so reordering devices by drag may be possible.
- Honest first slice: presentational. Render the Focus matrix as a rack in the shader's real pass order, one device per row with a mix and a bypass, colored by category. No new bus semantics. Second slice: noise as the first true multi-instance device, which forces the chain-merge decision above.

Related: prism-686374 (VST panel), prism-7e4766 (inactive follows focused), prism-d54be4 (GPU cost per parameter).
