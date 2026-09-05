---
id: prism-c0cd4a
title: "Drag-mode hints: drop the repeated 'On release' row marker"
status: done
priority: 2
size: xs
owner: feat/prism-7e1c66
created: 2026-09-05T21:35:07Z
updated: 2026-09-05T22:00:16Z
depends: []
parent: prism-7e1c66
tags: [noctalia, ui]
---

Nearly every row is marked 'On release', which adds a line of clutter per row and says nothing distinguishing. Drop the per-row marker; if the distinction is worth surfacing, note it once (section or panel level) and mark only the rows that behave differently. Keep the per-row 'Unavailable' marker, which is genuinely exceptional. Update docs/notes/noctalia-plugin-contract.md, which currently promises the per-row marking.

## Notes

- 2026-09-05T22:00:16Z (feat/prism-7e1c66): Per-row 'On release' dropped; only Live and Unavailable are marked, and the contract note now says so
