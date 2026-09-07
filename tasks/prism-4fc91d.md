---
id: prism-4fc91d
title: "Panel: hide the terminal opacity sliders now that the glass owns focus state"
status: todo
priority: 2
size: xs
created: 2026-09-07T08:21:16Z
updated: 2026-09-07T08:21:16Z
depends: []
tags: [noctalia, ui]
---

prism-5bc782 left 'retire or default terminal.background.opacity.*' open and chose default 0. The Focus group still shows two Terminal opacity sliders whose only effect is to reintroduce the terminal-versus-glass seam that dots-a00088 removed. Outcome: keep the params (a host may still want them, and the kitty sink binds them) but set ui.control to none so the panel no longer offers them; update the plugin presentation tests and the README sentence describing the Focus matrix. Decide whether the row disappears entirely or the group gains a note pointing at 'prism set --base'.
