---
id: prism-23df96
title: "Reset control: always-present borderless icon with dim/active states"
status: done
priority: 2
size: s
owner: feat/prism-7e1c66
created: 2026-09-05T21:35:07Z
updated: 2026-09-05T22:00:16Z
depends: []
parent: prism-7e1c66
tags: [noctalia, ui]
---

Replace the rounded-square 'Reset to default' button with a small borderless glyph button that is always in the tree, so the row never reflows. Two visual states carry the status: dim/inert when the parameter already holds its default, primary when it is modified and a click resets it. Noctalia's Button enables its InputArea only when a handler is attached and 'enabled' is true, so the dim state must stay enabled with a no-op click to keep its tooltip. Applies to the per-parameter reset and the per-section reset (also currently visibility-toggled).

## Notes

- 2026-09-05T22:00:16Z (feat/prism-7e1c66): Reset is now a borderless ghost glyph that is always in the tree, dim at default and full strength when modified; the section reset matches
