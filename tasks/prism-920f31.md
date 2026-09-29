---
id: prism-920f31
title: Rename or delete a profile without loading it
status: shelved
priority: 2
created: 2026-09-10T17:00:50Z
updated: 2026-09-29T22:37:44Z
depends: []
parent: prism-2f0b4b
tags: [noctalia, ui, profiles]
---

Both act only on the loaded profile, so touching another one means selecting it, which reloads niri. A target picker on the question row, or a per-option action in the dropdown, would avoid that. Documented as intended for now in the plugin contract note.

## Notes

- 2026-09-13T11:09:26Z (scope-acceptance): scope: briefed; inactive rename/delete already supported and tested; panel target selection awaits prism-e37618; brief: docs/notes/2026-09-13-profile-editing-brief.md
- 2026-09-19T21:15:37Z (prism-aec90f): Reframed 2026-09-19: loading a profile to manage it now costs a compositor reload and no lost edits (compositional profiles, Section 11); a picker waits for that reload to prove worth removing
- 2026-09-29T22:37:44Z (main): shelved: Repeated unloaded-profile management makes activation reloads or outgoing-pair autosaves disruptive; then reuse the inactive rename/delete CLI in a panel target picker.
- 2026-09-29T22:37:44Z (main): scope: shelved; inactive rename/delete already works in the CLI; defer extra panel controls until activation side effects cause recurring management friction; brief: docs/notes/2026-09-13-profile-editing-brief.md
