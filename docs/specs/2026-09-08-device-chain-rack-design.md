# Device chain: the rack presentation and per-device bypass

**Date:** 2026-09-08
**Status:** design approved in conversation; not implemented.
Revised 2026-09-09 after review: the rack file moves out of the defs scan,
every bypass gets an individual reset, and Refraction's bypass also silences
the two devices that ride its taps.
**Task:** `prism-9331c1`, first piece of goal `prism-a03862`

## Context

The Prism bus is a flat map of scalar parameters
([`2026-08-15-prism-visual-bus-design.md`](../superpowers/specs/2026-08-15-prism-visual-bus-design.md)),
and the Noctalia panel renders the glass optics as a Focus matrix: one row per
optic, a focused and an unfocused control each
([`2026-09-05-glass-noise-saturation-focus-state-design.md`](2026-09-05-glass-noise-saturation-focus-state-design.md)).
The material shader in niri-material applies those optics in one fixed,
documented order (its `docs/materials/render-pipeline.md`, stages 0 to 12):
backdrop source, distortion of the normal, refraction taps carrying fringing
and directional blur, Beer-Lambert tint, the emissive ring, saturation, then
noise. Nothing in Prism names that order; the matrix sorts rows by a global
`ui.order` number.

Goal `prism-a03862` reframes the bus as a device chain after the insert
chains of DAWs: an ordered rack of devices, each with a mix that is always
visible, its other parameters behind an expander, a bypass, and a light
colored by category. This document designs the first piece: the rack as a
presentation of the optics that exist today, plus a real bypass per device.
It adds no new optic, changes nothing in niri-material, and keeps every value
on the bus a flat scalar. Stacking several noise generators, treating focus
as a modulation source, and reordering devices are later pieces of the goal
and are out of scope here.

## Decisions

- **The rack is data in `defs/`, not knowledge in the panel.** A new
  `defs/rack/devices.yaml` lists the devices in shader order and says which matrix
  rows and shared keys each one owns. `prism describe --json` carries it as
  `rack`. The panel keeps naming no parameter keys.
- **A device's mix is one of its existing rows.** No synthetic mix parameter
  is added. For gain-like optics the mix is the amount; for Tint it is the
  color; for Backdrop it is Blur. The mix row is the one the card always shows.
- **Bypass is a real parameter with memory.** One bool per device,
  `glass.bypass.<device>`, shared by both focus states. The mix keeps its
  number while bypassed, so switching a device back on restores it exactly.
  The bus stays flat; the keys layer, profile, reset, and shadow like any
  other value.
- **The niri sink owns the dry values.** What "off" means in KDL is a property
  of the material, so the renderer holds the table from bypass key to the
  fields it overrides. The rack file does not carry dry values. A test pins
  the two tables to the same device set.
- **The slab frame and pane motion are not devices.** They are shared
  geometry, deliberately without per-state twins because the focus swap is a
  hard cut. They stay in the Glass section.
- **Terminal opacity leaves the Focus group.** It is a kitty sink parameter,
  not a glass stage, and it moves to a new Terminal group rendered as a plain
  matrix. `prism-4fc91d`, which hides those sliders, is unaffected.
- **Nothing reserved speculatively.** No `light` category for the ring of
  light, no order field for drag reordering, no per-layer noise slots. Each
  arrives with its first consumer.

## Section 1: devices and the rack file

### The device table

| # | Device id | Label | Category | Mix row | Detail rows | Shared keys | Bypass key | Requires |
|---|---|---|---|---|---|---|---|---|
| 1 | `backdrop` | Backdrop | source | Blur | Frosted backdrop | | `glass.bypass.backdrop` |  |
| 2 | `distortion` | Distortion | geometry | Distortion | Distortion detail | | `glass.bypass.distortion` |  |
| 3 | `refraction` | Refraction | optic | Refraction | Depth | | `glass.bypass.refraction` |  |
| 4 | `fringing` | Fringing | optic | Fringing | | | `glass.bypass.fringing` | refraction |
| 5 | `directionalBlur` | Directional blur | optic | Directional blur | | | `glass.bypass.directionalBlur` | refraction |
| 6 | `tint` | Tint | optic | Tint | Tint distance | | `glass.bypass.tint` |  |
| 7 | `saturation` | Saturation | post | Saturation | | | `glass.bypass.saturation` |  |
| 8 | `noise` | Noise | post | Noise | | `glass.noiseType` | `glass.bypass.noise` |  |

The order is the shader's. Fringing and directional blur are gains inside the
refraction taps, so they sit directly after Refraction and declare that they
require it: with the index of refraction at 1 the depth-jittered taps all
sample one point, so directional blur has nothing to smear, while the green
and blue channels of fringing keep an index above 1 and would still refract.
Bypassing the carrier therefore silences both, in the sink and in the panel. Tint's mix is the
color rather than the distance: distance is inverted (higher is less tint)
and log-scaled, which makes a poor mix, while white is exact identity in the
Beer-Lambert term.

### `defs/rack/devices.yaml`

