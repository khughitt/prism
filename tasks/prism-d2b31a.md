---
id: prism-d2b31a
title: "Focus as modulation: collapse glass.inactive.* into glass.* plus a per-device focus depth"
status: shelved
priority: 2
created: 2026-09-09T03:03:30Z
updated: 2026-09-29T22:33:39Z
depends: []
parent: prism-a03862
tags: [defs, material, store]
---

Treat focus as a 0/1 modulation source with a per-device depth instead of a duplicated matrix. Answers prism-7e4766 (unset inactive follows focused) structurally. Pairs with material-5a5fff, the niri-material idea of interpolating parameters across the focus swap, since a per-device mix is the natural vehicle for that blend.

## Notes

- 2026-09-29T22:33:39Z (main): shelved: Wake when prism-7e4766 records the inheritance decision, or a concrete focus-modulation requirement establishes why separate keys are insufficient; review scalar, boolean, and color semantics before replacing the model.
- 2026-09-29T22:33:39Z (main): scope: shelved; retain separate focused/unfocused values while the narrower inheritance decision remains open; brief: docs/notes/2026-09-29-rack-evolution-brief.md
