---
id: prism-de6e54
title: Expose the ring beam's head wander in the Ring group
status: todo
priority: 2
size: s
complexity: low
process: direct
created: 2026-09-22T15:57:03Z
updated: 2026-09-22T15:57:03Z
depends: []
tags: [defs, niri, material]
agent: claude-code/claude-opus-5
---

The Prism half of material-9704b0. niri gained two response keys on the ring beam: `ring-beam-noise` (0-1, default 0) is how far the comet head's brightness wanders either side of its envelope, and `ring-beam-noise-hz` (0-30, default 3) is how fast. Both default to a steady head, so an unset value is the appearance that ships today.

Expose them in the Ring group beside `beamSpeed`/`gap`/`glow`:
- `defs/glass.yaml`: `glass.ring.beamNoise` (float 0-1) and `glass.ring.beamNoiseHz` (float 0-30), ordered after `glass.ring.beamSpeed` (530) and before `glass.ring.gap`.
- `integrations/niri/render.js` `responseBlock`: emit `ring-beam-noise` and `ring-beam-noise-hz`.
- Tests: the `NATIVE` list in `test/glass-defs.test.js` (they are native keys, not Prism-only like `colorSource`), the Ring row list in `test/plugin-presentation.test.js`, the render fixtures and their emitted-kdl assertions in `test/niri-render.test.js`, and the apply fixture in `test/niri-apply.test.js`.

Rollout order, as for every new response key: the niri carrying them must be installed before `prism apply` writes a config naming them, or niri rejects the config. Land this after the material-9704b0 build is installed, and do not apply live before then.
