---
id: prism-6aca8a
title: Design look exploration and feedback capture from the brief
status: todo
priority: 2
size: m
complexity: high
process: planned
created: 2026-09-29T22:42:24Z
updated: 2026-09-29T22:42:24Z
depends: []
parent: prism-179840
tags: [profiles, ui]
source: docs/notes/2026-09-29-look-exploration-brief.md
agent: codex
---

Why: Randomization, implicit nudges, and explicit ratings need one definition of what was displayed and what the user evaluated. Current scratch values can be carried across wallpaper rotations; they are not a log of user preference.

Where to start: docs/notes/2026-09-29-look-exploration-brief.md; src/cli.js (set/describe), src/carry.js, integrations/noctalia-plugin/queue.luau and panel.luau, defs/glass.yaml, and integrations/niri/palette.js. Coordinate with prism-84d308 for keyboard randomization and prism-092855 for profile-selection semantics.

Bound: Produce a reviewed design for the smallest useful local capture and randomization loop. Settle eligible parameters and sampling, group/focus scope, single-action writes to scratch, and a recovery choice without duplicating prism-b25061's general undo. Define explicit-rating snapshots versus implicit gesture records, wallpaper/look/palette identity, treatment of CLI writes and automatic transitions, sink failures, and where records live. Check the current wali ownership/API before assigning image-property work; preserve the broader source ideas if precomputation or automatic nudge capture is deferred. No learner, GPU sweep, or bulk image processing in this task.

Done: A reviewed spec and implementation plan with acceptance cases for a roll, a completed drag, a rating after queued writes, wallpaper rotation during an action, and an apply failure. Captured data must distinguish user intent from carried values and requested parameters from successfully applied appearance. Begin with explicit snapshots plus bounded rolls as the recommended first increment; decide whether gesture capture is needed immediately. Cost estimates and interaction models remain with their existing material tasks.

Ideas it wakes: On completion, run tasks note on prism-284a61, prism-3e59b5, and prism-cafffa with the decisions and resulting implementation boundaries, in the same commit as this result; update the brief.