`loadDefs` reads every `.yaml` file directly inside `defs/` as a list of
params and rejects anything else, so the rack, which is a mapping, lives one
directory down where that scan does not look. `loadDefs` is not changed.

```yaml
group: Focus
devices:
  - device: backdrop
    label: Backdrop
    category: source
    mix: Blur
    rows: [Frosted backdrop]
    shared: []
    bypass: glass.bypass.backdrop
  # ... one entry per row of the table above, in this order
  - device: fringing
    label: Fringing
    category: optic
    mix: Fringing
    rows: []
    shared: []
    bypass: glass.bypass.fringing
    requires: refraction
  - device: noise
    label: Noise
    category: post
    mix: Noise
    rows: []
    shared: [glass.noiseType]
    bypass: glass.bypass.noise
```

`mix` and `rows` name matrix rows by their `ui.row` label. `shared` names
keys that carry no state. `bypass` names a key. `rows` and `shared` may be
empty but must be present. `requires` is optional and names one earlier
device whose bypass also silences this one.

### The loader

A new module `src/rack.js` exports `loadRack(defs)`. It reads
`defs/rack/devices.yaml` and validates, failing the load on the first violation:

- `group` is a non-empty string; `devices` is a non-empty list.
- `device` matches `^[a-z][a-zA-Z0-9]*$` and is unique. `label` is a
  non-empty string. `category` is one of `source`, `geometry`, `optic`,
  `post`.
- Every `mix` and `rows` entry names a matrix row that exists in `group` with
  both a focused and an unfocused param. Every `shared` entry names a visible
  key in `group` with no `ui.state`. Every `bypass` entry names a key in
  `group` of type `bool` with `control: toggle` and no `ui.state`.
- No row or key is referenced by two devices, or twice by one.
- `requires`, when present, names a device that appears earlier in the list.
- Every visible param in `group` other than the group's header toggle is
  referenced by exactly one device. The rack is complete or it does not load.

`loadDefs` stays as it is; `loadRack` runs after it wherever `describe`
builds its model. The two files stay separate because they answer different
questions: a def says what a value is, the rack says where it sits in the
chain.

### New keys in `defs/glass.yaml`

Eight bool params, one per device, `default: false`, `control: toggle`,
group Focus, no `state`, labels `Bypass <device label>`, orders 400 to 470 in
steps of ten, after every existing Focus entry. Descriptions say what the
sink writes while the key is true, for example:

> Silence the noise stage: both materials get noise 0 while set; the Noise
> amounts keep their values

The two terminal opacity params change `ui.group` from Focus to Terminal.
Nothing else in the defs moves; matrix rows keep their `row` labels because
the rack references them by that label.

### `describe --json`

The payload gains a `rack` field:

```json
"rack": {
  "group": "Focus",
  "devices": [
    {"device": "fringing", "label": "Fringing", "category": "optic",
     "mix": "Fringing", "rows": [], "shared": [],
     "bypass": "glass.bypass.fringing", "requires": "refraction"},
    {"device": "noise", "label": "Noise", "category": "post",
     "mix": "Noise", "rows": [], "shared": ["glass.noiseType"],
     "bypass": "glass.bypass.noise"}
  ]
}
```

A device with `requires` carries it as a string; one without omits the
field. It is the validated file verbatim. The panel resolves row labels and keys
against `params` itself; `describe` adds nothing the panel could derive.

## Section 2: bypass through the store and the niri sink

Setting a bypass is `prism set glass.bypass.noise true` and is otherwise
ordinary: it goes to the write target, deletes from base when it equals the
default, resolves, and fans out to the niri sink, which binds all eight keys
with `liveness: reload` in `integrations/niri/manifest.yaml`.

`integrations/niri/render.js` gains a dry table keyed by bypass key. While a
key is true, the listed fields are overridden in both the focused and the
unfocused material:

| Bypass key | Fields written |
|---|---|
| `glass.bypass.backdrop` | `roughness 0`, `backdrop-blur false` |
| `glass.bypass.distortion` | `distortion 0` (scale unchanged) |
| `glass.bypass.refraction` | `ior 1`, `chromatic-aberration 0`, `anisotropic-blur 0` (thickness unchanged) |
| `glass.bypass.fringing` | `chromatic-aberration 0` |
| `glass.bypass.directionalBlur` | `anisotropic-blur 0` |
| `glass.bypass.tint` | `attenuation-color "#ffffff"` (distance unchanged) |
| `glass.bypass.saturation` | `saturation 1` |
| `glass.bypass.noise` | `noise 0` (type unchanged) |

`glassFor` applies the overrides after reading the per-state optics, so the
resolved values on the bus are untouched and only the KDL differs. The
window rules and the slab frame are not affected.

The Refraction entry writes three fields because Fringing and Directional
blur ride the refraction taps: at ior 1 every jittered tap lands on the same
point, so directional blur vanishes on its own, but the green and blue
channels of fringing use an index above 1 and would keep refracting. Zeroing
both makes "bypass Refraction" mean no refraction at all, whatever the two
dependent devices are set to. Their own bypass keys are untouched and their
own dry entries stand.

