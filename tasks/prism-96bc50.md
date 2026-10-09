---
id: prism-96bc50
title: "Expose the glass view keys: glass.view.perspective, parallax, tilt, tiltSettle"
status: idea
priority: 2
created: 2026-09-23T11:30:24Z
updated: 2026-10-09T04:34:40Z
depends: []
tags: [material, camera]
---

niri-material material-77db8a adds view-perspective (glass, 0-1, default 0), view-parallax (glass, 0-8, default 1), view-tilt (response, 0-45 degrees, default 0) and view-tilt-settle (response, 100-5000 ms, default 900). Map them as glass.view.perspective, glass.view.parallax, glass.view.tilt and glass.view.tiltSettle. Defaults for presets come from the owner's review of the view-swing and view-persp sheets; see docs/specs/2026-09-22-focus-view-tilt-design.md in niri-material.

## Notes

- 2026-10-09T04:34:40Z (main): scope: drop; niri-material dropped material-77db8a on 2026-10-06 (optical-only tilt rejected; branch kept unmerged), so view-perspective/parallax/tilt/tilt-settle never reached a niri prism can target; successor is the idea material-6901e0; proposal: drop as premise gone (material-77db8a dropped); file a fresh prism key task if material-6901e0 lands keys
