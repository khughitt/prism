---
id: prism-7e1c66
title: "Panel rows: fix crowding, reflow, and dead affordances"
status: todo
priority: 2
size: l
created: 2026-09-05T21:34:51Z
updated: 2026-09-05T21:34:51Z
depends: []
tags: [noctalia, ui]
---

The Noctalia panel's parameter rows are crowded and ragged: sliders start and end at different x positions row to row, the per-row reset button appears and disappears with param.modified (so a row reflows mid-drag whenever the value crosses its default, and again on reset), the info buttons never show their tooltip, and every row repeats an 'On release' hint. Fix the row layout and its control affordances so a row's geometry is constant regardless of parameter state.
