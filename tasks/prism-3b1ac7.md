---
id: prism-3b1ac7
title: "Live acceptance pass: profiles, wallpaper pin, and shadowed rows in the running shell"
status: todo
priority: 1
size: s
created: 2026-09-09T01:14:52Z
updated: 2026-09-09T23:51:58Z
depends: []
parent: prism-2f0b4b
tags: [noctalia, ui, profiles]
---

Everything in the profiles goal is verified by tests and by driving the real panel.luau with real 'describe --json' output, but nothing has been seen on screen. This machine has no pointer automation (no ydotool/wlrctl, and niri exposes no cursor-move action), so hover and drag behaviour has to be confirmed by a person. Cover: the pin button's tooltip in both states and while a profile blocks it; the profile selector loading, clearing, and the name field's focus and Enter-to-submit; whether 0.55 opacity on a shadowed row reads as 'covered' rather than 'broken', and whether the shadow hint is legible at fontSize 11; and the wallpaper header's override count against a wallpaper that actually holds tuning. Reload with 'noctalia msg plugins disable khughitt/prism' then enable; the shell loads the plugin from ~/.local/share/noctalia/plugins/prism. The panel and the prism command must be upgraded together, and both currently resolve to the main checkout. Goal prism-2f0b4b should not be called met before this passes.

## Notes

- 2026-09-09T23:51:58Z (profile-ux): 2026-09-09: the rename button and the question rows (Replace profile <name>? / Delete profile <name>?) landed on branch profile-ux (e9c82d7). Add to this pass: save under an existing name shows the question and Cancel drops it; Replace saves and enters the profile; delete asks first; rename opens the field seeded with the current name, refuses a taken name with a banner, and a same-name submit just closes it; the pencil is dim with no profile loaded. Screenshot of the rendered row confirmed; clicks need a person.
