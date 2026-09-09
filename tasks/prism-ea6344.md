---
id: prism-ea6344
title: "Named profiles: save, load, and manage from the Noctalia panel"
status: done
priority: 2
size: m
owner: named-profiles
created: 2026-09-05T18:50:37Z
updated: 2026-09-09T00:22:58Z
depends: [prism-6fd864, prism-fcacfb]
parent: prism-2f0b4b
tags: [noctalia, ui, profiles]
---

Outcome: a user can capture the current glass values as a named profile from the panel (a save button that opens a name field), then later select it to reapply, and delete it. Renaming needs a CLI verb that does not exist and is deferred to prism-cc4e81. A named profile is a store context activated by hand; loading it makes it the active context so further slider edits are written into it, and a clear action returns the write target to base. The panel needs a profile row: a select of saved profiles with the active one marked, save and delete buttons, and the name input. Verified 2026-09-08 against the installed host source: ui.input exists (ui_prelude.h) and the reconciler's kInput allowlist carries value, placeholder, enabled, focus, onChange, onSubmit, and submitOnEnter, so in-panel naming is available and the CLI-naming fallback is not needed. Presentation and queue modules carry the layout and write-ordering contract, so the direct Lua tests must cover the new rows.

## Notes

- 2026-09-09T00:22:04Z (named-profiles): Rename deferred to prism-cc4e81: 'prism context' has no rename verb, and adding one is a store change rather than the panel change this task scopes.
- 2026-09-09T00:22:58Z (named-profiles): Profile row in the panel: a selector that loads and clears (index 0 'No profile' deactivates), a save button opening a ui.input name field, and a delete button on the reset idiom. describe --json lists saved names as 'profiles' from the same locked snapshot as active. Save enters the profile it just named, but only once the save has landed - the FIFO continues after a failure, so the activate is conditional. Command errors now outlive the refresh they trigger. Rename deferred to prism-cc4e81. 221 node tests + Lua panel tests pass; contract note and spec revised.
