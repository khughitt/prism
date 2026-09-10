---
id: prism-0f4922
title: "Name field: a submit button beside the field, and a fresh slot per mode"
status: done
priority: 1
size: s
owner: main
created: 2026-09-10T17:00:50Z
updated: 2026-09-10T22:50:32Z
depends: []
parent: prism-2f0b4b
tags: [noctalia, ui, profiles]
---

Three reports from 2026-09-10 acceptance, one cause each. (1) Rename cannot be saved and (2) save is confusing: the only submit is Enter, which needs keyboard focus, and clicking the save icon again cancels rather than saves. Add a submit button (check glyph) to the right of the field whose handler calls commitName with the text the panel already tracks through onChange, and make the icon a plain cancel. (3) The rename field is not prefilled: Noctalia's input is uncontrolled and the value prop seeds the host buffer once per slot; save and rename share one slot, so switching modes keeps the old buffer. Give the input a key that includes the mode (name-save, name-rename) so the switch creates a fresh slot. Also verify whether focus=true actually lands keyboard focus in a Noctalia panel; if it does not, say so in the contract note.

## Notes

- 2026-09-10T22:50:32Z (main): Name field: check button submits the tracked text, the open mode's icon is a plain cancel, and a per-mode key gives save and rename fresh input slots; contract note records that focus lands once at control creation.
