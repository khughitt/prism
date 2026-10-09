---
id: prism-9bbe0a
title: Accent tint applied differently to focused and unfocused windows
status: todo
priority: 2
size: s
complexity: mid
process: direct
created: 2026-10-04T22:53:19Z
updated: 2026-10-09T04:34:56Z
depends: []
tags: [quick-add, material, ui]
source: "mindful:thought:5e9de9353af5dbf03f972cf438788af5"
agent: claude-code/claude-opus-5-5
---

Why: under the Noctalia tint source, the focused and unfocused glass take one tint: sourceColors (integrations/niri/render.js) mixes the palette primary into the surface by glass.tintAccentMix and writes that same color to glass.attenuationColor and glass.inactive.attenuationColor. Every other Focus-group optic has a glass.inactive.* twin, so the palette accent cannot read stronger on the focused window than on the rest.

Source thought (verbatim): "allow tint palette accent to be differentially applied to focused / unfocused". Read as the Noctalia "Palette accent mix" (glass.tintAccentMix), the control that sits in the Tint row. The other reading, niri's per-window accent-tint response weight, belongs to prism-1bb833.

Done when:
- defs/glass.yaml gains glass.inactive.tintAccentMix (float 0-1, default 0.1, neutral 0), and the pair shares a "Palette accent mix" row with state focused/unfocused. It keeps the when: {param: glass.tintSource, in: [noctalia], otherwise: hidden} rule.
- sourceColors mixes each state with its own weight; the unsplit material keeps using the focused one.
- manifest.yaml binds the new key (liveness reload). The rack's tint device moves the pair from shared to a Palette accent mix row (defs/rack/devices.yaml).
- The starter profiles that set glass.tintAccentMix (resources/profiles/Aurora.yaml, Rainbow.yaml) set the twin to the same value, unless prism-7e4766 (unset twins follow their focused value) has landed by then.
- Tests: niri-render (distinct weights give distinct tints only under split), glass-defs, rack, plugin-presentation, starter-profiles; just test-fast green.

Where to look: integrations/niri/render.js sourceColors/glassFor; defs/glass.yaml tint block; defs/rack/devices.yaml tint device; test/niri-render.test.js, test/rack.test.js, test/plugin-presentation.test.js. Related: prism-7e4766, prism-2bfc35 (ui.when on matrix rows), prism-1bb833.

## Notes

- 2026-10-09T04:34:55Z (main): scope: scoped; read the thought as the Noctalia palette accent mix, rewrote the body with a glass.inactive.tintAccentMix twin, render/rack/profile sites and checks; set todo P2 s mid direct; niri accent-tint reading left to prism-1bb833
