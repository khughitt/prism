---
id: prism-b5cb1e
title: Derive glass attenuation color and terminal palette from the Noctalia colorscheme
status: idea
priority: 2
created: 2026-09-05T01:10:50Z
updated: 2026-09-05T02:00:00Z
depends: []
tags: [integration, noctalia, colors]
---

Colors cohesion: glass.attenuationColor is hand-set (#00DBE4) while kitty, neovim, and Noctalia take their palette from Noctalia colors.json / templates. Either derive attenuation color (and the noise/saturation treatment) from the Noctalia palette in the Noctalia plugin, or push the glass tint the other way into the palette, so terminal text, Noctalia bar, and glass share one tone. Decide direction, then scope.

## Notes

- 2026-09-05T01:46:44Z (main): Focus-glass spike (material docs 2026-09-04) shows the active material must carry the terminal background color at a short attenuation distance once kitty is at 0; the wallpaper-derived attenuation color alone leaves text illegible. Direction: terminal background from the palette, wallpaper tint as a secondary mix.
- 2026-09-05T01:57:44Z (main): Direction 2026-09-04: Noctalia colorscheme is the dominant color source; flow is noctalia -> prism -> glass color/hue. familiar owns only accent/ring per window (fam-b32b3d).
- 2026-09-05T02:00:00Z (main): Correction: glass.attenuationColor is a manual value (values.yaml), not wallpaper-derived; Noctalia colors.json (mSurface #13140f, mPrimary #bad065 today) does not reach Prism yet. Noctalia's template post_hook path (as used by noctalia-glass-sync for nvim) is the candidate transport.
