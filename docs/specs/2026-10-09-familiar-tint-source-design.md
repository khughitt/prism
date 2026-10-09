# Familiar as a glass tint source

**Date:** 2026-10-09
**Status:** draft, awaiting owner review
**Task:** `prism-1bb833`, under goal `prism-980a29`
**Upstream:** niri-material `material-6f45a0` (done): response field `accent-tint`;
design in niri-material `docs/specs/2026-10-03-accent-tint-design.md`, reference in
its `docs/materials/material-config.md`.
**Builds on:** [ring axis and source-aware colors](2026-10-03-ring-axis-and-source-aware-colors-design.md)
(the `ui.when` gate and the effective-color report), which left room for this
value.

## Intent

`glass.ring.colorSource` already offers `familiar`: each terminal's ring takes its
agent session's hue, and a window without a session rests on the manual Color. The
glass tint offers only `noctalia` and `manual`. This change adds `familiar` to
`glass.tintSource`, so each terminal's glass body takes its session's hue too, and a
window without a session rests on the manual focused and unfocused tints.

Success:

- `glass.tintSource` values are `[familiar, noctalia, manual]`.
- Under familiar, the generated KDL keeps the stored manual tints as each material's
  `attenuation-color` and sets the response's `accent-tint` to a prism weight, so
  niri tints each window toward its own signal accent.
- The weight can differ between focused and unfocused glass, like every other
  Focus optic.
- Every output under `noctalia` and `manual` is unchanged, byte for byte.

## What upstream provides

From the accepted niri-material design:

- `accent-tint` is a response field, 0–1, default 0 (off). The weight is both the
  switch and the amount.
- It is independent of `accent "ring"|"none"`: the ring's accent band and the glass
  tint are separate controls. Prism's ring source (`familiar` emits
  `accent "ring"`) needs no change.
- It moves hue and saturation toward the window's accent and keeps the face's
  luminance over a neutral backdrop, so dark glass stays dark. Near-white glass has
  little room for hue at its own luminance, so the tint barely shows on light
  glass, the default `#dfe8ff` included. On dark glass the recommended weight is 1.
- Without an accent (a window with no session) the glass is exactly its configured
  `attenuation-color`.
- Being a response field, it can differ per material. Prism's focus split emits two
  materials, so each can carry its own weight.

## Parameters

| Key | Type | Default | Neutral | UI |
|---|---|---|---|---|
| `glass.tintSource` | enum `[familiar, noctalia, manual]` | `noctalia` (unchanged) | `manual` (unchanged) | select, unchanged |
| `glass.accentTint` | float 0–1, step 0.01, percent | 1 | 0 | Focus, row "Session hue", state focused, order 245 |
| `glass.inactive.accentTint` | float 0–1, step 0.01, percent | 1 | 0 | Focus, row "Session hue", state unfocused, order 246 |

Both halves of the row carry
`when: {param: glass.tintSource, in: [familiar], otherwise: hidden}`, as
Palette accent mix carries `in: [noctalia]`.

The default stays `noctalia`: adding a value does not change any existing look. The
weight's default of 1 is upstream's dark-glass recommendation. It only takes effect
once someone selects familiar, and on the default light glass it shows little,
which the description says.

Descriptions:

- `glass.tintSource`: names all three sources. Familiar tints each terminal
  toward its agent session's hue and rests windows without a session on the
  manual tints.
- `glass.accentTint` and its twin: under the familiar source, how far each
  terminal's glass moves toward its session's hue. It changes hue and saturation
  and keeps darkness over a neutral backdrop. It barely shows on light glass, and
  0 leaves the manual tint.
- The two tint colors: under familiar they are the resting tint, shown read-only.

**Rejected: reusing `glass.tintAccentMix`.** The two weights do different things.
Palette accent mix is a linear sRGB blend of the palette primary into its surface,
default 10%. Session hue is niri's luminance-preserving shift toward a per-window
accent, recommended at 100%. One key would make a look's Noctalia mix and its
familiar weight move together. `prism-9bbe0a` is also about to give
`glass.tintAccentMix` an unfocused twin with its own semantics.

**Rejected: one weight shared by both states.** It is simpler, but it would be the
only optic in the Tint card that cannot differ by focus. Upstream supports a
weight per material at no cost. Under an unsplit material the focused weight
applies, as with every twin.

## Picker visibility

The tint pickers keep `when: {param: glass.tintSource, in: [manual], otherwise:
effective}`, as the 2026-10-03 spec decided for this task. The ring's Color does
the same under familiar. Under familiar each tint cell shows its stored color as a
read-only swatch. Changing a resting tint means selecting manual, editing, and
selecting familiar again.

## Render (`integrations/niri/render.js`)

- **`sourceColors`.** Under familiar, with glass enabled and tint not bypassed,
  it reports each tint key with its own stored value:
  `{value: params['glass.attenuationColor'], from: "the resting tint; each agent session's hue tints it on its window"}`,
  and likewise for `glass.inactive.attenuationColor`. Unlike Noctalia, the two
  states keep their own colors. The effective report and the panel swatch read
  this unchanged. A bypassed tint or disabled glass reports nothing, as today.
