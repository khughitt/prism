---
id: prism-84d308
title: "Prism panel keys from the shared vocabulary: ctrl+s, j/k focus, h/l nudge, r random, 1-9 profiles, ? help"
status: doing
priority: 2
size: l
complexity: mid
process: direct
owner: main
created: 2026-09-09T02:28:45Z
updated: 2026-09-16T14:24:55Z
started: 2026-09-16T14:24:55Z
depends: []
tags: [quick-add, noctalia, keyboard, cross-project]
source: "mindful:thought:1784d44106a5411bb28a90796f46acf4"
---

Implement the shared vocabulary (navigation, copy, random, save) in integrations/noctalia-plugin via capture_keys and onKey, then design prism-specific keys: profile save/load (prism-ea6344 added named profiles), parameter focus and nudging, section jumps. Scope after the ops goal settles the vocabulary.

## Accepted suggestions

- Digits 1-9 load named profiles; s saves the current one; ? overlays the bindings.
- Set keyboard_focus = "exclusive" so keys work on open. Escape already dismisses.
- Beyond the shared set, consider j/k to move parameter focus and h/l to nudge the focused slider.

## Notes

- 2026-09-16T09:36:27Z (main): Rescoped 2026-09-16 to the ops plan docs/plans/2026-09-16-key-vocabulary.md Task 5 (spec docs/specs/2026-09-15-key-vocabulary-design.md in ops). First step is the live ctrl+s check; blocked until ops keys.toml (Task 1) is on ops main.
