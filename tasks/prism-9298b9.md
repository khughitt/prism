---
id: prism-9298b9
title: "State profiles: activate contexts from theme mode and other Noctalia hook states"
status: idea
priority: 2
created: 2026-09-05T18:50:49Z
updated: 2026-09-05T18:51:00Z
depends: [prism-6fd864]
parent: prism-2f0b4b
tags: [profiles, noctalia]
---

Generalise the wallpaper activation to other states Noctalia already reports through hooks: theme_mode_changed (NOCTALIA_THEME_MODE dark or light), power_profile_changed, colors_changed, and session lock. A state profile is a context keyed on the state value and activated by the matching hook. Open questions before scoping: which states matter in practice, how a state context composes with a wallpaper context when both apply (ordered layers or exclusive), and whether time of day belongs here or stays with material-f41c54 as a signal source. Focus state is already handled by the native focus-split materials and is out of scope.