- **`responseBlock`.** It gains the material's prefix, `glass.` or
  `glass.inactive.`. When the tint source is familiar and tint is not bypassed, it
  emits `accent-tint <params[prefix + 'accentTint']>`, placed after `accent`.
  Otherwise it emits no `accent-tint` line. niri's default is 0, so leaving the
  line out keeps every noctalia and manual output identical to today's. It also
  keeps a config that never selects familiar loadable on a niri without the
  field. The unsplit material uses the focused prefix. The inactive material
  under the split uses the inactive one.
- **Bypass.** The tint device's dry value already forces `attenuation-color`
  white. Under a bypassed tint `accent-tint` is not emitted either, so "bypass
  Tint" means no tint at all, session hue included.
- **`attenuation-color`.** Under familiar, `glassFor` already takes the stored
  manual value per state, because `sourceColors` reports that same value. The
  emitted color equals the stored one.

## Apply and probe

- **Apply** (`integrations/niri/apply`). Familiar tint reads no palette. The
  palette is read only for a noctalia tint or a noctalia ring, as today. The
  palette remedy texts (`palette.js` and the missing-palette error in `apply`)
  now say "select manual or familiar tint" where they say "select manual tint".
- **Probe** (`integrations/niri/probe-material`). It renders with
  `glass.tintSource: familiar` instead of `manual`. The probe stays independent
  of the host palette, and it now covers `accent-tint` in both materials. A niri
  older than `material-6f45a0` then fails the capability probe with its existing
  fix line rather than at apply time. That fix line is "install or update
  niri-material". This holds while the probe's rule stands: render it from the
  defaults so that every property prism can emit is probed.

## Panel and rack

- **Rack.** `defs/rack/devices.yaml`: the tint device's `rows` gains
  `Session hue`. A `hidden` gate on a non-mix row is already supported: the row
  drops from the expanded card. `shared` is unchanged.
- **Manifest.** `integrations/niri/manifest.yaml` binds both new keys with
  `liveness: reload` and no `node`. Like the ring's keys, they write a response
  field, not a glass node, so the rack's stage-ownership rule does not apply to
  them.
- **Panel code.** None. The select lists the def's values, and the gate and the
  read-only swatch exist.

## Documentation

The README's Noctalia palette section moves its source paragraph into a short
"Glass tint" subsection. That subsection lists the three sources, says what Session
hue does, and notes that the tint barely shows on light glass. It also says
familiar needs no palette, and that tint bypass removes the session hue too. The
`prism set` examples gain `glass.tintSource familiar` and `glass.accentTint 1`.

## Out of scope

- A familiar hue over a Noctalia resting tint, i.e. combining sources. Familiar
  rests on the manual tints, as the ring rests on its manual Color.
- Starter profiles. They select manual tint and do not set the new keys, which
  resolve to their defaults and do nothing under manual.
- `prism-9bbe0a`'s Palette accent mix twin, and `prism-1b7231`'s ring Accent
  strength visibility.

## Testing

- **Defs** (`test/glass-defs.test.js`). The enum's values. The new keys' range,
  default, neutral, `ui` row and state, and `when`. The tint pickers' `when` is
  still `[manual]`. The Prism-only key whitelist now includes both new keys, and
  the neutral table includes their 0.
- **Render** (`test/niri-render.test.js`):
  - Under familiar, unsplit: the material's `attenuation-color` is the stored
    focused tint, and the response carries `accent-tint` with the focused weight.
  - Under familiar, split: each material carries its own tint and its own weight.
    Distinct weights show up as distinct lines.
  - Under familiar with tint bypassed: white attenuation and no `accent-tint`.
  - Under noctalia and manual: no `accent-tint` line. The existing golden
    outputs are unchanged.
  - `sourceColors` under familiar reports both keys with their own stored values
    and the familiar `from`. It reports nothing when bypassed or with glass off.
- **Apply** (`test/niri-apply.test.js`). The source matrix gains familiar rows. A
  broken or missing palette applies under familiar tint with a manual or familiar
  ring. A noctalia ring still needs primary. The effective report under familiar
  matches the KDL.
- **Probe.** The rendered probe fragment contains `accent-tint` in both materials.
- **Rack and presentation** (`test/rack.test.js`,
  `test/plugin-presentation.test.js`). The tint device's rows include Session hue.
  The shipped `when` table includes the new row.
- **Panel** (`contract.test.mjs`, `plugin_test.lua`). For each of the three
  sources, the Session hue row shows only under familiar, Palette accent mix only
  under noctalia, and the tint cells are pickers only under manual and read-only
  swatches otherwise.
- **Live check, owner-judged.** With familiar selected on a dark look, apply.
  Each terminal with an agent session should show its hue in the glass body, and a
  terminal without one should keep its manual tint. This takes the live desktop,
  so it is asked for at that moment and not run unattended.
