# Glass noise and saturation per focus state

**Date:** 2026-09-05
**Status:** accepted 2026-09-05; not yet implemented. Hub goal `prism-63dd45`.
Native piece in niri-material, spec
`docs/specs/2026-09-05-material-glass-noise-saturation-params-design.md`.
Prism piece `prism-d0d4cb`, which depends on the native piece being installed.

## Context

The Noctalia panel's Focus section is a matrix: one row per optic that makes
an unfocused terminal recede, with a focused slider on the left and an
unfocused slider on the right (`docs/notes/noctalia-plugin-contract.md`). The
niri sink renders those rows as two materials, `terminal-glass` and
`terminal-glass-inactive`, assigned by `is-active`.

Noise and saturation are missing from the matrix. Native glass composes both
after its optics since niri-material `7c702e58`, but only by inheriting the
global `blur { noise; saturation }` block, and only while `backdrop-blur` is
effective. Prism ships `glass.backdropBlur` off, so its glass gets neither, and
the global block is one value per compositor, so it could never be a focus
row anyway.

Prism keeps the per-window `background-effect` pass inert for material windows
(`integrations/niri/render.js`). Emitting per-state `noise` and `saturation`
through that rule would revive a pass the native design rejected and would
compose beneath the glass instead of after it. It is not an option.

## Decision

niri-material's `glass { }` block gains optional `noise` (0–1) and
`saturation` (0–3). A written value applies regardless of `backdrop-blur` and
`blur { off }`; omission keeps the inheritance behaviour. That is the native
spec's contract and this document does not restate it further.

Prism adds two matrix rows and always writes both parameters into both
material definitions, so its glass no longer depends on inheritance at all.

## Definitions

Four new keys in `defs/glass.yaml`, Focus group, after Directional blur:

| Key | Range | Step | Default | ui |
| --- | --- | --- | --- | --- |
| `glass.noise` | 0–1 | 0.01 | 0 | row Noise, state focused, order 270, display percent |
| `glass.inactive.noise` | 0–1 | 0.01 | 0.02 | row Noise, state unfocused, order 271, display percent |
| `glass.saturation` | 0–3 | 0.05 | 1 | row Saturation, state focused, order 280 |
| `glass.inactive.saturation` | 0–3 | 0.05 | 0.85 | row Saturation, state unfocused, order 281 |

Labels follow the existing rows: `Noise` and `Unfocused noise`, `Saturation`
and `Unfocused saturation`. Descriptions say what the value does to the glass,
not how niri implements it.

The defaults keep the focused pane exactly as it renders today (neutral noise
and saturation) and let the unfocused pane recede a little: niri's own default
grain and a slight desaturation. They are starting points for the panel, not a
tuned look.

These keys are new names. The retired `terminal.noise.*` and
`terminal.saturation.*` keys in `test/glass-defs.test.js` stay retired; they
described the old background-effect pass, not glass optics.

## Sink

`integrations/niri/render.js`:

- `activeGlass` and `inactiveGlass` carry `noise` and `saturation`;
- `definition` writes `noise <v>` and `saturation <v>` after `roughness`, in
  both materials, unconditionally.

`integrations/niri/manifest.yaml` binds the four keys with `liveness: reload`.

`glass.backdropBlur`'s description drops the claim that the blur block
supplies saturation and noise; it now supplies only blur strength. The
assertion on that description in `test/glass-defs.test.js` changes with it.

## Panel

No Lua change beyond what the definitions drive: `presentation.luau` already
pairs `ui.row` and `ui.state` into matrix rows and errors on a half-filled row.
The panel gains two rows. Width was set for two sliders per row and does not
change.

## Tests

- `test/glass-defs.test.js`: the four keys in the range and default table, the
  Noise and Saturation entries in the matrix-row table, the revised
  backdrop-blur description assertion.
- `test/niri-render.test.js`: both material definitions contain `noise` and
  `saturation` lines with the focused and unfocused values; the single-material
  path (split off) writes the focused pair.
- `test/plugin-presentation.test.js`: the Focus row order gains Noise and
  Saturation.
- `integrations/noctalia-plugin/plugin_test.lua`: row count and pairing for the
  two new rows.
- The full `npm test` suite passes.

## Rollout

The generated `prism.kdl` fails `niri validate` on a niri build without the
new grammar, and the niri sink rolls back the fragment on validation failure.
The Prism piece therefore lands only after the native piece is installed on the
machine that runs `prism apply`. The task dependency records this.

Manual acceptance after install: move noise and saturation sliders in the
panel, confirm the unfocused terminal changes and the focused one does not,
then swap focus and confirm the opposite.

## Documentation

- `README.md` line listing the `glass.inactive.*` optics gains noise and
  saturation.
- `docs/notes/noctalia-plugin-contract.md` row list gains Noise and
  Saturation.
- This document's status and task ids when the work lands.

## Non-goals

- Owning niri's global `blur { }` block.
- Per-window `background-effect` emission.
- Additional noise types (`prism-d6b600`).
- Knob controls or the landscape panel (`prism-686374`).
