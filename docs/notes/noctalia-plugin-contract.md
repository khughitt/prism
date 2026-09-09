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
as panel errors without replacing the last valid model. An error raised by a
command outlives the refresh that command triggers, and only the next gesture
clears it; otherwise the reason a profile would not load flashes past behind
the successful `describe` that follows it. Opening the panel is such a gesture:
the panel runtime survives a close, so an error from one session is dropped on
open rather than greeting the next one behind a model that reconciles fine.

All parameter writes go through the panel's shared FIFO. Each command is
serialized through `noctalia.runAsync`, and the next item starts only after
the current item completes. `set`, `unset`, `pin`, and the profile verbs
`activate`, `deactivate`, `save`, `rename`, and `delete` are the only verbs; anything
else fails loudly rather than reaching another backend. None but `set` and
`unset` write a parameter, but each moves the write target or the resolved
values, so each counts as affecting the model and forces the same refresh a
write does. A queued item may name a follow-up (`activateAfter`), which is
enqueued only once the item itself has landed: the FIFO continues after a
failure, so an unconditional pair would enter a profile whose save never
happened. Parameter batches refresh the model
after the queue drains, except when the completed tail is a live drag sample;
that reconciliation waits for the drag's final write.

The panel tracks live slider samples at 100 ms frame intervals and always
emits a final non-sample write on release. Release-mode sliders emit only that
final write. Every parameter with a non-`live` binding resolves to
`effectiveDrag = "release"`, so the reload-bound native material parameters
write once on release and rewrite the compositor config once per gesture. A describe started before or during a drag is discarded when its
result is stale and replayed only after the drag and write queue are idle.

Noctalia API 22 exposes slider `step`, `onChange`, and `onDragEnd`, but no
interaction-source callback. Normalized-display sliders and curved (logarithmic
or power) sliders retain a zero presentation step for pointer mapping. On release, the panel recognizes the
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
  `ui.order`, except the group `describe` names in `rack.group`, which is
  drawn as the rack. Sections are always open; there is no Quick group.
  Each section shows a reset that removes every override its parameters hold
  in the write target, dim while the section holds no overrides.
- The rack is one card per device in `rack.devices` order. A card's head is a
  light, a chevron, and the device name, in the same fixed span as every other
  head cell; then the mix row's focused and unfocused cells. The name is a
  ghost text button whose hover tooltip carries the mix description. Clicking
  the card title or chevron toggles details; ordinary parameter names remain
  hover-only. The light is a glyph: `circle-filled` in the category color
  while active, `circle` in `on_surface_variant` while the device's bypass key
  is true, `circle` in the category color while the device it `requires` is
  bypassed. Clicking the light sets the bypass key. The chevron expands the
  card; expansion is panel memory keyed by device id and lasts the shell
  session. Expanded, the card lists the bypass key as an ordinary single row
  (with the per-parameter reset that issues `unset`), then its detail matrix
  rows, then its shared single rows, all indented. A bypassed card dims. A
  model without `rack`, a device naming a row or key the group does not
  carry, or a visible parameter in the group that no device claims is a
  contract error and shows as the banner.
- A toggle flagged `ui.header` is its section's header control (the Focus
  section's focus-state toggle). A group may carry at most one.
- Sliders flagged `ui.state` (`focused` or `unfocused`) and `ui.row` pair into
  a matrix row: one label, the focused control on the left, the unfocused on
  the right, under `Focused` / `Unfocused` column labels. A row with a missing
  or duplicated state, or one that spans sections, is a model error.
- Every other visible parameter is a single row: its name with the same help
  behavior, the formatted value, the native control, and a per-parameter reset
  that removes the override in the write target and shows the fallback value
  until describe reconciles. Plain matrix rows use the same name/help control.
- Row geometry is fixed and independent of parameter state. Names and
  formatted values occupy reserved widths, the two matrix cells divide the
  remaining span evenly, and the `Focused` / `Unfocused` titles reserve the
  same leading span and horizontal inset as the rows they head. Value labels
  sit in fixed-width layout containers because the native label reconciler
  ignores `width`; the value column stays present even for non-slider cells.
  Sized spacers explicitly disable growth so indentation and header spacing
  cannot consume the space reserved for names and controls. Every reset stays in
  the tree, dim when its parameter holds no override and full strength when it
  is overridden; nothing appears or disappears as a value crosses its default.
- Toggle, select, slider, color, and reset actions update the local displayed
  value before their required write boundary.
- Only exceptional rows carry a marker, and one row can hold two parameters on
  different layers, so the marker is chosen across the whole row in a fixed
  precedence: `Unavailable` for a parameter with no consumer at all, whose
  control is also disabled; then the shadow hint; then `Live` for a parameter
  that writes while dragging. A `Live` marker on one matrix cell never crowds
  out a shadow on the other. Writing on release is the norm and is left
  unmarked.
- A parameter is *shadowed* when its `layer` ranks above `target` in `layers`:
  the control still writes, but into a layer the shadowing one covers, so the
  gesture has no visible effect. A shadowed cell dims; a matrix row's label
  dims only when both of its cells are shadowed. The hint names the covering
  layer and offers advice only where advice exists — `Overridden by wallpaper;
  pin to edit`, but a bare `Overridden by state`, since pinning the wallpaper
  cannot lift it above a state layer. Writing under a shadow does not mark the
  row overridden: the write lands in the target, which is not where the value
  comes from, so there is still no override on that row to reset.
