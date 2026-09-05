---
id: prism-ed35d4
title: Accent-colored icon buttons need a Noctalia contribution
status: idea
priority: 2
created: 2026-09-05T22:29:35Z
updated: 2026-09-05T22:29:35Z
depends: []
tags: [noctalia, ui]
---

The panel's reset icons carry their state in opacity (dim at default, full strength when modified) because Noctalia's ui.button exposes no color prop: variant picks from fixed palettes, and only Primary/selected produce an accent, both as a fill rather than a colored glyph. ui.glyph does take a color, but a box+glyph composite loses the tooltip, which only button and dragSource support. A colored-glyph icon button therefore needs an upstream change - a color prop on button, or tooltip support on box - in the Noctalia checkouts under software/noctalia. Same class of blocker as prism-686374 (knobs need a contribution to Noctalia itself).
