---
id: prism-d299f0
title: Show the current color next to or inside the tint button
status: done
priority: 2
size: s
owner: main
created: 2026-09-06T00:32:53Z
updated: 2026-09-10T23:26:56Z
depends: []
tags: [noctalia, ui]
---

The Tint control opens a color picker but the panel does not show the chosen color. Show a swatch next to or inside the button. Check what the Noctalia plugin API 22 color control renders today; if a swatch needs a Noctalia contribution this belongs with prism-ed35d4.

## Notes

- 2026-09-06T09:26:09Z (main): Scoped by prism-46ad16 (checked against v5.0.1 source and upstream docs): NO Noctalia contribution needed. ui.box takes fill/radius/border/borderWidth/width/height and fill accepts #rrggbb or #rrggbbaa, so render a swatch box beside the Tint button. A swatch INSIDE the button is not expressible (button has no fill/color), so 'next to' is the design. A tooltip on the swatch would need the container-tooltip proposal; not required.
- 2026-09-10T23:26:56Z (main): Color cells now show a bordered swatch of the current value in the reserved value column, left of the palette button; no Noctalia contribution needed, and the contract note records it.
