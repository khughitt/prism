---
id: prism-9298b9
title: "State profiles: activate contexts from theme mode and other Noctalia hook states"
status: shelved
priority: 2
created: 2026-09-05T18:50:49Z
updated: 2026-09-29T22:37:44Z
depends: [prism-6fd864]
parent: prism-2f0b4b
tags: [profiles, noctalia]
---

Generalise the wallpaper activation to other states Noctalia already reports through hooks: theme_mode_changed (NOCTALIA_THEME_MODE dark or light), power_profile_changed, colors_changed, and session lock. A state profile is a context keyed on the state value and activated by the matching hook. Open questions before scoping: which states matter in practice, how a state context composes with a wallpaper context when both apply (ordered layers or exclusive), and whether time of day belongs here or stays with material-f41c54 as a signal source. Focus state is already handled by the native focus-split materials and is out of scope.

## Notes

- 2026-09-09T01:15:11Z (panel-error-lifecycle): The panel side of this is already free: prism-3b7c07 made describe state the resolution order as 'layers' and the panel ranks against what it is told, and LAYER_ORDER already reserves 'state' between wallpaper and profile. A state layer will shadow rows and rank correctly with no panel change; what remains here is the activation sources and the composition rules.
- 2026-09-19T21:15:37Z (prism-aec90f): Reframed 2026-09-19: a state context is a delta kind per compositional profiles Section 3 (a kind in LAYER_ORDER, a key source, an entry verb); the fold rule comes free
- 2026-09-29T22:37:44Z (main): shelved: A concrete hook state and the appearance values it should change are identified; then design its activation and scratch rules.
- 2026-09-29T22:37:44Z (main): scope: shelved; state is reserved and layer precedence is settled, but no concrete state-to-adjustment mapping justifies activation or stacking yet
