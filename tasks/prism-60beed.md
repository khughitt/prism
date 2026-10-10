---
id: prism-60beed
title: "Section dice: roll Glass, Focus, and Ring separately"
status: todo
priority: 2
size: s
complexity: mid
process: direct
created: 2026-10-10T16:18:11Z
updated: 2026-10-10T16:18:12Z
depends: []
tags: [ui, noctalia]
agent: claude-code/claude-opus-5-5
---

Beside the title-row dice (whole panel), give each section header a dice button that rolls only that section's sliders: Glass, Focus (the rack), and Ring. Put it with the section's reset buttons (sectionHeader / resetModeButtons), with a tooltip naming the section. Reuse the panel-side roll (rollDice scoped by ui.group) and the same rules as the whole-panel roll, including prism-d2ba46 and the enable-on-roll task.

Folded from prism-284a61. A one-command CLI roll, prism reset random [--group G] beside revert/symmetric/neutral (one lock, one resolve, one fan-out instead of one prism set per slider), would serve both the title and the section dice; it needs a reset-mode value in ops cli.toml landed first, then vendored adopt. Take it if the per-slider writes are too slow or too visible in use.

## Notes

- 2026-10-10T16:18:11Z (main): concerns: prism-84d308 extension — section-scoped dice beside the whole-panel one
