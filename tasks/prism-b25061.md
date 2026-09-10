---
id: prism-b25061
title: "Undo in the Prism panel: a general mechanism, not a per-gesture guard"
status: idea
priority: 2
created: 2026-09-10T10:13:16Z
updated: 2026-09-10T10:13:16Z
depends: []
tags: [ui, noctalia, store]
---

Every write in the panel lands immediately and there is no way back. That was acceptable while a gesture touched one key; prism-91edc5 adds neutral and symmetric writes that touch every parameter in a section or in the whole panel with no confirmation, which was a deliberate choice (the fast explore loop is the point) on the understanding that undo would be solved once, generally, rather than as a question row bolted to the destructive gestures.

Design questions: where the history lives (the store, so the CLI can undo too, or the panel session); whether a unit of undo is one command or one gesture, given a batched 'prism reset' is already one command and a live drag is many; how it interacts with the layer the write landed in and with a write target that has since moved; whether redo is worth it; and how it surfaces in a panel that has no keyboard vocabulary yet (prism-84d308).

Requested during the prism-91edc5 design session on 2026-09-10, when asked whether a neutral write should ask for confirmation first.
