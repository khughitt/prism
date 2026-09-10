---
id: prism-b8e44c
title: "Panel matrix: unfocused column on the left, focused on the right"
status: done
priority: 2
size: s
owner: main
created: 2026-09-10T17:00:50Z
updated: 2026-09-10T23:16:18Z
depends: []
tags: [noctalia, ui]
---

Swap the matrix column order in the presentation module: the header labels, matrixRow cells, and the rack cards all place unfocused left and focused right. Update the plugin tests that assert the order, the contract note's presentation section, and the README sentence describing the Focus matrix.

## Notes

- 2026-09-10T23:16:18Z (main): Matrix columns now read unfocused left, focused right across the header labels, matrix rows, and rack mix cells; the order is pinned in the Lua and Node tests, and the contract note and README state it.
