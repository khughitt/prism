---
id: prism-cc4e81
title: "Rename a profile: a context rename verb and its panel control"
status: done
priority: 2
size: s
owner: profile-ux
created: 2026-09-09T00:21:52Z
updated: 2026-09-09T23:49:58Z
depends: []
parent: prism-2f0b4b
tags: [profiles, cli, noctalia]
---

prism-ea6344 shipped save, load, and delete from the panel but not rename, because 'context' has no rename verb: save/activate/deactivate/delete/pin/unpin/wallpaper only. Renaming is a store operation, not a panel one, so it needs 'prism context rename <kind> <old> <new>' first — rename the file under the store lock, refuse a name that already exists, and repoint active.profile when the renamed profile is the loaded one. The panel side is then a third button on the profile row reusing the existing name field (ui.input, submitOnEnter) and the local name validation in Presentation.validProfileName. Faking it panel-side as save-under-new-name plus delete-old was rejected: it rewrites provenance and leaves both copies if the delete fails.

## Notes

- 2026-09-09T23:49:58Z (profile-ux): rename is profile-only (a wallpaper is named by its path hash); moves the file under the lock, refuses a taken target, repoints active.profile, touches no resolved.json or sink. Panel: pencil button on the profile row reuses the name field seeded with the current name; taken name refused locally, same name closes the field.
- 2026-09-09T23:49:58Z (profile-ux): prism context rename <kind> <old> <new> plus the panel's rename button
