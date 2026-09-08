# Prism context layers: design

**Date:** 2026-09-05
**Status:** implemented on `feat/prism-6fd864` at 4bd0ebb, suite passing.
Revised 2026-09-06 for `prism-fc8491`: the write target is the topmost
*explicit* layer and a wallpaper is a target only while pinned; `save` is
for profiles; the wallpaper path is canonicalised.
Revised 2026-09-08 for `prism-3b7c07`: `describe --json` also states the
resolution order as `layers`, and the panel draws the wallpaper header row and
shadows the rows a higher layer covers.
**Task:** `prism-6fd864`, first piece of goal `prism-2f0b4b`; `prism-fc8491`;
`prism-3b7c07`

## Context

A set of glass values that looks right over one wallpaper and colorscheme is
often wrong over another. Goal `prism-2f0b4b` wants three ways to keep values
per situation: named profiles a user saves and loads by hand, wallpaper
profiles that persist whatever was tuned while a wallpaper was showing and
come back with it, and profiles bound to other states Noctalia reports through
hooks. All three are one mechanism, a context layer in the Prism store. This
document designs that layer, its CLI, and the one panel change it forces. The
profile controls in the Noctalia panel and the wallpaper hook wiring are
separate pieces (`prism-ea6344`, `prism-648e0f`, `dots-88dc34`).

Today the store is one flat `values.yaml` per host, symlinked from dotfiles,
resolved as defaults then base values
([`2026-08-15-prism-visual-bus-design.md`](../superpowers/specs/2026-08-15-prism-visual-bus-design.md)).
`set` and `unset` write it under the store lock, resolve, write
`resolved.json`, and fan out to the sinks bound to the changed keys. `get`,
`list`, `describe`, `apply`, and `doctor` all resolve the same way. There is
no layering.

## Decisions

- **Layers are explicit or automatic, and only explicit layers take
  writes.** A profile is loaded by hand, so while it is active a plain
  `prism set`, and therefore every panel slider, writes into it. A wallpaper
  is activated by the shell's wallpaper hook without the user asking, and so
  is the reserved state kind; an automatic layer is an overlay that reapplies
  its delta and never captures edits on its own. With no profile loaded the
  target is base, which keeps global tuning the default even while wallpapers
  rotate. A `--base` flag writes through to the base values file regardless.
- **A pin makes the wallpaper on screen the target.** Pinning is a gesture
  about the current wallpaper: it lives in the runtime slot, the next
  different wallpaper clears it, and loading a profile drops it. Pinning
  while a profile is loaded is refused, so the target is always the topmost
  layer. This is what keeps wallpaper tuning free of a save step without
  making every edit per-wallpaper by accident. (Revised 2026-09-06; the first
  version made any active context the target, which under a hook that
  activates a wallpaper every rotation left base unreachable from the panel.)
- **One slot per kind, layered.** Kinds are `wallpaper`, `state`, and
  `profile`. Each kind has at most one active context. Resolution order is
  defaults, base, wallpaper, state, profile. A wallpaper change never
  disturbs a pinned profile; clearing the profile falls back to the current
  wallpaper context.
- **Overlay files per context; runtime slots in state.** Contexts are flat
  YAML files under the config directory so dotfiles tracks them per host.
  Which contexts are active is runtime state in the state directory.
- **A wallpaper context holds only what was tuned; a saved profile is a full
  snapshot.** Edits accumulate sparsely in a wallpaper context. `save` copies
  every effective parameter so a profile reproduces the saved appearance
  regardless of what the layers below do later.
- **The panel's reset means "remove the override in the write target".** It
  no longer means "back to the default", so the panel gains the two facts it
  needs to show and predict that.

Rejected: a single `contexts.yaml` holding every context and the slots (one
hot file rewritten by the hook, the panel, and hand edits, noisy in dotfiles
on every wallpaper rotation); swapping `values.yaml` by symlink (cannot
compose kinds, and a wallpaper profile would be a full copy of the base);
saving only non-default keys (a profile setting a key back to its default over
a base that differs would not round-trip, and a default-valued key would drift
when a lower layer changed).

