# Glass noise type

**Date:** 2026-09-06
**Status:** design approved 2026-09-06; not implemented. Hub goal
`prism-d6b600`; native piece `material-6e7352`, designed in niri-material
`docs/specs/2026-09-06-material-glass-noise-type-design.md`; Prism piece
`prism-51f23b`. The Prism piece lands only after the native build is
installed on the machine that runs `prism apply`.

## Context

Since `bdb52dd` the Focus matrix carries a Noise row: a focused and an
unfocused amplitude, written into `terminal-glass` and
`terminal-glass-inactive` (`docs/specs/2026-09-05-glass-noise-saturation-focus-state-design.md`).
The grain itself is fixed by niri-material: one uniform-random value per
pixel added equally to R, G and B in sRGB-encoded space. Observed on
2026-09-05, it reads as grainy and coarse even at the default unfocused
amplitude of 0.02. The coarseness has two sources: white noise carries as
much energy at low spatial frequencies as high, which the eye reads as
clumps, and a uniform distribution keeps its density flat right up to its
hard bound, so the strongest speckles are exactly as common as the faintest.

The native design adds an optional `type` property to the glass `noise`
node with three values:

| Value | Grain |
| --- | --- |
| `white` | today's grain, character for character; the native default when omitted |
| `fine` | a high-pass of the hash noise, bell-shaped, achromatic, scaled so its standard deviation matches `white` at the same amount |
| `lightness` | the `fine` pattern applied to Oklab lightness, so chroma and hue hold except where the result leaves the sRGB gamut and clamps |

Prism chooses which of them its glass uses. The native spec owns what each
type does; this document owns how Prism exposes the choice.

## Decision

One shared selector. Both materials get the same type; the two Noise
amplitudes stay the only per-state controls. A per-state type would need
matrix-row support for the select control, and nothing asks for two grains
on one desktop.

Prism's default is `fine`. The native omitted default stays `white` so
existing niri configs render byte-identical, but Prism always writes the
type, so its glass never depends on that default, and a Prism user gets the
finer grain on the next apply without touching the panel.

## Definition

One new key in `defs/glass.yaml`, Focus group, between the Noise row and
the Saturation row:

| Key | Type | Values | Default | ui |
| --- | --- | --- | --- | --- |
| `glass.noiseType` | enum | white, fine, lightness | fine | group Focus, control select, label Noise type, order 275 |

The key carries no `state` and no `row`, so the presentation layer renders
it as a single-parameter row under the Noise matrix row, which it already
supports alongside matrix rows in the same section. The description says
what each value does to the grain, not how niri implements it:

> Grain pattern shared by both focus states: white is coarse uniform grain,
> fine removes the clumps, lightness keeps the backdrop's colour and grains
> only its brightness

This is the first definition to use the `enum` type and the `select`
control. Both exist in `src/defs.js`, `src/values.js` and the panel already;
the value validator rejects a string outside `values` on read and on write.

## Sink

`integrations/niri/render.js`:

- `definition` writes `noise <amount> type=<type>` in place of
  `noise <amount>`, in both materials and on the single-material path;
- the type comes from `params['glass.noiseType']`, once, and is not part of
  `activeGlass` or `inactiveGlass`, which stay per-state.

`integrations/niri/manifest.yaml` binds `glass.noiseType` with
`liveness: reload`.

## Panel

No Lua change is expected. `panel.luau` already renders a `select` control
from a definition's `values`, shows the current value, and writes the chosen
string back. It has never run against Noctalia API 22, because no definition
used it. The piece therefore includes a live check: point the shell's plugin
symlink at the worktree, reload the plugin, open the panel, and confirm the
select renders under the Noise row, shows `fine`, switches to each other
value, and that the unfocused pane's grain changes with it. Any Lua fix this
surfaces is part of the piece.

## Tests

- `test/glass-defs.test.js`: `glass.noiseType` in the definitions with its
  values and default; a new assertion that the Focus group order places it
  between the Noise and Saturation rows.
- `test/niri-render.test.js`: both material definitions contain
  `noise <amount> type=<type>` with the shared type and their own amounts;
  the single-material path writes the focused amount with the type; the
  neutral-values test keeps its `noise 0` expectation with the type
  appended.
- `test/plugin-presentation.test.js`: the Focus section gains a single row
  `Noise type` after the `Noise` matrix row.
- `integrations/noctalia-plugin/plugin_test.lua`: the row count for the new
  single row in a section that also holds matrix rows.
- The full `npm test` suite passes.

## Rollout

The generated `prism.kdl` fails `niri validate` on a build without the
`type` property, and the niri sink rolls back the fragment on validation
failure. The Prism piece therefore depends on the native piece landing and
being installed first; the goal and the piece both record the dependency.

Manual acceptance after install: with the unfocused pane at its default
amplitude, switch the select through `white`, `fine` and `lightness` and
confirm the grain changes; the native spec's desktop acceptance decides
whether `lightness` stays before this piece exposes it.

## Documentation

- `README.md`: the sentence listing the glass optics names the shared noise
  type.
- `docs/notes/noctalia-plugin-contract.md`: the row list gains `Noise type`
  as a single row in Focus.
- This document's status when the work lands.

## Non-goals

- A per-state noise type.
- Chroma or hue grain, and blue-noise dithering: considered on 2026-09-06 and
  left out; a new type is a native addition plus one more value in this
  enum.
- Masking noise out of the bevel band (niri-material idea
  `material-f8b6e9`).
- Knob controls or the landscape panel (`prism-686374`).
