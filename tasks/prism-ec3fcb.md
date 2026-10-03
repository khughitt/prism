---
id: prism-ec3fcb
title: Show the source swatch and lock beside the color source select
status: todo
priority: 3
size: s
complexity: mid
created: 2026-10-03T11:48:36Z
updated: 2026-10-03T11:48:37Z
depends: []
parent: prism-980a29
tags: [ui]
---

Owner suggestion at acceptance of prism-b4d118 (2026-10-03): instead of a separate read-only Color/Tint row behind a lock, draw the reported swatch and lock next to the Color source / Tint source select, and show the picker row only under manual. Ring: Color source + Color fold into one row. Tint: the two tint keys report the same palette tint, so one swatch suffices beside Tint source; under manual the focused/unfocused Tint matrix row returns. Needs a ui key naming the select a gated color attaches to (or derive it from ui.when.param).

## Notes

- 2026-10-03T11:48:36Z (main): concerns: prism-b4d118 change — owner prefers the read-only swatch inline with its source select
