---
id: prism-85f63a
title: "Stacked noise: several grain generators with their own gain, type, and scale"
status: todo
priority: 2
size: l
complexity: high
process: planned
created: 2026-09-09T03:03:30Z
updated: 2026-10-14T13:59:43Z
depends: [material-3fcba2]
parent: prism-a03862
tags: [material, bus, noctalia]
---

Prism side of stacked noise: the first device that can exist more than once, which forces the chain-merge decision. Does a layer (defaults, base, wallpaper, profile) replace the whole device list or patch devices by id, and how does a multi-instance device live on a flat scalar bus? Needs its own brainstorm and spec before prism work starts.

## Established (re-scope 2026-10-14)

The niri-material piece, filed here as "known work that can start now", landed as `material-3fcba2` (done 2026-10-08). Design: niri-material `docs/specs/2026-10-06-noise-layers-design.md`; evidence and costs: `docs/materials/2026-10-06-noise-layers-evidence.md`.

- A material may write the glass `noise` node up to four times. Each node is one layer with its own amount, `type=`, `site=` and a new `scale=` (grain cell size, 1-16 px; B-spline lattice above scale 1, after the owner's look on 2026-10-08).
- Per-slot seeds keep layers distinct. Layers at one site apply in config order. Slots follow the four-slot packed vec4 precedent of `mat_sig_impulse_*`, unrolled in GLSL ES 1.00. Fine grain costs nine hashes per layer.
- A config with at most one `noise` node and no `scale=` renders byte-identical to before. Shipped KDL keeps one node until prism writes more.
- `pipeline.json` gained only the noise `scale=` parameter and no multiplicity field. Prism vendored it at `fc129ec`.

## Remaining: the design, then the build

- Bus shape for up to four layers beside today's single-layer keys: `glass.noise`, `glass.inactive.noise`, `glass.noiseType` (shared across focus states), `glass.bypass.noise`, and `glass.noiseSite` from `prism-be5abe`. This design extends that key per layer rather than replacing it.
- The chain-merge rule across context layers, so a profile can say "just bump the noise mix".
- Whether `pipeline.json` needs a repeat field (a schema version bump, coordinated with niri-material) or prism declares multiplicity in `defs/rack/devices.yaml`.
- Rack presentation of several noise cards, each at its own site, and the niri sink emitting up to four `noise` nodes.
- Whether a single-layer `glass.noiseScale` should ship first, independent of multiplicity.

Done: a reviewed spec and plan, then layers configurable end to end from a profile to the KDL, with the one-node identity preserved.

Where to look: `docs/specs/2026-09-08-device-chain-rack-design.md`, `docs/specs/2026-10-04-pipeline-schema-design.md`, `src/rack.js`, `src/resolve.js`, `integrations/niri/render.js`, `integrations/niri/manifest.yaml`, the noise keys in `defs/glass.yaml`.

## Notes

- 2026-10-06T10:02:02Z (main): material-3fcba2's accepted design (niri-material docs/specs/2026-10-06-noise-layers-design.md): the renderer accepts up to four glass noise nodes, each with amount, type=, site= and a new scale= (grain cell size, 1-16 px); pipeline.json gains only the noise scale= parameter and carries no multiplicity field, so how the bus and rack represent layers (and whether the schema needs a repeat field, which bumps its version) is this goal's brainstorm. Shipped KDL keeps one node.
