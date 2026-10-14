---
id: prism-bf3ae9
title: Decide what panel-wide restore does under a loaded profile or a pinned wallpaper
status: todo
priority: 2
size: s
complexity: high
created: 2026-09-10T17:00:50Z
updated: 2026-10-14T14:29:21Z
depends: []
parent: prism-2f0b4b
tags: [ui, profiles, noctalia]
---

Neutral was settled 2026-09-10: clear the profile first. Restore still writes into the target, so Reset everything under a loaded profile unsets every key from its snapshot and the profile stops reproducing its look, though a profile is meant to be a full snapshot. Either restore clears the profile the same way, or emptying it is intended and the contract note says so. Same question for a pinned wallpaper. May be moot if prism-ad2b12 (one reset per level that loads the neutral look) lands; decide the two together.

## Notes

- 2026-09-11T01:13:09Z (main): Wallpaper autosave (prism-46035b) would remove the pin, so the pinned-wallpaper half of this question becomes 'under a wallpaper that captures edits'; decide together.
- 2026-10-14T14:29:21Z (main): scope: drop; settled and landed: docs/specs/2026-09-19-compositional-profiles-design.md Section 4 ('revert removes edits and the profile shows through, unchanged; a profile is never emptied by a reset') and its task table ('prism-bf3ae9: done by Section 4; close with the verdict'); implemented under prism-aec90f (done); the pinned-wallpaper half went with prism-46035b (dropped, pins removed); proposal: close with the Section 4 verdict
