# Ring on the focus axis, and color controls that follow their source

**Date:** 2026-10-03
**Status:** draft for review, round 2 (revised for codex round 1: familiar read-only, bypass omission, report labelled as last apply)
**Tasks:** `prism-4f8bab` (Ring layout), `prism-b4d118` (source-aware color controls), under goal `prism-980a29`
**Leaves room for:** `prism-1bb833` (familiar tint source), which adds one enum value to what this spec defines and reuses its read-only swatch.

## Intent

The panel should say truthfully what each control does. Two places do not:

1. The Focus group lays every optic out as a row with an Unfocused and a Focused
   column. The Ring group is a flat list of thirteen controls, though they act on
   different windows: the focus light shows only on the focused window, while the
   signal accent and the band apply to every window. Nothing in the layout says so.
2. A color control is an editable picker under every source, and its swatch always
   shows the stored manual value. Under the Noctalia tint source that value is not
   what is on screen and editing it changes nothing until the source is manual. The
   descriptions have to explain this ("Picker shows the stored manual focused tint
   under both sources; takes effect on apply only with manual source").

Success: the Ring group reads on the same Unfocused/Focused axis as Focus; a color
picker is offered only under the manual source; every other color cell shows the
color of the last applied config and says where it came from; a control that does
nothing under the current source is not shown.

## Scope

In: the defs `ui` vocabulary (three keys), `prism describe`'s output (one field),
the niri sink (reports the colors it rendered), the Noctalia panel's section and
cell rendering, the Ring and tint defs, and their tests.

Out:

- Per-state ring parameters. The owner chose layout only; any ring setting that
  later proves it should differ between focus states gets its own task.
- The familiar tint source (`prism-1bb833`), blocked on niri-material's
  attenuation-tint response.
- How `render.js` resolves colors. It is reused, not changed.

## Part 1: Ring layout (`prism-4f8bab`)

### Two `ui` keys

- `ui.subgroup: <string>` puts a row under a sub-heading inside its group. Rows of
  one subgroup must be contiguous in `ui.order` within the group; `loadDefs` fails
  otherwise, naming the interloper. A group either gives every visible non-header
  row a subgroup or none.
- `ui.column: focused` places a single-parameter row's control in the Focused
  column and draws a dash in the Unfocused cell. It is the only value: nothing is
  unfocused-only today. It is invalid together with `ui.state`/`ui.row`, and on a
  header toggle. A single-parameter row without `ui.column` keeps today's
  behaviour: one control spanning both columns.

A section draws the Unfocused | Focused column header when it holds any matrix row
or any `ui.column` row (today: any matrix row).

### Ring assignment

The header toggle (Ring of light, `glass.ring.focus`) stays the section header.
New orders keep each subgroup contiguous:

| Subgroup | Row | Key | Placement |
|---|---|---|---|
| Band | Color source | `glass.ring.colorSource` | spans |
| Band | Color | `glass.ring.color` | spans |
| Band | Gap | `glass.ring.gap` | spans |
| Band | Width | `glass.ring.width` | spans |
| Band | Light bending | `glass.lightIor` | spans |
| Focus light | Beam speed | `glass.ring.beamSpeed` | Focused |
| Focus light | Head wander | `glass.ring.beamNoise` | Focused |
| Focus light | Wander rate | `glass.ring.beamNoiseHz` | Focused |
| Focus light | Decay distance | `glass.ring.decay` | Focused |
| Focus light | Glow | `glass.ring.glow` | Focused |
| Focus light | Resting ring | `glass.ring.rest` | Focused |
| Signal accent | Accent strength | `glass.ring.accent` | spans |
| Signal accent | Edge tint | `glass.ring.edgeTint` | spans |

Band comes first because it carries the color, which the eye reads first. The
store keys do not change, so saved looks are unaffected.

## Part 2: Source-aware color controls (`prism-b4d118`)

### `ui.when`

```yaml
ui: {..., when: {param: glass.tintSource, in: [manual], otherwise: effective}}
```

- `param` names an `enum` def; `in` is a non-empty subset of its `values`;
  `otherwise` is `effective` or `hidden`.
- `effective` is valid only on `control: color`. The cell shows a read-only swatch
  of the color the sink reported, with no picker and no reset. Its tooltip names
  where the color came from, in the sink's words, and how to edit it: "From the
  Noctalia palette, as of the last apply. Select the manual source to edit."
- `hidden` drops the row from the panel.
- Both halves of a matrix row must declare the same `when`; `loadDefs` fails
  otherwise.
- The panel evaluates the condition against the named param's `value` in the
  `describe` model it already holds. A write sets the source's value in the model
  at once, so the controls switch on that render; the refresh after the write
  queue drains brings the newly rendered `effective` color.
- Gating is presentation only. A hidden or read-only param keeps its stored value;
  it still counts in edits, neutral counts and every reset, as today.

Applied to:

| Key | `when` |
|---|---|
| `glass.attenuationColor`, `glass.inactive.attenuationColor` | `glass.tintSource in [manual]`, otherwise `effective` |
| `glass.tintAccentMix` | `glass.tintSource in [noctalia]`, otherwise `hidden` |
| `glass.ring.color` | `glass.ring.colorSource in [manual]`, otherwise `effective` |

Only manual edits a color, as the owner asked in `prism-b4d118`. Under familiar the
ring Color still renders, as the resting color of windows without a session, so its
swatch shows that stored color read-only; changing it means selecting manual,
editing, and selecting familiar again. `prism-1bb833` follows the same rule: it adds
`familiar` to `glass.tintSource`'s values and leaves the tint pickers' `in` list at
`[manual]`.

The Tint row is the tint card's mix row, the card's head. The rack draws it with
the same control cell, so the gate covers it with no rack change. A hidden row in a
card's `rows` or `shared` is dropped from the expanded card; a `hidden` gate on a
mix row is refused by the rack loader, since a card has no head without it.

### Where the rendered color comes from

The niri sink reports the colors in the config it installed; core stays ignorant
of Noctalia. The report describes `prism.kdl`, not the screen: it is the config
niri runs after a successful reload, or loads at its next start when the reload
request fails because niri is not running.

- The report is `<stateDir>/effective/niri.json`, one entry per reported key:
  `{"glass.ring.color": {"value": "#rrggbb", "from": "the Noctalia palette"}}`.
  `from` completes the tooltip's "From …, as of the last apply."
- It travels with `prism.kdl` as a pair. The sink writes the report's temp file
  with the KDL's, renames it into place once `niri validate` accepts the KDL, and
  before the reload request. A rejected KDL is rolled back and the old report is
  left untouched, so the pair always describes the same install. A failed reload
  request keeps both, as it keeps the KDL today.
- Each value comes from the computation `render.js` uses, exported from it rather
  than duplicated.
- A key is reported only when its color is resolved from a source and that source
  was read:
  - `glass.attenuationColor` and `glass.inactive.attenuationColor`: glass enabled,
    `glass.tintSource` not manual, and tint not bypassed; the value is the Noctalia
    mix, the same for both. A bypassed tint reads no palette, so a missing or
    malformed palette still applies, exactly as today, and both tint keys are
    omitted.
  - `glass.ring.color`: glass enabled and `glass.ring.colorSource` not manual. Under
    noctalia it is the colorscheme accent, or the stored Color when no palette
    exists (`from`: "the stored Color; no Noctalia palette was found"); under
    familiar it is the stored Color (`from`: "the resting color; each agent
    session's hue replaces it on its window").
- A key the sink does not report is absent from the file, so a manual source, a
  bypass or a disabled glass never leaves a stale color behind.
- `prism describe --json` adds `effective: {value, from}` to a param when any
  `effective/*.json` names its key. Two sinks naming the same key is an error
  naming both files.
- A read-only cell with no `effective` entry draws a hollow swatch with the tooltip
  "No rendered color: the tint is bypassed, glass is off, or prism has not applied
  this source yet." The bypassed tint card is already dimmed, which says which.

The report can lag a write by one apply. It is labelled "as of the last apply"
rather than promised as the screen's current color.

### Descriptions

The three color descriptions drop the "picker shows the stored manual value"
explanation and say what each color is under each source. `glass.tintSource`'s
description is unchanged.

## Testing

- Defs (`test/defs.test.js`): each new key's validation, including a split
  subgroup, `ui.column` with `ui.state`, `when` naming a non-enum or an unknown
  value, `effective` on a slider, and mismatched twins.
- Presentation (`test/plugin-presentation.test.js`): the Ring's subgroups, order
  and placement as tabulated; the shipped `when` table.
- Panel (`plugin_test.lua`, `contract.test.mjs`): a `ui.column` row draws the dash
  cell; the column header appears for a Ring with no matrix rows; each `when`
  outcome renders as specified, both sources for each gated key; `hidden` on a mix
  row is refused.
- Sink and describe (`test/niri-apply.test.js`, `test/cli.test.js`): the report
  matches the rendered KDL for each source; a rejected KDL leaves the previous
  report; a failed reload request keeps the new KDL and the new report together;
  a bypassed Noctalia tint with a missing and with a malformed palette applies and
  omits both tint keys; manual sources and disabled glass report nothing for their
  keys; the familiar ring reports the stored Color; the report reaches `describe`;
  the duplicate-key error.
- Acceptance: the owner opens the live panel once per part, after `just gate`,
  and confirms the Ring layout and the swatches under both tint sources.

## Delivery

Two commits on one branch: Part 1 closes `prism-4f8bab`, Part 2 closes
`prism-b4d118`. `prism-84d308` (panel keys) is open in its own worktree and also
edits `panel.luau`; whichever lands second rebases onto the other.
