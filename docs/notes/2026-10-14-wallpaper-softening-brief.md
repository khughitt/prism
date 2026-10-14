# Wallpaper softening brief

## Problem

The wallpaper shows through the gaps around and between windows. It is usually an
unprocessed photo, so it reads as busier and noisier than the glass on top of it. Subtle
blur, desaturation, noise and brightness/contrast would make it read as background
(`prism-d46d07`). The adjustments should be ordinary prism parameters riding the profile,
wallpaper and state layers and shown in the panel. Goal `prism-85caf6` holds the work.

## Current behaviour and evidence

- Prism owns no wallpaper processing. Wali sets the wallpaper through Noctalia, and
  Noctalia's `wallpaper_changed` hook runs `prism context wallpaper <path>`.
  Noctalia derives the palette from the image.
- Noctalia's `[wallpaper]` config has fill, transitions and directories but no image
  adjustments. Its `[backdrop]` (blur and tint intensity, off in the live config) is niri's
  overview backdrop, not the gaps between windows.
- niri 26.04 (the running build) supports layer-rule `background-effect { xray blur noise
  saturation }`. Xray blur samples the wallpaper only, is computed once and reused until
  the wallpaper changes (niri-material `docs/wiki/Window-Effects.md`).
- The glass refracts `Layer::Background` only
  (`docs/superpowers/specs/2026-08-29-prism-debug-backdrop-design.md`), so a surface on the
  Bottom layer would not change what the glass sees. That spec's "Noctalia and wali
  boundary" section shows why replacing the wallpaper image is costly. It would change the
  palette, be overwritten by the next rotation, and make `walictl` report a file the user
  never chose.

## Constraints

- Keep Noctalia's palette, wali's rotation and `walictl`'s reporting unaware of the
  processing, as the debug backdrop does.
- Do not compete with the glass: the softened gaps sit beside glass that refracts the raw
  wallpaper, and the edge between the two must not look wrong.
- Keep cost measurable: the softening is always on, unlike the debug backdrop.
- No compositor changes in prism's scope; an upstream Noctalia contribution is an action
  outside the repository.

## Alternatives

1. **A transparent Bottom-layer surface with a niri `background-effect` layer-rule.** This
   is the current lean. The cost is one cached xray blur, and the glass is untouched.
   Saturation and noise are native. Brightness and contrast need a translucent fill. A
   prism sink would own the surface (the debug-backdrop mechanism) and the layer-rule (the
   niri sink).
2. **Wali pre-processes the image before hand-off.** Any adjustment is possible. But the
   palette derives from the processed image, the glass refracts it too, and the
   rotation/report boundary above applies.
3. **A Noctalia wallpaper-layer contribution.** This is general, but it is upstream work.
   It also changes what the glass refracts, because the wallpaper layer is the Background
   layer.

## Unanswered questions

- Does alternative 1 soften the gaps with the glass unchanged, at what frame cost, and does
  a translucent fill stand in for brightness/contrast? `prism-a67714` answers by
  prototype.
- How subtle must it stay beside the glass? The owner judges the prototype's stills.

## Proposed decomposition

- `prism-a67714` (research, mid, direct): wakes `prism-d46d07`.
- After it, `prism-d46d07` is scoped into parameters (defs), the surface and layer-rule
  sinks, and panel rows, or re-briefed toward alternative 2 or 3.
