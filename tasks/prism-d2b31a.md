---
id: prism-d2b31a
title: "Focus as modulation: collapse glass.inactive.* into glass.* plus a per-device focus depth"
status: idea
priority: 2
created: 2026-09-09T03:03:30Z
updated: 2026-09-09T03:03:30Z
depends: []
parent: prism-a03862
tags: [defs, material, store]
---

Treat focus as a 0/1 modulation source with a per-device depth instead of a duplicated matrix. Answers prism-7e4766 (unset inactive follows focused) structurally. Pairs with material-5a5fff, the niri-material idea of interpolating parameters across the focus swap, since a per-device mix is the natural vehicle for that blend.
