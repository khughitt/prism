---
id: prism-ea6344
title: "Named profiles: save, load, and manage from the Noctalia panel"
status: todo
priority: 2
size: m
created: 2026-09-05T18:50:37Z
updated: 2026-09-05T22:56:36Z
depends: [prism-6fd864, prism-fcacfb]
parent: prism-2f0b4b
tags: [noctalia, ui, profiles]
---

Outcome: a user can capture the current glass values as a named profile from the panel (a save button that opens a name field), then later select it to reapply, and rename or delete it. A named profile is a store context activated by hand; loading it makes it the active context so further slider edits are written into it, and a clear action returns to the base values. The panel needs a profile section: a select of saved profiles with the active one marked, save and delete buttons, and the name input. Verify first that the installed Noctalia 5.0.1 plugin API exposes ui.input inside a panel, since prism-686374 recorded only slider, toggle, select, button, progress, graph, image, and markdown; the v5 docs list ui.input with onSubmit. If input is unavailable, fall back to naming through the CLI and offer only load and delete in the panel. Presentation and queue modules carry the layout and write-ordering contract, so the direct Lua tests must cover the new rows.
