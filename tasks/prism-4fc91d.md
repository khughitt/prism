---
id: prism-4fc91d
title: "Panel: hide the terminal opacity sliders now that the glass owns focus state"
status: done
priority: 2
size: xs
owner: main
created: 2026-09-07T08:21:16Z
updated: 2026-09-10T23:55:53Z
depends: []
tags: [noctalia, ui]
---

prism-5bc782 left 'retire or default terminal.background.opacity.*' open and chose default 0. The Focus group still shows two Terminal opacity sliders whose only effect is to reintroduce the terminal-versus-glass seam that dots-a00088 removed. Outcome: keep the params (a host may still want them, and the kitty sink binds them) but set ui.control to none so the panel no longer offers them; update the plugin presentation tests and the README sentence describing the Focus matrix. Decide whether the row disappears entirely or the group gains a note pointing at 'prism set --base'.

## Notes

- 2026-09-10T17:00:50Z (profile-selector): 2026-09-10 alternative from acceptance: rather than hiding them, fold the two terminal opacity sliders into the Focus matrix as one more row under distortion and noise, so the single-row Terminal section goes away. Facts: they are bound only by the kitty sink (live), and terminal.apps is what niri reads; nothing else consumes them. Decide hide versus move here.
- 2026-09-10T23:55:38Z (main): Decided hide over move: the rack owns the Focus group and every visible Focus param must be claimed by a device, so folding the terminal pair into the Focus matrix would require a fake device for a non-shader param. control: none hides the row entirely (no panel note; prism set remains the documented path), drops the neutral since resets scope to visible defs, and leaves the kitty sink bindings untouched.
- 2026-09-10T23:55:53Z (main): Terminal opacity pair is now control: none: hidden from the panel and out of reset scope, defaults unchanged, kitty sink still binds them; the Lua fixture's synthetic matrix section keeps plain-section coverage as Extra/Dim.
