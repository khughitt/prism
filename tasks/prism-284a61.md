---
id: prism-284a61
title: "Panel dice button: randomize all parameters or a subsection"
status: idea
priority: 2
created: 2026-09-09T13:43:07Z
updated: 2026-10-10T12:56:56Z
depends: []
parent: prism-179840
tags: [ui, noctalia]
---

Add a small dice icon near the top-right of the Prism panel. Clicking it randomizes all parameters. Also explore scoped randomization for subsections such as Glass, Focused, and Unfocused. Scope eligible parameter types, valid ranges/choices, and how the action respects the current write target before implementation. Related: prism-84d308 includes randomization in the shared keyboard vocabulary; this idea adds a visible panel control and section options. Requested during rack UI desktop review on 2026-09-09.

## Notes

- 2026-09-11T23:39:09Z (main): The dice button doubles as the random-modulation data collector for the adaptive-glass dataset (prism-3e59b5): each roll plus the user's follow-up nudge or rating is a labelled sample.
- 2026-09-29T22:43:31Z (main): scope: briefed; parented under prism-179840; prism-6aca8a settles eligible values, action scope, scratch writes, and recovery while coordinating keyboard randomization with prism-84d308; brief: docs/notes/2026-09-29-look-exploration-brief.md
- 2026-10-10T12:56:56Z (prism-84d308): prism-84d308 lands the whole-panel half: a title-row dice button and the r key roll every available visible slider to a random snapped in-range value, one prism set per slider through the queue (51 sliders on the shipped defs, so the desktop steps through each write). The subsection half and a one-command roll belong together: prism reset random [--group G] beside revert/symmetric/neutral, one lock, one resolve, one fan-out; per-section dice then sit with the per-section reset buttons. Needs a reset-mode value in ops cli.toml landed first, then vendored adopt.
