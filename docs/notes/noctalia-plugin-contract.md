# Noctalia v5 plugin contract

This note records the public contract implemented by
`integrations/noctalia-plugin/`.

## Identity and entries

```text
canonical id: khughitt/prism
widget entry: khughitt/prism:widget
panel entry: khughitt/prism:panel
plugin API: 22
backends: prism, qs -c niri-glass
preview side: left
production core tests: npm run test:plugin-lua
```

The declarative plugin descriptor is `plugin.toml`. It declares one widget,
`widget.luau`, and one attached panel, `panel.luau`, with the canonical
qualified entry names above. Its runtime dependencies are the `prism` command
and the `qs` command; the production plugin runs inside Noctalia.

The bar widget stores the originating output before opening the qualified
panel entry. The panel falls back to Noctalia's focused output only when no
originating output is available. Preview IPC always uses the left side:

```text
qs -c niri-glass ipc call prismGlass showPreview <output> left <true|false>
qs -c niri-glass ipc call prismGlass hidePreview
```

## Module tests

`npm run test:plugin-lua` runs the production presentation, queue, and shell
modules directly with standard Lua. It checks the canonical presentation
vectors, canonical slider values, serialized write and preview ordering,
left-sided preview arguments, refresh policy, and shell quoting. `npm test`
includes this direct check after the Node suite.

## Panel lifecycle and queue ownership

The panel owns its rendered model and lifecycle state. `onOpen` starts an
authoritative `prism describe --json`; invalid JSON, malformed models,
timeouts, launch failures, non-zero exits, and truncated output remain visible
as panel errors without replacing the last valid model.

All parameter writes and preview IPC go through the panel's shared FIFO. Each
command is serialized through `noctalia.runAsync`, and the next item starts
only after the current item completes. Parameter batches refresh the model
after the queue drains, except when the completed tail is a live drag sample;
that reconciliation waits for the drag's final write. Preview items do not
affect Prism parameters, while a final parameter write followed by preview
cleanup remains refreshable.

The panel tracks live slider samples at 100 ms frame intervals and always
emits a final non-sample write on release. Release-mode sliders emit only that
final write. A describe started before or during a drag is discarded when its
result is stale and replayed only after the drag and write queue are idle.

Closing the panel clears drag frame ticks and enqueues `hidePreview` through
the same FIFO. Panel-runtime survival after close is verified live before
cutover; it is not promised by lint or manifest metadata.

## Declarative presentation

The presentation module defines the panel's stable grouping contract:

- `Title` contains exactly one visible toggle and supplies the title control.
- `Quick` is the first, always-open body group.
- Other groups retain expansion state, show modified counts, and expose group
  resets.
- Toggle, select, slider, color, and reset actions update the local displayed
  value before their required write boundary.
- Controls without `ui.affectsPreview = true` stay enabled while Preview is
  open, are dimmed, and are marked `Not in preview`.
- Numeric controls preserve canonical values while supporting raw, percent,
  normalized, linear, and logarithmic display metadata.

The widget and panel use Noctalia's native v5 entries and controls. No
additional runtime dependency or compatibility layer is part of this
contract.
