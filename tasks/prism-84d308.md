---
id: prism-84d308
title: "Prism panel: key capture for the shared vocabulary and prism-specific keys"
status: idea
priority: 2
created: 2026-09-09T02:28:45Z
updated: 2026-09-09T02:47:54Z
depends: []
tags: [quick-add, noctalia, keyboard, cross-project]
source: "mindful:thought:1784d44106a5411bb28a90796f46acf4"
---

Implement the shared vocabulary (navigation, copy, random, save) in integrations/noctalia-plugin via capture_keys and onKey, then design prism-specific keys: profile save/load (prism-ea6344 added named profiles), parameter focus and nudging, section jumps. Scope after the ops goal settles the vocabulary.

## Accepted suggestions

- Digits 1-9 load named profiles; s saves the current one; ? overlays the bindings.
- Set keyboard_focus = "exclusive" so keys work on open. Escape already dismisses.
- Beyond the shared set, consider j/k to move parameter focus and h/l to nudge the focused slider.
