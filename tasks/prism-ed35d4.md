---
id: prism-ed35d4
title: Accent-colored icon buttons need a Noctalia contribution
status: idea
priority: 2
created: 2026-09-05T22:29:35Z
updated: 2026-09-06T09:49:57Z
depends: []
tags: [noctalia, ui]
---

The panel's reset icons carry their state in opacity (dim at default, full strength when modified) because Noctalia's ui.button exposes no color prop: variant picks from fixed palettes, and only Primary/selected produce an accent, both as a fill rather than a colored glyph. ui.glyph does take a color, but a box+glyph composite loses the tooltip, which only button and dragSource support. A colored-glyph icon button therefore needs an upstream change - a color prop on button, or tooltip support on box - in the Noctalia checkouts under software/noctalia. Same class of blocker as prism-686374 (knobs need a contribution to Noctalia itself).

## Notes

- 2026-09-06T09:26:09Z (main): Scoped by prism-46ad16: this is the one panel want that needs a shell change. Proposal written at software/noctalia docs/superpowers/specs/2026-09-06-plugin-ui-button-color-and-container-tooltip.md (uncommitted in the fork): A) a color prop on ui.button applied after variant via Button::setCustomPalette, normal-state label/glyph only; B) tooltip on ui.box/row/column/image via the existing InputArea wrapper. Either unblocks this; file A first. Installed shell is v5.0.1 (API 30); prism declares API 22.
- 2026-09-06T09:40:45Z (main): Spec revised after review (API registration advances kCurrentPluginApiVersion per feature; unconditional palette rule via Button::defaultPalette(variant()) + withLabelColor; disabled keeps the custom color with alpha multiplied by 0.55; tooltip routed through wantsInputAreaWrapper with a non-empty predicate; acceptance criteria added). Now lives in the noctalia checkout's worktree .worktrees/plugin-ui-color-tooltip (branch feat/plugin-ui-color-tooltip off main 224da6dd4), untracked there because that checkout's .git/info/exclude ignores docs/superpowers/.
- 2026-09-06T09:49:57Z (main): Implementation plan written (8 tasks, TDD, two API levels 31 button-color and 32 container-tooltip): noctalia worktree .worktrees/plugin-ui-color-tooltip docs/superpowers/plans/2026-09-06-plugin-ui-button-color-and-container-tooltip.md, untracked there like the spec.
