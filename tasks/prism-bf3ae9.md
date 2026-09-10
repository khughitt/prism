---
id: prism-bf3ae9
title: Decide what panel-wide restore does under a loaded profile or a pinned wallpaper
status: todo
priority: 2
size: s
created: 2026-09-10T17:00:50Z
updated: 2026-09-10T17:01:16Z
depends: []
parent: prism-2f0b4b
tags: [ui, profiles, noctalia]
---

Neutral was settled 2026-09-10: clear the profile first. Restore still writes into the target, so Reset everything under a loaded profile unsets every key from its snapshot and the profile stops reproducing its look, though a profile is meant to be a full snapshot. Either restore clears the profile the same way, or emptying it is intended and the contract note says so. Same question for a pinned wallpaper. May be moot if prism-ad2b12 (one reset per level that loads the neutral look) lands; decide the two together.