## Section 1: storage and resolution

### Files

```
~/.config/prism/values.yaml                  # base, unchanged
~/.config/prism/contexts/profile/<name>.yaml
~/.config/prism/contexts/wallpaper/<id>.yaml
~/.config/prism/contexts/state/<name>.yaml   # reserved; no verb creates one yet
```

Every context file is the same flat key-value YAML as `values.yaml`.

A wallpaper context's `<id>` is a short hash of the wallpaper path. The file
carries the path under a reserved `_source` key so a human can tell which
wallpaper it belongs to. `_source` is the only non-parameter key tolerated,
and only in wallpaper contexts. A wallpaper file is created by the first write
into it, not by activation, so untuned wallpapers leave no file behind as the
rotation cycles through them.

Profile names are restricted to letters, digits, dash, underscore, and dot,
validated on every verb.

### Active slots

One JSON file, `~/.local/state/prism/active.json`, holds at most one entry per
kind. The wallpaper entry carries the path alongside the id, because the file
that would otherwise hold `_source` may not exist yet:

```json
{
  "wallpaper": { "id": "3f9a1c2e", "path": "/path/to/wall.jpg", "pinned": true },
  "profile": "dusk"
}
```

A missing file or a missing kind means nothing is active for that kind. The
`context wallpaper` verb rewrites the wallpaper entry when the id differs and
leaves it alone otherwise, so a second connector reporting the same wallpaper
changes nothing. `pinned` is optional and false when absent; `pin` and `unpin
wallpaper` toggle it, a different wallpaper arrives without it, and `activate
profile` clears it. Activating a profile writes the profile entry and never
touches the wallpaper entry beyond that.

The wallpaper `path` is the canonical path (`realpath`), and the id hashes
that. The same image reached through a symlinked directory is one wallpaper;
a path that does not exist is an error.

### Resolution

The resolver takes the base values plus the ordered list of active context
layers and merges them: defaults, then base, then wallpaper, then state, then
profile. Every layer is validated against the definitions the same way base
values are today, so an unknown or out-of-range key in any layer fails the
whole resolve.

A wallpaper entry whose file does not exist resolves as an empty layer; that
is the untuned wallpaper, the common case. A profile entry whose file does not
exist is an error.

Every reading verb (`get`, `list`, `describe`, `apply`, `doctor`) resolves
through this one path, so a shell read, the panel, and the applied appearance
always agree.

`resolved.json` keeps its current shape, `params` only. No sink changes.

### Write target

The write target for `set` and `unset` is the topmost *explicit* layer: the
active profile if there is one, else the wallpaper if it is pinned, else
base. An unpinned wallpaper and the reserved state kind are overlays and never
targets. With nothing active the target is base, which makes today's
behaviour the degenerate case. Because a pin is refused while a profile is
loaded, the target is always the topmost layer when it is a context.

Under an unpinned wallpaper a key the wallpaper overrides is shadowed: a
`set` to base changes the stored value and nothing on screen. `describe`
reports `layer`, `layers`, and `target`, so the panel dims such rows and points
at the pin (`prism-3b7c07`).

`set` stores the value in the target even when it equals the default, because
the layer below may differ. `unset` removes the key from the target and lets
the layer below show through; `unset` of a key the target does not hold is an
error, since nothing would change and the panel never offers it. The existing
rule that drops a base value equal to the default stays for base only.

The first `set` into a wallpaper context creates its file with `_source` taken
from the active entry's path.

## Section 2: CLI verbs

All new verbs sit under one subcommand so the existing verbs keep their shape:

```
prism context list                       # every context by kind, active ones marked
prism context show <kind> <name>         # the context's contents
prism context save <kind> <name>         # snapshot every effective parameter into a new or replaced context
prism context activate <kind> <name>     # set the slot; the file must exist
prism context deactivate <kind>          # clear the slot
prism context delete <kind> <name>       # remove the file; clears the slot if it was active
prism context pin wallpaper              # make the active wallpaper the write target
prism context unpin wallpaper            # back to base (or the profile)
prism context wallpaper <path>           # canonicalise, derive the id, record id and path in the slot; the hook's entry point
```