One coupling is recorded rather than modelled. The renderer's prefilter
level is `roughness` scaled by how far ior sits above 1, so bypassing
Refraction also flattens Blur while frosted backdrop still selects the
blurred source. The Refraction bypass description says so; no `requires` is
declared, because the sink writes nothing for it and the panel would be
claiming a silence that is only partial. Noise type is shared, so bypassing
Noise clears both states' grain; its description says that too.

## Section 3: the panel

The Focus section is rendered as the rack. Its header row is unchanged: the
section name, the Focus-state glass toggle with its label and shadow hint,
and the section reset, which now counts every device param including the
bypass keys. The Focused and Unfocused column header follows. Then one card
per device in rack order.

```
┌ ● Noise           [0.06 ────●──] │ [0.02 ──●────]   ▸ ┐
│     Noise type    [fine ▾]                              │
└────────────────────────────────────────────────────────┘
```

- **Card.** A `ui.column` with a faint category fill and a small radius.
  Four category colors are constants in `presentation.luau`; Noctalia gives
  plugins no theme palette, so they stay constants until a plugin setting
  earns its place. A bypassed card drops to the panel's dim opacity.
- **Light.** A `ui.glyph` in a clickable `ui.row`. Lit in the category color
  while the device is active, grey while its own bypass key is true, and
  hollow (the outline glyph, category color) while it is active but the
  device it requires is bypassed. Clicking the row queues
  `prism set <bypass key> <not current>`, a plain set, whatever the layer.
  It is a glyph in a row because a toggle cannot carry a tooltip and a
  button cannot be colored at the plugin API Prism declares.
- **Bypass row.** The bypass key renders as an ordinary single row at the
  top of the expanded details: label, toggle, and the reset button every row
  has, dim without an override and issuing `prism unset` with one. This is
  the only way to drop a bypass override from a profile or a pinned
  wallpaper without resetting the whole section, because `set` in a context
  layer always persists the value, even `false`. The light and the toggle
  show the same key.
- **Mix cells.** The existing `controlCell` in both columns: formatted
  value, control, reset. Tint's mix cell is the color button. Shadowing and
  dimming stay per cell.
- **Expand.** A chevron `ui.button` per card. Expanded state is a table in
  panel memory keyed by device id: collapsed when the plugin loads,
  remembered across opens within a shell session. When expanded, detail rows
  render as matrix rows and shared keys as single rows after the bypass
  row, all indented under the light, using the current column geometry.
- **Everything else** is untouched: title, profile, and wallpaper rows, the
  Glass section, and the Terminal section rendered as today's matrix.

Presentation logic gains `rack(model)`, a pure function returning the cards
in file order with each row label and key resolved to its params, and for
each card a `silenced` flag that is true when the device it requires has
its bypass key set. It errors
on a row or key the payload does not carry, an unreferenced param in the
rack's group, or a missing `rack` field, and the panel shows that as the
contract banner it already uses. `sections(params)` keeps serving the Glass
and Terminal groups; a group named by the rack is skipped there.

## Section 4: errors, testing, acceptance

Errors follow the existing rule: fail on load, say which device and which
row or key, never guess. A rack that references a row the defs no longer
have fails `prism describe`, and therefore the panel, with a banner naming
it.

Node tests:

- `test/rack.test.js`: one case per validation rule in Section 1, plus the
  shipped file loading cleanly against the shipped defs, and `loadDefs`
  still loading with the rack directory present.
- The existing CLI or describe test: the payload carries `rack` verbatim.
- `test/niri-render.test.js`: the golden gains a case with one device
  bypassed in each category, two cases for Refraction bypassed with fringing
  and directional blur non-zero (both come out zeroed in both materials) and
  with them at zero (the output is the same as the first), and a cross-check that every bypass key in
  `defs/rack.yaml` has a dry entry in the renderer and vice versa.
- `test/glass-defs.test.js`: the matrix table gains no rows; the "shared
  glass" table gains the eight bypass keys; terminal opacity is in group
  Terminal.

Lua tests in `plugin_test.lua`:

- A rack golden vector: cards in file order, mix and details resolved,
  `silenced` set on a dependent while its upstream is bypassed, the three
  error messages verbatim.
- Rendered tree: one card and one light per device, details absent until a
  card is expanded and present after, the bypass row first among them with
  a reset that issues `unset`, the light hollow on Fringing while Refraction
  is bypassed, the bypass click argv, the Terminal
  section still a matrix, and the select and toggle counts updated.

Desktop acceptance is manual: repoint the plugin symlink to the worktree,
reload the plugin, and confirm the lights, expanders, and a bypass round
trip. Hover and drag cannot be automated on this machine.

## Out of scope

- Stacked noise generators and any structured value on the bus.
- Focus as a modulation source collapsing `glass.inactive.*`.
- Reordering devices; the shader order is fixed.
- A ring-of-light device; it arrives with `prism-28e29c`.
- Theme-derived category colors.