- The panel draws a profile row above the sections, and above the wallpaper
  header because a profile outranks a wallpaper: a selector, a save button, a
  rename button, and a delete button. The selector doubles as the clear control — index 0 is
  `No profile`, which deactivates. It is deliberately not "base values":
  deactivating leaves the wallpaper layer active, so what is on screen may
  still come from it, and only the write target returns to base. Save opens a
  name field (`ui.input`, `submitOnEnter`), validates the name against the
  store's rule locally rather than spending a failed command on it, then saves
  and enters the new profile. A name that already belongs to another profile
  is not replaced silently: the name field gives way to a question row
  (`Replace profile <name>?`, a destructive button, a cancel), because Noctalia
  has no dialog. Saving the loaded profile under its own name asks nothing,
  since every edit already lands there. Rename and delete carry the reset
  idiom: dim and inert with nothing loaded, live once a profile is, and both
  act only on the loaded profile — deleting or renaming another one means
  selecting it first, which loads it. That is intended: the row acts on what
  is on screen, and the selector makes every profile reachable. Rename opens
  the same name field seeded with the current name and runs `prism context
  rename`; a taken name is refused locally, the way the store refuses it, and
  the same name closes the field. Delete asks first in the same question row
  (`Delete profile <name>?`). Opening the name field drops a pending question
  and a question drops the field, so at most one occupies the row.
- When a wallpaper is active the panel draws a header row above the sections:
  its basename, the count of visible parameters it holds, and a pin button that
  runs `prism context pin|unpin wallpaper`. A loaded profile is always topmost
  and blocks the pin; the button is then greyed by opacity and guarded in its
  handler, never disabled, because Noctalia gates a Button's hit area on
  `enabled` and the tooltip lives on that hit area — a disabled pin could not
  say why it is unavailable. A Noctalia toggle takes no `tooltip` prop at all,
  which is why the pin is a button and why shadowed toggles carry a visible
  hint label instead. With no active wallpaper there is no header row.
- Numeric controls preserve canonical values while supporting raw, percent,
  and normalized display metadata on linear, logarithmic, and power (`exponent`)
  scales; a curved scale shapes the track and the display only the label. The
  formatted value renders beside the native slider.

`prism describe --json` carries `active` (the active context per kind),
`profiles` (the saved profile names, listed in the same locked snapshot as
`active` so the selector cannot disagree with the slot drawn beside it),
`layers` (the store's resolution order, low to high), `target` (the
write-target layer), `rack` (the validated device order and ownership), and
`params`, whose entries include `layer` (where the value comes from) and
`fallback` (what `unset` would leave). A parameter is overridden when
`layer == target`; the reset is always present and shows full strength exactly
then. The panel ranks a layer against the target with `layers` rather than
carrying its own copy of the order, so a layer added to the store reaches the
panel without a second list to keep in step.

The panel is installed into Noctalia separately from the `prism` command, so
the two must be upgraded together. The loud failure is one-sided, because every
field the panel needs is one the CLI adds: a newer panel reading an older CLI's
output fails `validateModel` on the first field that is absent — `prism
describe returned no layer order` without `layers`, `prism describe returned
no profile list` without `profiles`, `prism describe returned no write target`
without `target`, `<key> has no layer` without a per-parameter
`layer` — and degrades to the panel's visible-error banner, which is the
correct failure mode. The other direction is quiet: `validateModel` inspects
only the fields it knows and does not reject unknown ones, so an older panel
ignores what a newer CLI adds and keeps rendering under its own older rules,
without shadowing rows it has no order to rank. A user who sees any of those
messages, or a panel that draws no wallpaper header row against a CLI that
reports one, should read it as "the panel and the `prism` command are out of
sync" and upgrade whichever side is behind.

That agreement is checked rather than assumed:
`integrations/noctalia-plugin/contract.test.mjs` spawns `prism describe --json`
against a temporary store, hands the real output to `panel.luau`, and asserts
that `validateModel` accepts it and that every control kind describe emits
draws its row. A field the CLI stops emitting fails there as the validator's own
sentence, so a shape change reads as "the panel and the CLI disagree" instead of
as a patched-by-hand fixture.

The test renders describe output as a Lua literal on one assumption about the
host: that `noctalia.json.decode` maps a JSON null to an absent key. The
installed Noctalia (v5.0.1, verified against `src/scripting/luau_host.cpp` at
the `v5.0.1` tag) confirms it. `jsonToLua` pushes Lua `nil` for every JSON
value outside boolean, number, string, array, and object, null included, and
the object branch then assigns that nil with `lua_setfield`, which deletes the
key. A null field therefore decodes to no field at all, exactly the absent key
`validateModel` and the profile selector read with `== nil`, and the
serializer's null-filtering mirrors the host faithfully. Two edges sit outside
the describe shape: a bare top-level `null` parses successfully into `nil`
with no error, so the panel reports it through its generic "invalid JSON"
fallback, and a null inside an array leaves a hole (`lua_rawseti` with nil),
which would corrupt a length count; describe's arrays carry only strings and
device ids, so neither edge can occur in practice.

The shipped panel has a `Glass` section for parameters both focus states share,
a `Focus` rack with eight device cards in shader order, and a `Terminal` matrix
for the focused and unfocused opacity pair. Each rack card keeps its mix row
visible and reveals its bypass, detail rows, and shared rows when expanded;
Noise type is the Noise card's shared row and applies to both states.
`debug.backdrop` is CLI-only and does not appear.

The widget and panel use Noctalia's native v5 entries and controls. No
additional runtime dependency or compatibility layer is part of this
contract.