`pin` and `unpin` change no effective value, so they never touch
`resolved.json` or a sink; only `describe` sees them. `pin` requires an active
wallpaper and no active profile.

`kind` is `profile` or `wallpaper`. The `state` kind is reserved and rejected
by every verb until the state idea (`prism-9298b9`) is scoped, so nothing
half-works.

`list` and `show` are discovery verbs, and discovery degrades where diagnosis
fails: enumerating what exists never requires every file to parse. `list`
prints a context that does not parse with `!` in the active column and the
reason beside the name, pointing at `doctor`; `show` prints such a file as it
is, with the reason on stderr. `doctor` remains the verb that fails on it.

`activate wallpaper <id>` requires the file so it can copy `_source` into the
slot's path; only `context wallpaper <path>` can activate a wallpaper that has
no file yet. `save` takes the profile kind only: a wallpaper context holds
what was tuned while pinned, and a full snapshot has no place there.

`set` and `unset` gain one flag, `--base`, that retargets the write at the base
values file regardless of active slots. No other flag; `--context <kind>` can
come later if a real need appears.

### Effect on the bus

`save`, `show`, `list`, and `delete` of an inactive context never touch
`resolved.json` or sinks. `save` cannot change the effective values even when
it replaces an active context: the snapshot equals the current effective set,
and every layer above it is unchanged, so the composition is identical. This
is stated so nobody has to reason about it later.

A caveat recorded on 2026-09-05 (`prism-fcacfb`) noted that a save into an
active but non-topmost context absorbed the layers above it. The 2026-09-06
revision closes it by construction: `save` takes only the profile kind, and a
profile is always the topmost layer while active.

`activate`, `deactivate`, `wallpaper`, and `delete` of an active context
resolve the resulting state under the store lock, write `resolved.json`, and
fan out. The changed-key set is the diff against the previous effective
values when the previous state resolves. When it does not, because the active
profile vanished or a context file became invalid, the verb still succeeds if
the resulting state resolves, and fans out every key bound by any sink, the
way `apply` does. That is the recovery path: a broken active context never
blocks switching to a valid one or clearing the slot. When the diff is empty,
for instance a wallpaper with no context arriving while nothing was tuned,
the verb exits without running any sink.

`save` writes the file only; saving the current look does not activate the
profile. Loading is a separate `activate`. That matches the panel flow: save
is a snapshot, the select loads.

`doctor` also reports a slot that names a missing profile context, a context
file that fails validation, and an orphan key inside any context file, the way
it reports orphans in base today.

## Section 3: describe contract and the panel reset

`describe --json` gains a top-level `active` object mirroring the slots, a
top-level `target` naming the write-target layer, and a top-level `layers`
giving the resolution order low to high. Each param gains `layer`, where its
effective value comes from (`default`, `base`, `wallpaper`, `state`, or
`profile`), and `fallback`, the value `unset` would leave in effect. The
`modified` field is removed: it answered "differs from the default", and
nothing needs that question any more.

`layers` is `RESOLUTION_ORDER`, the two implicit layers under the context stack
followed by `LAYER_ORDER` itself. A client cannot decide whether a value sits
above where a write would land without ranking two layer names, and that
ranking is the store's knowledge. Stating it keeps the panel from carrying a
second copy that would silently mis-rank the day `state` becomes real.

```json
{
  "active": { "wallpaper": { "id": "3f9a1c2e", "path": "/path/to/wall.jpg", "pinned": true }, "profile": null },
  "layers": ["default", "base", "wallpaper", "state", "profile"],
  "target": "wallpaper",
  "params": [
    { "key": "glass.ior", "value": 1.3, "layer": "wallpaper", "fallback": 1.24 }
  ]
}
```

The panel's reset today is keyed on `modified`, resets the local value to the
default, and section reset unsets every modified param. Under a context that
is wrong in both directions: an override equal to the default shows no reset
and cannot be removed, and an inherited non-default value shows a reset that
would error. So this piece changes the panel's reset semantics, and only
those:

