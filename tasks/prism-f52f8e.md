---
id: prism-f52f8e
title: Design panel undo from the brief
status: todo
priority: 2
size: m
complexity: high
process: planned
created: 2026-10-14T11:02:10Z
updated: 2026-10-14T11:02:10Z
depends: []
parent: prism-67b1b2
tags: [noctalia, ui, store]
source: docs/notes/2026-10-14-panel-ergonomics-brief.md
agent: claude-code
---

Why: every panel write lands immediately; prism-91edc5's neutral and symmetric resets and the dice (roll every slider) change whole sections or the whole panel with no confirmation, on the understanding that undo is solved once, generally (prism-b25061).

Settle, in a design spec under docs/specs/: where history lives (a store-side journal the CLI can also undo, or panel-session memory); the unit of undo (one command or one gesture: a batched 'prism reset' is one command, while a drag samples many 'prism set's and the dice enqueues one 'set' per slider); whether undo covers only scratch edits or also commits, profile deletes, renames and pair clears (today guarded by --expect-look/--expect-wallpaper and the confirm row); behaviour when the layer or wallpaper pair the write targeted has since moved (rotation rewrites scratch, docs/specs/2026-09-27-rotation-keeps-edits-design.md); redo; and the key and button (the keyboard vocabulary from prism-84d308 now exists; ctrl+z is unbound). Reconcile with prism-6aca8a's gesture records so one write log serves both if that holds.

Start: docs/notes/2026-10-14-panel-ergonomics-brief.md; src/scratch.js, src/reset.js, src/commit.js; integrations/noctalia-plugin/queue.luau (argvFor) and panel.luau (writeParam, rollDice, editsRow).

Ideas it wakes: on completion, run `tasks note prism-b25061 --no-reviewed "<design outcome>"` before this result's branch merges.
