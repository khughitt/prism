---
id: prism-54f8c7
title: "Panel profile row: warn on overwrite, and reconsider blind delete"
status: done
priority: 2
size: s
owner: profile-ux
created: 2026-09-09T01:14:41Z
updated: 2026-09-09T23:49:58Z
depends: []
parent: prism-2f0b4b
tags: [noctalia, ui, profiles]
---

Two consequences of prism-ea6344 that were decided by omission rather than on purpose. (1) Saving under a name that already exists silently replaces that profile. The panel already holds the list in model.profiles, so it can say so before spending the command - the same local check that validates the name's shape. (2) Delete acts immediately with no confirmation, and only ever targets the loaded profile: deleting 'noon' while 'dusk' is loaded means selecting 'noon' first, which loads it. Deleting what you are looking at is defensible and the selector makes it reachable, but neither behaviour is written down anywhere. Settle both: either confirm destructive actions in the panel, or record them in docs/notes/noctalia-plugin-contract.md as intended.

## Notes

- 2026-09-09T23:49:58Z (profile-ux): Settled both by asking in place: Noctalia has no dialog, so a question row (Replace/Delete profile <name>?, destructive button, cancel) takes the name field's place. Save asks only when the name belongs to another profile; delete always asks and still targets only the loaded profile, now recorded as intended in the plugin contract note.
- 2026-09-09T23:49:58Z (profile-ux): Panel asks before replacing an existing profile or deleting the loaded one; blind-delete-of-loaded-only documented as intended
