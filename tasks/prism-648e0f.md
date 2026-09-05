---
id: prism-648e0f
title: "Wallpaper profiles: persist tuning per wallpaper and reactivate on the Noctalia hook"
status: todo
priority: 2
size: m
created: 2026-09-05T18:50:44Z
updated: 2026-09-05T22:56:36Z
depends: [prism-6fd864]
parent: prism-2f0b4b
tags: [noctalia, integration, profiles]
---

Outcome: while a wallpaper is showing, slider edits are persisted against that wallpaper without a save step, and when Noctalia shows that wallpaper again the same values come back automatically. A wallpaper profile is a store context keyed on the wallpaper path (or a stable hash of it, decided in the brainstorm). A new CLI verb receives the active wallpaper and activates its context, creating nothing until the first edit; a wallpaper with no context resolves to the base values. Transport is the Noctalia wallpaper_changed hook, which exports NOCTALIA_WALLPAPER_PATH and NOCTALIA_WALLPAPER_CONNECTOR; Noctalia has no plugin-side wallpaper event. Wallpapers here are set on all monitors at once, so one global context per path is enough; record the per-connector question as out of scope. Open UX decision for the brainstorm: whether every edit under a wallpaper goes to the wallpaper context, or the panel exposes a switch between tuning the wallpaper and tuning the base. A named profile loaded by hand should win over the wallpaper context until cleared. If prism-b5cb1e lands, tint comes from the colorscheme and the wallpaper context stores only what the user changed. The hook line itself is dotfiles-owned Noctalia config and is a separate piece in the dot project.

## Notes

- 2026-09-05T22:56:36Z (main): Panel/CLI split landed in prism-6fd864: a wallpaper context is keyed on the first 8 hex of SHA-256(path), carries _source, and 'prism context wallpaper <path>' is the hook verb; profile sits above wallpaper in the resolution order, so a hand-loaded profile already wins as this task wanted. The open UX question here (does every edit under a wallpaper go to the wallpaper context) now also has to answer prism-fcacfb: saving into the wallpaper while a profile is active makes the wallpaper absorb the profile's values.
