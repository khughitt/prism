---
id: prism-ddeb30
title: Add a toggle to expand or collapse all panel sections
status: todo
priority: 2
size: s
complexity: low
process: direct
created: 2026-10-11T17:56:38Z
updated: 2026-10-14T11:02:56Z
depends: []
parent: prism-67b1b2
tags: [noctalia, ui]
source: "mindful:thought:148b2a7e0eadeb97539e393871c9e4b6"
agent: codex
---

Why: the rack's ten device cards each open by their own chevron or name, so seeing every card's details takes ten clicks, and closing them again ten more. Original capture: "add toggle to expand/collage all sections" (read "collage" as "collapse").

Reading: "sections" are the rack's device cards, the only collapsible units in the panel (state.expanded, keyed by device). Parameter sections (Focus, Ring, …) have no collapse; making them collapsible is new scope, not this task.

Done when:
- The rack's section header (appendRack -> sectionHeader in integrations/noctalia-plugin/panel.luau) carries one ghost sm button: glyph chevrons-down with tooltip "Show every card's details" while any card is collapsed, which expands all; chevrons-up with "Hide every card's details" when all are expanded, which collapses all. Individual chevrons keep working and share state.expanded.
- plugin_test.lua covers expand-all, collapse-all, and the mixed state (one card open → the button expands the rest), beside the existing chevron tests (~L650).
- docs/notes/noctalia-plugin-contract.md describes the control.
- Render cost with every card expanded stays inside the 25 ms callback budget (13–14 ms measured in prism-831604); re-measure the expanded render as prism-dac509 does.

Related: the dice rolls only drawn sliders once prism-d2ba46 lands, so expand-all widens what it rolls. Handoff: docs/notes/2026-10-14-panel-ergonomics-brief.md.

## Notes

- 2026-10-11T17:56:57Z (main): concerns: prism-3ea2a0 extension — Add one control to expand or collapse all sections beyond the existing individual card expanders.
