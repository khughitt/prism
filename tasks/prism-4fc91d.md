---
id: prism-4fc91d
title: "Panel: hide the terminal opacity sliders now that the glass owns focus state"
status: todo
priority: 2
size: xs
created: 2026-09-07T08:21:16Z
updated: 2026-09-10T17:00:50Z
depends: []
tags: [noctalia, ui]
---

prism-5bc782 left 'retire or default terminal.background.opacity.*' open and chose default 0. The Focus group still shows two Terminal opacity sliders whose only effect is to reintroduce the terminal-versus-glass seam that dots-a00088 removed. Outcome: keep the params (a host may still want them, and the kitty sink binds them) but set ui.control to none so the panel no longer offers them; update the plugin presentation tests and the README sentence describing the Focus matrix. Decide whether the row disappears entirely or the group gains a note pointing at 'prism set --base'.

## Notes

- 2026-09-10T17:00:50Z (profile-selector): 2026-09-10 alternative from acceptance: rather than hiding them, fold the two terminal opacity sliders into the Focus matrix as one more row under distortion and noise, so the single-row Terminal section goes away. Facts: they are bound only by the kitty sink (live), and terminal.apps is what niri reads; nothing else consumes them. Decide hide versus move here.
