---
id: prism-2f0b4b
title: "Context-specific glass profiles: named, per-wallpaper, and per-state"
status: todo
priority: 2
size: l
created: 2026-09-05T18:50:21Z
updated: 2026-09-08T23:16:00Z
depends: [dots-88dc34]
tags: [profiles, noctalia, store]
---

Goal: a set of glass parameter values that looks right for one wallpaper and colorscheme is often wrong for another, so users should not have to retune every time the wallpaper changes. Three use cases share one mechanism: (1) named profiles the user saves and reloads by hand from the Noctalia panel, (2) wallpaper profiles that persist whatever the user tunes while a wallpaper is showing and reapply automatically when that wallpaper returns, with no save or load step, and (3) profiles bound to other states Noctalia already reports, such as theme mode.

Mechanism: a context layer in the Prism store. Resolution becomes defaults, then the base values file, then the active context's values. A named profile is a context activated by the user; a wallpaper profile is a context activated by Noctalia's wallpaper_changed hook; a state profile is a context activated by another hook. The niri sink is unchanged: every activation is a normal resolve and fan-out that rewrites prism.kdl and reloads the compositor. Nothing changes in niri-material.

Facts established 2026-09-05: the store is one flat values.yaml per host with no layering; the Noctalia plugin panel is Luau on plugin API v5, whose declarative UI has ui.button and ui.input (text field), so in-panel naming is feasible but must be verified on the installed Noctalia 5.0.1 since an earlier note on prism-686374 listed no input control; Noctalia has no plugin-side wallpaper event, only noctalia.wallpaperPath(output), while the wallpaper_changed hook exports NOCTALIA_WALLPAPER_PATH and NOCTALIA_WALLPAPER_CONNECTOR and colors_changed fires after the palette regenerates; wallpapers rotate on all monitors every 15 minutes here, so a single global context keyed on the wallpaper path suffices.

Related: prism-b5cb1e (an auto-derived attenuation color shrinks what a wallpaper profile must store) and material-f41c54 (the same state question from the signals side).

## Notes

- 2026-09-08T22:56:56Z (main): A context now has five more glass.inactive.* keys to snapshot (prism-a4ef9a: backdropBlur, attenuationColor, ior, thickness, distortionScale). If prism-7e4766 lands, decide whether a context that sets only the focused half should carry the unfocused one with it.
- 2026-09-08T23:16:00Z (panel-layers): Panel layer rendering landed 2026-09-08 (58da311). describe --json now also states the resolution order as 'layers', so a future state layer ranks correctly in the panel with no panel change.
