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
the current item completes. `set`, `unset`, `reset`, `commit`, and the context
verbs `activate`, `deactivate`, `clear`, `rename`, and `delete` are the only
verbs; anything else fails loudly rather than reaching another backend. Only
`set`, `unset`, and `reset` write parameters, but every verb can move what the
layers hold or the resolved values, so each counts as affecting the model and
forces a refresh. Parameter batches refresh the model
after the queue drains, except when the completed tail is a live drag sample;
that reconciliation waits for the drag's final write.

The panel tracks live slider samples at 100 ms frame intervals and always
emits a final non-sample write on release. Release-mode sliders emit only that
final write. Every parameter with a non-`live` binding resolves to
`effectiveDrag = "release"`, so the reload-bound native material parameters
write once on release and rewrite the compositor config once per gesture. A
drag of any effectiveDrag re-renders at most once per host frame tick rather
than once per pointer-move event; a native slider can fire far more often than
the panel can afford to rebuild its tree, and rendering on every event once
exceeded the host's per-callback CPU budget and got the panel disabled until
reload. A describe started before or during a drag is discarded when its
result is stale and replayed only after the drag and write queue are idle.
While the panel is open it asks the host for second ticks and re-reads describe
every two seconds through the same stale-and-replay path, so a wallpaper
rotation reaches the header, the edits row, and every provenance marker within
a period. Each rendered Keep, Save As, Clear, Rename, and Delete action captures
both selected slots before optimistic model changes. The queue sends
`--expect-look <default|profile:name> --expect-wallpaper <none|id:id>`; a stale
action is refused under the store lock and appears in the banner. Selection
commands carry no slot expectation. Both guards are required together; look
`default` differs from a named `profile:Default`, and wallpaper `none` differs
from `id:<id>`. The positional wallpaper id remains checked too.

A genuine ordinary profile selection clears optimistic pending flags before
rendering. Saved pair membership and incoming values come only from the next
accepted describe. One `selectionPending` flag disables and handler-guards
Keep, Clear, Rename, Delete, and Save As until an authoritative, non-invalidated
describe is accepted. Queue drain, command failure, and failed or invalidated
describes do not reopen those actions. Sliders and rapid profile selections
stay enabled: a genuine slider command queued behind selection writes the
incoming look's scratch. Immediate slider model echoes resolve the current
parameter by key before the existing echo check; deferred model callbacks also
produce no writes. Model dropdown updates are silent.

