---
id: prism-ad2b12
title: One reset per level that loads the neutral look
status: idea
priority: 2
reviewed: true
reviewed_at: 2026-10-17T21:15:32Z
created: 2026-09-10T17:00:50Z
updated: 2026-10-17T21:15:32Z
depends: []
parent: prism-3415ef
tags: [ui, noctalia, defs]
---

Proposal 2026-09-10: drop the restore-versus-neutralize distinction. Reset at global, section, and parameter level would set the neutral value, giving one button per level with obvious behaviour. Tension to resolve in a brainstorm: restore today removes overrides so values fall back to the layer beneath (base under a profile, the shipped default under base), which is a different store operation from writing neutral values, and the row reset is what removes a wallpaper or profile override; a neutral-only reset would leave no way to un-override a key from the panel. Options: keep remove-override as the row reset and make section and global resets neutral; or make defaults equal to neutrals in the defs so the two coincide.

## Notes

- 2026-09-13T11:09:26Z (scope-acceptance): scope: briefed; neutral writes differ from removing overrides; reuse prism-bf3ae9 for the reset decision; brief: docs/notes/2026-09-13-profile-editing-brief.md
- 2026-10-17T21:14:54Z (main): scope: drop; rechecked at 93625b4: settled by docs/specs/2026-09-19-compositional-profiles-design.md Section 4 (revert and neutral both stay, since they answer different questions, and both write scratch so neither touches a persisted layer); the panel offers revert, symmetric and neutral on the panel-wide and section rows and revert as the row reset (integrations/noctalia-plugin/panel.luau resetModeButtons, rowReset 'Revert edit'); the spec's task map says 'done by Section 4; close with the verdict'; proposal: drop as landed in ad17477 under prism-aec90f (done; step prism-c76742), sibling verdict prism-bf3ae9 already closed
- 2026-10-17T21:15:08Z (main): correction to the scope note above: the row reset function is resetButton (tooltip 'Revert edit'), not rowReset
- 2026-10-17T21:15:32Z (main): scope: drop; restated with the corrected function name (the note above masked the proposal); rechecked at 93625b4: settled by docs/specs/2026-09-19-compositional-profiles-design.md Section 4 (revert and neutral both stay, since they answer different questions, and both write scratch so neither touches a persisted layer); the panel offers revert, symmetric and neutral on the panel-wide and section rows (integrations/noctalia-plugin/panel.luau resetModeButtons) and revert as the row reset (resetButton, 'Revert edit'); the spec's task map says 'done by Section 4; close with the verdict'; proposal: drop as landed in ad17477 under prism-aec90f (done; step prism-c76742), sibling verdict prism-bf3ae9 already closed
