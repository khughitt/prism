---
id: prism-28e29c
title: Expose the ring of light in the palette
status: done
priority: 2
size: m
complexity: low
owner: main
created: 2026-09-05T20:56:45Z
updated: 2026-09-13T10:11:16Z
started: 2026-09-13T09:16:55Z
completed: 2026-09-13T09:57:59Z
depends: [material-8c69c9]
tags: [niri]
---

niri-material material-26dd8a adds a response block to material definitions: focus "ring-light"|"none" (default ring-light), ring-inset (5), ring-width (2.6, > 0), ring-color ("#ccccff"), ring-drift-hz (15; 0 or 1..30 in tenths). Add palette parameters for the ring (color from the palette accent, drift rate, focus on/off) and emit a response "default" { ... } block inside both terminal-glass definitions integrations/niri/render.js writes; extend test/niri-render.test.js. The generated fragment fails niri validate until the native build is installed (niri-material material-8c69c9), so this lands only after that pin. light-ior stays with prism-0ea68f.

## Notes

- 2026-09-13T09:57:46Z (main): Landed: Ring section (focus toggle, colorSource familiar|noctalia|manual, color, driftHz int 0..30) emits response "default" in both materials; noctalia reads mPrimary from colors.json at apply (missing file rests on the manual color, broken file fails the sink); familiar keeps accent "ring" on for its signal. Whole Hz only, matching the aurora drift rows; niri's tenth-steps are unexposed. Live apply on titan: ring-color #bad065 from the scheme, niri validate passes.
- 2026-09-13T09:57:46Z (main): Staleness: the noctalia source re-reads the palette on every apply, and the wallpaper_changed hook re-applies prism on rotation; ordering between colors.json regeneration and the hook is noctalia's, so the ring can lag one rotation if the hook fires first. The general transport decision stays with prism-b5cb1e.
- 2026-09-13T09:57:59Z (main): Ring of light exposed: glass.ring.focus/colorSource/color/driftHz in a new Ring panel section; response "default" emitted in both terminal-glass materials; ring color driven by familiar's signal, noctalia's mPrimary read at apply, or the manual color; 326 node tests + lua suite pass; live apply validated by the installed niri.
- 2026-09-13T10:11:16Z (main): Review fix: the palette read is now gated on glass.enabled as well as the noctalia source, so a broken colors.json cannot block an apply that emits no ring (regression test in niri-apply.test.js).
