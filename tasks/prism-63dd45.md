---
id: prism-63dd45
title: Expose blur noise and saturation per focus state
status: idea
priority: 2
created: 2026-09-05T02:36:51Z
updated: 2026-09-05T02:36:51Z
depends: []
tags: [glass, noctalia]
---

Add noise and saturation to the panel, adjustable separately for focused and unfocused terminals. Native glass inherits noise and saturation from niri's global blur block only when backdrop-blur is effective (material-config.md), and per-window background-effect is independent of the material; so this needs either a material-level noise/saturation parameter in niri-material or a per-state background-effect emission. Decide which before scoping.