- a param is overridden when `layer == target`; the row reset is visible, and
  counted in the section reset, exactly then;
- a reset optimistically sets the local value to `fallback` and marks the
  param not overridden until the next `describe` reconciles;
- a section reset unsets only overridden params;
- the reset tooltip reads `Remove override` for every target, since a profile
  reset may reveal a wallpaper value rather than the base one;
- the model validator requires `layer`, `fallback`, and top-level `target`
  and `layers` instead of `modified`, and rejects a `target` or a param
  `layer` that `layers` cannot rank.

A parameter is *shadowed* when `rank(layer) > rank(target)`: its value comes
from above where a write would land, so the control still writes but nothing
visible changes. The panel dims such a row and says what covers it. The advice
is layer-specific — pinning makes the wallpaper the target, but a pin cannot
lift it above a state layer, so only a wallpaper shadow offers one. Writing
under a shadow leaves the row un-overridden, because `layer == target` stays
false: the write landed in the target, which is not where the value comes
from.

Profile controls that consume `active` (indicator, save button, select) still
belong to `prism-ea6344`.

`resolved.json` and the sink apply protocol are untouched, which keeps the
niri sink and its tests out of the change.

## Section 4: errors, concurrency, testing

### Errors

All fail early with one line and no partial writes:

- unknown kind, the reserved `state` kind, or a name outside the safe
  character set;
- `activate`, `show`, or `delete` on a missing file;
- `save` of any kind but profile;
- `pin` or `unpin` of any kind but wallpaper, `pin` with no active wallpaper
  or with a profile active, `unpin` of a wallpaper that is not pinned;
- a context file that is not a flat object, or that holds an unknown key or an
  invalid value;
- `unset` of a key the write target does not hold;
- `context wallpaper` with an empty path or a path that does not exist.

`active.json` naming a missing or invalid profile is an error for every
reading and writing verb, `describe` included: they report it and refuse to
guess. `describe` fails through the panel's existing visible-error path, which
keeps the last valid model on screen and shows the error text, so the panel
needs no special case. Recovery is the slot-changing verbs, which succeed from
that state as Section 2 states.

### Concurrency

Every verb that touches `values.yaml`, a context file, or `active.json` runs
under the existing store lock, and every write uses the existing atomic
temp-and-rename helpers. The wallpaper hook and a panel drag interleave
safely: whichever takes the lock second sees the other's result.

### Testing

With the existing `node --test` suite:

- resolver unit tests for layer order, write-target selection, validation of
  every layer, the empty-wallpaper versus missing-profile distinction, and
  `layer` and `fallback` derivation;
- a context-store unit test for the file layout, name validation, hash
  derivation, `_source` on first write, and its preservation by `save`;
- CLI tests through the existing `run(argv, { runner })` harness covering each
  verb, `--base`, `get` and `list` under an active context, the fan-out diff
  on activate and deactivate, the full fan-out when the previous state cannot
  resolve, the no-change early exit, save leaving `resolved.json` and sinks
  untouched, and each error line;
- `describe` shape tests for `active`, `target`, `layer`, and `fallback`;
- the plugin Lua checks updated for the reset semantics: visibility from
  `layer == target`, optimistic reset to `fallback`, section reset over
  overridden params, and the validator's new required fields.

### Documentation

The visual-bus design gets a short context-layers section pointing here, the
README states the config layout, and the plugin contract note records the
`describe` changes and the reset semantics.

## Out of scope

This is the boundary as first drawn. One item has since moved inside it: the
2026-09-08 revision documents the panel's wallpaper header row, pin, and
shadowed rows (`prism-3b7c07`), which landed against this spec rather than
being deferred. The base-versus-wallpaper question from `prism-648e0f` is
settled above.

- Profile controls in the panel (`prism-ea6344`).
- The Noctalia hook line (`dots-88dc34`).
- The `state` kind's activation sources and its composition rules
  (`prism-9298b9`).
- Per-connector wallpaper contexts; wallpapers here are set on all monitors at
  once.
