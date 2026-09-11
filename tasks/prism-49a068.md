---
id: prism-49a068
title: "Present the base layer as the default profile, with a visible reset to the shipped defaults"
status: idea
priority: 2
created: 2026-09-11T01:13:09Z
updated: 2026-09-11T01:15:26Z
depends: []
tags: [quick-add, profiles, ui, noctalia]
source: "mindful:thought:1e2513d2f5ea48609022559f3c687d01"
---

Wish: let the user tune and save the default profile, the one shown as '-' in the selector (name candidates: 'Default', 'INIT'), and give it a way back to the shipped defaults.

Known: the mechanism already exists. With no profile loaded the write target is base (prism-fc8491: profile, else pinned wallpaper, else base), so edits under '-' persist as the default look; 'Reset everything' runs prism reset defaults (prism-91edc5); the dash option itself is prism-77eb95. Suspected gap: discoverability only. Nothing names the slot as the default, and under an unpinned wallpaper the rows that wallpaper overrides are shadowed, so tuning base there has no visible effect and can feel like the edit was lost.

Conflicts: wallpaper autosave (prism, this seed) makes the wallpaper layer capture edits automatically, which changes when base is reachable at all; prism-ad2b12 (one reset per level) may change what 'reset to shipped defaults' means. Decide after those settle.

Revisit 2026-11-10: is the gap naming and discoverability, or did tuning under '-' fail to persist? Scope then.

## Notes

- 2026-09-11T01:15:26Z (main): Revisit date lives in prose until tasks-be6fcc (one-shot defer date in tasks) lands; move it onto the field then.
