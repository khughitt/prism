---
id: prism-d2ba46
title: "Panel keys: help-mode gating, roll only drawn sliders, no keys mid-drag"
status: todo
priority: 3
size: s
complexity: low
process: direct
created: 2026-10-10T13:01:26Z
updated: 2026-10-10T13:01:26Z
depends: []
tags: [noctalia, ui, keyboard]
agent: claude-code/claude-opus-5-5
---

Minor findings from the prism-84d308 implementation review, deferred out of its corrective round.

- While help is shown, r, 1-9 and ctrl+s still act (ctrl+s can submit a name field hidden behind the legend), and the help early return drops the error label. Let only the help keys through while state.help is true, or make any key close help; keep the error label in helpView.
- rollDice walks Presentation.visibleParams, which includes gated rows and the detail sliders of collapsed rack cards: invisible edits a following ctrl+s keeps. Roll the drawn, available sliders (state.focusOrder) instead, or decide hidden sliders roll and say so. Log/power-curved sliders roll uniformly in canonical units.
- ctrl+s, h/l and r act while a pointer drag is in flight (state.drag ~= nil), so ctrl+s can keep before endDrag enqueues the dragged value. Stand down while dragging.
- Tests: digits while selectionPending; keys while help is shown.
