---
id: prism-6a628e
title: "Own the dropdown terminals' look: dropdown.* keys, the ^dropdown- layer-rule and a quick-access config"
status: todo
priority: 2
size: m
complexity: mid
process: planned
created: 2026-10-17T22:29:00Z
updated: 2026-10-17T22:29:00Z
depends: []
tags: [terminal, integration, niri, cross-project]
source: dots-a417c7
agent: claude-code/claude-opus-5-5
---

Why: the niri dropdown terminals (kitty quick-access layer surfaces from the dotfiles' niri/scripts/dropdown) should have their own look, tuned from prism beside the glass rather than hand-set in dotfiles. On 2026-10-17 the owner chose this route (dots-a417c7, option (b)). They passed over a static dotfiles look, and over niri-material glass on layer surfaces, which does not exist yet.

Established (2026-10-17, prism f8c6c88):
- dotfiles hand-sets today's look in two places. niri/config.kdl's `^dropdown-` layer-rule sets geometry-corner-radius 0 0 12 12 and a shadow, with no background-effect. niri/scripts/dropdown sets kitty options per case: background_opacity 0.85, and for the mindful scratchpad 0.98 plus `kitty_override=transparent_background_colors=#000001@1.0`, so nvim's chrome stays readable over other windows.
- The render path reaches neither. The niri sink emits the glass only as window-rules on `terminal.apps`, which never match layer surfaces. The kitty sink writes one kitty.conf from terminal.background.opacity.active, and each dropdown overrides it on its command line.
- The live path does reach them. integrations/kitty/live.js sends `set-background-opacity --all` to every `@dotfiles-kitty-<pid>` socket, and each running dropdown panel process holds one (checked in /proc/net/unix). A live opacity apply would therefore set the dropdowns to terminal.background.opacity.inactive until they respawn.
- niri layer-rules take opacity, geometry-corner-radius, shadow and background-effect (xray, blur, noise, saturation). niri-material adds surface-remap, for opaque shells only. No layer-rule takes the glass material.
- kitty's quick-access-terminal reads $XDG_CONFIG_HOME/kitty/quick-access-terminal.conf (or `-c <path>`). Its options include background_opacity, kitty_conf and kitty_override, so a generated file there is where a prism output would write.

Done when: a design picks the dropdown.* key set (for example opacity, blur, noise, saturation, corner radius, shadow), and the keys resolve like other params. The niri sink emits the `^dropdown-` layer-rule into prism.kdl. A kitty-side output writes the quick-access config the dropdowns read. The panel shows the group. The live kitty push no longer flattens the dropdowns. Tests cover the rendered outputs. dots-a417c7 then removes the hand-set copies from dotfiles.

Open for the design: liveness, since a layer-rule change reloads niri while quick-access options apply only when an instance is created, so a change may need the dropdowns respawned. Per-dropdown overrides: the scratchpad's readability override as a prism key or kept in dotfiles (the owner has not said whether the scratchpad shares the look). Whether the keys follow profiles and wallpaper contexts the way the glass keys do.
