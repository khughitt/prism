---
id: prism-648e0f
title: "Wallpaper profiles: persist tuning per wallpaper and reactivate on the Noctalia hook"
status: done
priority: 2
size: m
owner: profile-ux
created: 2026-09-05T18:50:44Z
updated: 2026-09-09T23:51:58Z
depends: [prism-6fd864]
parent: prism-2f0b4b
tags: [noctalia, integration, profiles]
---

Outcome: while a wallpaper is showing, slider edits are persisted against that wallpaper without a save step, and when Noctalia shows that wallpaper again the same values come back automatically. A wallpaper profile is a store context keyed on the wallpaper path (or a stable hash of it, decided in the brainstorm). A new CLI verb receives the active wallpaper and activates its context, creating nothing until the first edit; a wallpaper with no context resolves to the base values. Transport is the Noctalia wallpaper_changed hook, which exports NOCTALIA_WALLPAPER_PATH and NOCTALIA_WALLPAPER_CONNECTOR; Noctalia has no plugin-side wallpaper event. Wallpapers here are set on all monitors at once, so one global context per path is enough; record the per-connector question as out of scope. Open UX decision for the brainstorm: whether every edit under a wallpaper goes to the wallpaper context, or the panel exposes a switch between tuning the wallpaper and tuning the base. A named profile loaded by hand should win over the wallpaper context until cleared. If prism-b5cb1e lands, tint comes from the colorscheme and the wallpaper context stores only what the user changed. The hook line itself is dotfiles-owned Noctalia config and is a separate piece in the dot project.

## Notes

- 2026-09-05T22:56:36Z (main): Panel/CLI split landed in prism-6fd864: a wallpaper context is keyed on the first 8 hex of SHA-256(path), carries _source, and 'prism context wallpaper <path>' is the hook verb; profile sits above wallpaper in the resolution order, so a hand-loaded profile already wins as this task wanted. The open UX question here (does every edit under a wallpaper go to the wallpaper context) now also has to answer prism-fcacfb: saving into the wallpaper while a profile is active makes the wallpaper absorb the profile's values.
- 2026-09-07T01:23:13Z (main): 2026-09-06 decision: the open UX question is settled in prism-fc8491. Wallpaper is an automatic layer and never the write target unless pinned; default target is the topmost explicit layer (profile, else base). Edits under a wallpaper go to the wallpaper context only while its pin is on.
- 2026-09-08T23:16:00Z (panel-layers): prism-3b7c07 landed 2026-09-08 (58da311): the panel now draws the wallpaper header row with a working pin, so per-wallpaper tuning is reachable end to end without the CLI. What remains here is confirming the hook-to-panel round trip on a real wallpaper change.
- 2026-09-09T23:51:58Z (profile-ux): Round trip confirmed 2026-09-09: the wallpaper slot followed the 15-minute rotation on its own (id 3a73dac7 -> d3407050 during one session, path recorded, unpinned), and the panel opened against the worktree plugin draws that wallpaper's header row with its pin. Clicking the pin and tuning under it is left to the P1 acceptance pass prism-3b1ac7.
- 2026-09-09T23:51:58Z (profile-ux): Hook-to-panel round trip verified on the live rotation; pin and per-wallpaper tuning already shipped in prism-fc8491 and prism-3b7c07
