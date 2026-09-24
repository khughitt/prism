---
id: prism-6d1d72
title: Glass master toggle must survive wallpaper rotation
status: todo
priority: 2
size: s
complexity: mid
process: planned
created: 2026-09-24T03:08:54Z
updated: 2026-09-24T03:08:54Z
depends: []
tags: [noctalia, wallpaper, performance]
agent: claude-code/claude-opus-5-5
---

The Noctalia panel's top-right Glass toggle (panel.luau:1007-1013, Presentation.titleParam = glass.enabled) issues a plain 'prism set glass.enabled false', which lands in scratch. Noctalia's wallpaper_changed hook runs 'prism context wallpaper', and changeSlots (context-cli.js:63-87) saves scratch onto the outgoing wallpaper's pair, clears scratch, and re-resolves for the new wallpaper, so glass.enabled returns to true on every rotation (wali rotations go through the same hook). Two defects: the off switch cannot hold across rotations, and turning it off permanently writes glass.enabled: false into whichever wallpaper pair was showing.

Why it matters: niri-material's quiet-host captures (material-4241c3, material-cd0e1d) need the desktop compositor to stop drawing glass on terminals for the whole run, and the only UI switch undoes itself.

Design question: where the master switch lives. Candidates: the reserved 'state' layer above wallpaper (src/contexts.js:11-20, see prism-2f0b4b), or a session-level override excluded from the save-to-pair step. It must not be saved into a wallpaper pair. Workaround until then: 'prism set --base glass.enabled false', which holds unless the profile or a pair sets glass.enabled itself.
