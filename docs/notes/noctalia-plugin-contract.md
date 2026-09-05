# Noctalia v5 plugin contract

This note records the public contract implemented by
`integrations/noctalia-plugin/`.

## Identity and entries

```text
canonical id: khughitt/prism
widget entry: khughitt/prism:widget
panel entry: khughitt/prism:panel
plugin API: 22
backends: prism
feedback surface: live Kitty and Ghostty windows
production core tests: npm run test:plugin-lua
```

The declarative plugin descriptor is `plugin.toml`. It declares one widget,
`widget.luau`, and one attached panel, `panel.luau`, with the canonical
qualified entry names above. Its only runtime dependency is the `prism`
command; the production plugin runs inside Noctalia.

The bar widget stores the originating output before opening the qualified
panel entry. There is no separate preview surface: a write reaches the niri
sink, which regenerates and reloads the compositor's material, so the open
terminal windows are what the panel previews.

## Module tests

`npm run test:plugin-lua` runs the production presentation, queue, and shell
modules directly with standard Lua. It checks the canonical presentation
vectors, canonical slider values, serialized write ordering, refresh policy,
and shell quoting. `npm test` includes this direct check after the Node
suite.

## Panel lifecycle and queue ownership

The panel owns its rendered model and lifecycle state. `onOpen` starts an
authoritative `prism describe --json`; invalid JSON, malformed models,
timeouts, launch failures, non-zero exits, and truncated output remain visible
as panel errors without replacing the last valid model.

All parameter writes go through the panel's shared FIFO. Each command is
serialized through `noctalia.runAsync`, and the next item starts only after
the current item completes. `set` and `unset` are the only verbs; anything
else fails loudly rather than reaching another backend. Parameter batches
refresh the model after the queue drains, except when the completed tail is a
live drag sample; that reconciliation waits for the drag's final write.

The panel tracks live slider samples at 100 ms frame intervals and always
emits a final non-sample write on release. Release-mode sliders emit only that
final write. Every parameter with a non-`live` binding resolves to
`effectiveDrag = "release"`, so the reload-bound native material parameters
write once on release and rewrite the compositor config once per gesture. A describe started before or during a drag is discarded when its
result is stale and replayed only after the drag and write queue are idle.

Noctalia API 22 exposes slider `step`, `onChange`, and `onDragEnd`, but no
interaction-source callback. Normalized and logarithmic sliders retain a zero
presentation step for pointer mapping. On release, the panel recognizes the
host's exact 5%-of-range keyboard/wheel delta and applies one canonical Prism
step; all other values keep the pointer mapping. A pointer release after
exactly that same 5% movement is indistinguishable until Noctalia exposes the
interaction source.

Closing the panel clears drag frame ticks and performs no backend action:
there is no preview state to tear down. Panel-runtime survival after close is
verified live before cutover; it is not promised by lint or manifest
metadata.

## Declarative presentation

The presentation module defines the panel's stable layout contract:

- `Title` contains exactly one visible toggle and supplies the title control.
- Every other `ui.group` is a section, ordered by first appearance in
  `ui.order`. Sections are always open; there is no Quick group and no
  expansion state. Each section shows a reset that clears every modified
  parameter it contains, dim while the section already holds its defaults.
- A toggle flagged `ui.header` is its section's header control (the Focus
  section's focus-state toggle). A group may carry at most one.
- Sliders flagged `ui.state` (`focused` or `unfocused`) and `ui.row` pair into
  a matrix row: one label, the focused control on the left, the unfocused on
  the right, under `Focused` / `Unfocused` column labels. A row with a missing
  or duplicated state, or one that spans sections, is a model error.
- Every other visible parameter is a single row: label, an info button whose
  tooltip carries the description, the formatted value, the native control,
  and a per-parameter reset.
- Row geometry is fixed and independent of parameter state. The label, info
  button, and formatted value occupy reserved widths, the two matrix cells
  divide the remaining span evenly, and the `Focused` / `Unfocused` titles
  reserve the same leading span as the rows they head. Every reset stays in
  the tree, dim when its parameter already holds its default and full strength
  when it is modified; nothing appears or disappears as a value crosses its
  default.
- Toggle, select, slider, color, and reset actions update the local displayed
  value before their required write boundary.
- Only exceptional rows carry a marker: `Live` for a parameter that writes
  while dragging, `Unavailable` for one with no consumer at all, whose control
  is also disabled. Writing on release is the norm and is left unmarked.
- Numeric controls preserve canonical values while supporting raw, percent,
  normalized, linear, and logarithmic display metadata, and render their
  formatted value beside the native slider.

The shipped panel is two sections: `Glass`, the parameters both focus states
share, and `Focus`, the matrix of terminal opacity, blur, tint distance,
fringing, distortion, directional blur, noise, and saturation.
`debug.backdrop` is CLI-only and does not appear.

The widget and panel use Noctalia's native v5 entries and controls. No
additional runtime dependency or compatibility layer is part of this
contract.
