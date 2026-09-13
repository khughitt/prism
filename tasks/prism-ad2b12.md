---
id: prism-ad2b12
title: One reset per level that loads the neutral look
status: idea
priority: 2
created: 2026-09-10T17:00:50Z
updated: 2026-09-13T11:09:26Z
depends: []
parent: prism-3415ef
tags: [ui, noctalia, defs]
---

Proposal 2026-09-10: drop the restore-versus-neutralize distinction. Reset at global, section, and parameter level would set the neutral value, giving one button per level with obvious behaviour. Tension to resolve in a brainstorm: restore today removes overrides so values fall back to the layer beneath (base under a profile, the shipped default under base), which is a different store operation from writing neutral values, and the row reset is what removes a wallpaper or profile override; a neutral-only reset would leave no way to un-override a key from the panel. Options: keep remove-override as the row reset and make section and global resets neutral; or make defaults equal to neutrals in the defs so the two coincide.

## Notes

- 2026-09-13T11:09:26Z (scope-acceptance): scope: briefed; neutral writes differ from removing overrides; reuse prism-bf3ae9 for the reset decision; brief: docs/notes/2026-09-13-profile-editing-brief.md
