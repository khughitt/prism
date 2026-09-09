---
id: prism-b6d7ee
title: "Panel: re-read the model when the wallpaper hook fires while the panel is open"
status: idea
priority: 2
created: 2026-09-09T23:51:58Z
updated: 2026-09-09T23:51:58Z
depends: []
tags: [noctalia, ui, profiles]
---

The panel runs describe only on open and after its own writes, so a wallpaper rotation while the panel is open leaves the header row and every wallpaper-layer shadow stale until it is reopened. Noctalia has no plugin-side wallpaper event, so the options are polling noctalia.wallpaperPath(output) on a frame tick, or the hook touching a file the panel watches. Noticed while closing prism-648e0f; cheap to live with while the panel is opened briefly.
