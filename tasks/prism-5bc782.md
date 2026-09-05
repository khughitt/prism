---
id: prism-5bc782
title: Emit zero terminal background opacity and focus-conditioned glass materials
status: done
priority: 2
size: m
owner: feat/focus-glass
created: 2026-09-05T01:10:50Z
updated: 2026-09-05T02:07:25Z
depends: [material-cb348e]
tags: [integration, terminal, niri]
---

Make Prism the single owner of the terminal/glass seam. Kitty sink: background_opacity 0 (active and inactive), with transparent_background_colors handling for the neovim-registered glass colors. Niri sink: emit two materials (terminal-glass-active, terminal-glass-inactive) and is-focused conditioned window-rules selecting them, replacing the opacity window-rules. Resolved params: retire or default terminal.background.opacity.* and terminal.window.opacity.* once the glass owns focus state, and decide what focus-opacity.py (kitty watcher) still does. Ghostty parity is tracked in prism-82198e. Blocked on the native side accepting focus-conditioned swaps (material piece under ops goal ops-500adb).

## Notes

- 2026-09-05T02:07:25Z (feat/focus-glass): Implemented on feat/focus-glass: opacity defaults 0/0, glass.focusSplit plus four glass.inactive.* overrides, niri sink renders terminal-glass and terminal-glass-inactive with is-active assignment rules. 147 tests pass; fragment rendered from live values validates in the real config on niri 663202b1.
- 2026-09-05T02:07:25Z (feat/focus-glass): Prism emits zero terminal background opacity by default and, with glass.focusSplit, an is-active pair of materials; kitty watcher and neovim follow in dot-a00088
