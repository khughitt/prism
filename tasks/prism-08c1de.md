---
id: prism-08c1de
title: Starter profiles Aurora and Rainbow matching the niri-material presets
status: done
priority: 2
size: m
owner: feat/aurora-rainbow
created: 2026-09-10T09:33:47Z
updated: 2026-09-11T08:01:28Z
depends: [prism-763054]
tags: [profiles, niri]
---

Ship ordinary Prism profile YAML files for Aurora and Rainbow matching the tuned niri-material presets. Reuse the existing context loader and profile picker, document non-overwriting installation into the profile directory, and validate the profiles and emitted niri config. Ice is tracked separately; no new profile subsystem. Depends on prism-763054.

## Notes

- 2026-09-11T08:01:28Z (feat/aurora-rainbow): Shipped ordinary full-snapshot Aurora/Rainbow profiles, existing loader/picker coverage and non-overwriting installation docs. just gate passes 312 tests plus Lua; installed niri validates both focus materials for both presets; independent review clean.
