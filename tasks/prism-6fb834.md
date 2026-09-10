---
id: prism-6fb834
title: "Panel: neutralize everything clears the loaded profile first"
status: done
priority: 2
size: s
owner: profile-selector
created: 2026-09-10T16:28:17Z
updated: 2026-09-10T16:29:19Z
depends: []
tags: [noctalia, ui, profiles]
---

The panel-wide neutral button runs prism reset neutral, which writes into the write target; with a profile loaded that overwrites the saved snapshot. Enqueue a deactivate ahead of the reset in the same FIFO so the neutral values land in base or the pinned wallpaper and the profile keeps its values; the selector clears optimistically like a pick. Section-scope neutral buttons are unchanged.

## Notes

- 2026-09-10T16:29:19Z (profile-selector): Panel-wide neutralize enqueues a profile deactivate ahead of the reset; section neutral unchanged