Failed selection or Keep reconciles the real pending count and retains its
error banner. Recovery from an unreadable/broken outgoing named profile or
pair preserves scratch in the backend; accepted describe restores those flags,
even though the optimistic selection cleared them.

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
  Each drawn section (the rack slotted by its header's `ui.order`) carries
  one theme role, cycling `primary`, `secondary`, `tertiary`, on its header
  label and its separator, so a group is findable without reading. The cycle
  outlasts the panel's section count, so no two sections share a color.
  Each section shows revert, neutral, and, where it has matrix rows, symmetric
  buttons. Revert counts keys scratch holds, symmetric counts differing pairs,
  and neutral counts eligible keys away from their neutral. The edits row under
  the wallpaper header carries the edited count, keep-in-look (`prism commit
  profile` under a loaded profile, else `prism commit base`),
  keep-for-wallpaper (`prism commit wallpaper <id>`), and the same three resets
  over every visible parameter. Every reset mode writes scratch; nothing clears
  the profile first. No-op buttons stay in the tree, dimmed and guarded in
  their click handlers.
- The rack is one card per device in `rack.devices` order. A card's head is a
  light, a chevron, and the device name, in the same fixed span as every other
  head cell; then the mix row's unfocused and focused cells, in the matrix's
  column order. The name is a
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
  a matrix row: one label, the unfocused control on the left, the focused on
  the right, under `Unfocused` / `Focused` column labels. A row with a missing
  or duplicated state is a model error. Row identity includes the group, so
  two sections may reuse a row label but cannot supply each other's halves.
- Every other visible parameter is a single row: its name with the same help
  behavior, the formatted value, the native control, and a per-parameter reset
  that reverts the edit (`prism unset`) and shows the fallback value until
  describe reconciles. Plain matrix rows use the same name/help control.
- Row geometry is fixed and independent of parameter state. Names and
  formatted values occupy reserved widths, the two matrix cells divide the
  remaining span evenly, and the `Unfocused` / `Focused` titles reserve the
  same leading span and horizontal inset as the rows they head. Value labels
  sit in fixed-width layout containers because the native label reconciler
  ignores `width`; the value column stays present even for non-slider cells.
  A color cell has no text there, so its column carries a swatch of the
  current value with a faint border that keeps a pale tint visible on a pale
  surface.
  Sized spacers explicitly disable growth so indentation and header spacing
  cannot consume the space reserved for names and controls. Every reset stays in
  the tree, dim when its parameter holds no override and full strength when it
  is edited in scratch; nothing appears or disappears as a value crosses its default.
- Toggle, select, slider, color, and reset actions update the local displayed
  value before their required write boundary.
- Only exceptional rows carry a marker, and one row can hold two parameters
  from different layers, so the marker is chosen across the whole row in a
  fixed precedence: `Unavailable` for a parameter with no consumer at all,
  whose control is also disabled; then `wallpaper` for a value from its nudges;
  then `Live` for a parameter that writes while dragging. Writing on release
  is the norm and is left unmarked. Nothing is shadowed: scratch is the topmost
  layer, so every write shows.
- The panel draws a profile row above the sections and wallpaper header: a
  selector, save, rename, and delete. Index 0 is `Default`, the unnamed base
  look. A pick is optimistic, like a slider edit: the rendered index follows
  the pick while describe reconciles after the command. Ordinary selection,
  including Default, saves all scratch keys to the outgoing pair and shows zero
  pending edits, then loads only the incoming look's pair. With no wallpaper,
  selection discards scratch. First wallpaper activation preserves scratch,
  as does explicit recovery from a broken outgoing named profile or pair.
  Runtime scratch lives in `_scratch` in the state directory's `active.json`.
  Save opens a name field and issues `prism commit profile <name>`, which
  snapshots what is on screen and loads the new profile in one command. It
  replaces the destination's current-wallpaper pair while retaining its other
  pairs, so the saved snapshot cannot be overridden by its old pair. Saving
  the loaded profile under its own name issues `prism commit profile` when
  there are edits and closes the field otherwise. A name already in use opens
  a replace question that issues the same commit. The field uses `ui.input`
  and a check button so mouse users can submit it; it validates names locally.
  Rename and delete act on the loaded profile. Rename opens the same name
  field and issues `prism context rename`; delete asks for confirmation. A
  confirmed delete removes the loaded profile document, including all its
  wallpaper pairs, selects Default, and preserves scratch. Ordinary selection
  saves pending edits to the outgoing pair when a wallpaper is active.
- When a wallpaper is active the panel draws a header row above the sections:
  a glyph lit while the selected look–wallpaper pair holds any visible key,
  the count (`N for Aurora + this wallpaper`, or `N for Default + this wallpaper`),
  and a clear button that runs
  `prism context clear wallpaper <id>` with the id from the model. The basename
  is the glyph's tooltip. Keep reads `Keep N edits for <look> + this wallpaper`;
  Clear reads `Clear <look> + this wallpaper's N adjustments`. Saved pair keys
  and saved profile settings never count as pending edits. CLI-only keys stay
  outside visible counts and resets; transitions and commits save all keys.
  Clear removes only the active pair and preserves scratch and other pairs.
  With no active wallpaper there is no header row.
  `prism context list` discovers pairs in all looks; `prism context show
  wallpaper <id> --look profile:<name>` inspects an inactive pair, while
  `--look default` names the unnamed look.
- Numeric controls preserve canonical values while supporting raw, percent,
  and normalized display metadata on linear, logarithmic, and power (`exponent`)
  scales; a curved scale shapes the track and the display only the label. The
  formatted value renders beside the native slider.

`prism describe --json` carries `active` (the active context per kind),
`profiles` (the saved profile names, listed in the same locked snapshot as
`active`), `layers` (`default, base, profile, wallpaper, state, scratch`
in resolution order), `rack` (the validated device order and ownership),
and `params`. Each parameter includes `layer` (where the value comes from),
`held` (the layers that hold the key, in resolution order, never default),
and `fallback` (what revert would reveal). The row reset is always present
and shows full strength when scratch holds the key. Visible parameters declare
exactly one of `neutral` or `neutralize: false`, next to `default`;
`glass.focusSplit` is the exemption. Neutral counts ignore exempt parameters
and compare scalar values exactly (including color case). Matrix halves
declare equal neutrals, validated at definition load. The panel uses the
reported `layers` order rather than carrying its own copy.

The panel is installed into Noctalia separately from the `prism` command, so
the two must be upgraded together. A newer panel reading an older CLI's output
fails `validateModel` on the first field that is absent — `prism
describe returned no layer order` without `layers`, `prism describe returned
no profile list` without `profiles`, `<key> has no held layers` without a per-parameter `held`,
`<key> has no layer` without a per-parameter `layer` — and degrades to the panel's visible-error banner, which is the
correct failure mode. An older panel reading the newer CLI also fails
validation: it requires `model.target`, which the newer CLI no longer emits,
and reports `prism describe returned no write target`. A user who sees either
validation error should read it as "the panel and the `prism` command are out
of sync" and upgrade whichever side is behind.

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

The shipped panel has a `Glass` section for parameters both focus states share
and a `Focus` rack with eight device cards in shader order. Each rack card
keeps its mix row visible and reveals its bypass, detail rows, and shared rows
when expanded; Noise type is the Noise card's shared row and applies to both
states. The terminal opacity pair and `debug.backdrop` are CLI-only and do not
appear: the glass owns terminal focus state, so the panel does not offer the
sliders, while the kitty sink still binds them and `prism set` still writes
them.

The widget and panel use Noctalia's native v5 entries and controls. No
additional runtime dependency or compatibility layer is part of this
contract.

## Same-look activation and desktop acceptance

`prism context activate profile Aurora` explicitly selects Aurora even if it is
already active; `prism context deactivate profile` similarly selects Default.
These commands save every scratch key to the current pair and clear pending
edits, or discard scratch when no wallpaper is active. No visible edit-count
condition gates the CLI transition.

The installed native dropdown suppresses a same-option click unless its
`notifyOnReselect` capability is enabled. Noctalia does not expose that property
to Lua; changing Prism's callback cannot create the event. Programmatic
`selectedIndex` updates are silent. Existing Keep for wallpaper saves the
current pair without a new control. Idea `prism-02befb` tracks the native
property separately; simulated Lua callbacks do not prove physical reselection.

Desktop acceptance remains with `prism-439774`, using
[the pair acceptance record](2026-09-20-profile-wallpaper-pairs-acceptance.md).
Automated checks use temporary stores; they do not establish desktop results
or authorize live migration/plugin reload as part of coding.
