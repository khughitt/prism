---
id: prism-b5cb1e
title: Derive glass attenuation color and terminal palette from the Noctalia colorscheme
status: todo
priority: 1
size: m
complexity: high
created: 2026-09-05T01:10:50Z
updated: 2026-09-12T16:46:10Z
depends: []
tags: [integration, noctalia, colors]
---

Outcome: the active terminal-glass material carries the Noctalia surface color at a short attenuation distance, refreshed on every palette change, so text stays legible over any wallpaper with kitty at background_opacity 0 (dots-a00088 landed 2026-09-06 with a hand-seeded #111317 at distance 30 on titan). Direction settled 2026-09-04: Noctalia colorscheme is the dominant source, flow noctalia -> prism -> glass. Transport: a Noctalia template post_hook (the path noctalia-glass-sync already uses) that writes the surface tone into Prism; decide in the brainstorm whether that is a base write, a derived value the resolver computes from a new colors input, or a state context. Keep the wallpaper-derived tint as a secondary mix. Acceptance: change wallpaper twice; the active material's attenuation-color in prism.kdl follows the palette surface each time, the inactive variant follows too, and focused/unfocused text is legible over a bright wallpaper. Load-bearing for ops-500adb now that the terminal paints no background.

## Notes

- 2026-09-05T01:46:44Z (main): Focus-glass spike (material docs 2026-09-04) shows the active material must carry the terminal background color at a short attenuation distance once kitty is at 0; the wallpaper-derived attenuation color alone leaves text illegible. Direction: terminal background from the palette, wallpaper tint as a secondary mix.
- 2026-09-05T01:57:44Z (main): Direction 2026-09-04: Noctalia colorscheme is the dominant color source; flow is noctalia -> prism -> glass color/hue. familiar owns only accent/ring per window (fam-b32b3d).
- 2026-09-05T02:00:00Z (main): Correction: glass.attenuationColor is a manual value (values.yaml), not wallpaper-derived; Noctalia colors.json (mSurface #13140f, mPrimary #bad065 today) does not reach Prism yet. Noctalia's template post_hook path (as used by noctalia-glass-sync for nvim) is the candidate transport.
- 2026-09-05T18:51:00Z (main): Related 2026-09-05: prism-2f0b4b (context-specific profiles); an auto-derived tint shrinks what a wallpaper profile must store.
- 2026-09-07T08:21:16Z (main): 2026-09-07 promoted to todo P1: with kitty at 0 the glass is the only thing behind the text; a fixed attenuation color drifts out of step within one rotation.
- 2026-09-08T22:56:56Z (main): The focus matrix now has glass.inactive.attenuationColor as well (prism-a4ef9a), so a derived tint has two halves to fill; deriving only the focused one leaves the unfocused material on the shipped #dfe8ff.
