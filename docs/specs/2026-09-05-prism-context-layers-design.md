# Prism context layers: design

**Date:** 2026-09-05
**Status:** accepted 2026-09-05, not yet implemented
**Task:** `prism-6fd864`, first piece of goal `prism-2f0b4b`

## Context

A set of glass values that looks right over one wallpaper and colorscheme is
often wrong over another. Goal `prism-2f0b4b` wants three ways to keep values
per situation: named profiles a user saves and loads by hand, wallpaper
profiles that persist whatever was tuned while a wallpaper was showing and
come back with it, and profiles bound to other states Noctalia reports through
hooks. All three are one mechanism, a context layer in the Prism store. This
document designs that layer and its CLI. The Noctalia panel controls and the
wallpaper hook wiring are separate pieces (`prism-ea6344`, `prism-648e0f`,
`dot-88dc34`).

Today the store is one flat `values.yaml` per host, symlinked from dotfiles,
resolved as defaults then base values
([`2026-08-15-prism-visual-bus-design.md`](../superpowers/specs/2026-08-15-prism-visual-bus-design.md)).
`set` and `unset` write it under the store lock, resolve, write
`resolved.json`, and fan out to the sinks bound to the changed keys. There is
no layering.

## Decisions

- **Writes go to the active context by default.** With a context active, a
  plain `prism set`, and therefore every panel slider, writes into it. A
  `--base` flag writes through to the base values file. This is what makes
  wallpaper tuning free of a save step.
- **One slot per kind, layered.** Kinds are `wallpaper`, `state`, and
  `profile`. Each kind has at most one active context. Resolution order is
  defaults, base, wallpaper, state, profile. A wallpaper change never
  disturbs a pinned profile; clearing the profile falls back to the current
  wallpaper context.
- **Overlay files per context; runtime slots in state.** Contexts are flat
  YAML files under the config directory so dotfiles tracks them per host.
  Which contexts are active is runtime state in the state directory.
- **A context stores only what was written into it.** `save` snapshots the
  current effective overrides so a named profile captures what the user sees
  rather than a delta that drifts when the base changes.

Rejected: a single `contexts.yaml` holding every context and the slots (one
hot file rewritten by the hook, the panel, and hand edits, noisy in dotfiles
on every wallpaper rotation); swapping `values.yaml` by symlink (cannot
compose kinds, and a wallpaper profile would be a full copy of the base).

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
and only in wallpaper contexts.

Profile names are restricted to letters, digits, dash, underscore, and dot,
validated on every verb.

### Active slots

One JSON file, `~/.local/state/prism/active.json`, holds at most one name per
kind:

```json
{ "wallpaper": "3f9a1c2e", "profile": "dusk" }
```

A missing file or a missing kind means nothing is active for that kind. The
wallpaper verb rewrites the wallpaper slot. Pinning a profile writes the
profile slot and never touches the others.

### Resolution

The resolver takes the base values plus the ordered list of active context
layers and merges them: defaults, then base, then wallpaper, then state, then
profile. Every layer is validated against the definitions the same way base
values are today, so an unknown or out-of-range key in any layer fails the
whole resolve.

A context named in `active.json` that does not exist on disk resolves as
empty for the wallpaper kind, because the wallpaper piece activates a
wallpaper before its first edit, and is an error for the profile kind.

`resolved.json` keeps its current shape, `params` only. No sink changes.

### Write target

The topmost active layer in the same order is the write target for `set` and
`unset`. With nothing active the target is base, which makes today's
behaviour the degenerate case.

`set` stores the value in the target even when it equals the default, because
the layer below may differ. `unset` removes the key from the target and lets
the layer below show through. The existing rule that drops a base value equal
to the default stays for base only.

## Section 2: CLI verbs

All new verbs sit under one subcommand so the existing five verbs keep their
shape:

```
prism context list                       # every context by kind, active ones marked
prism context show <kind> <name>         # the context's overrides
prism context save <kind> <name>         # snapshot current effective overrides into a new or replaced context
prism context activate <kind> <name>     # set the slot; profile must exist, wallpaper may not yet
prism context deactivate <kind>          # clear the slot
prism context delete <kind> <name>       # remove the file; clears the slot if it was active
prism context wallpaper <path>           # derive the id from the path and activate it; the hook's entry point
```

`kind` is `profile` or `wallpaper`. The `state` kind is reserved and rejected
by every verb until the state idea (`prism-9298b9`) is scoped, so nothing
half-works.

`set` and `unset` gain one flag, `--base`, that retargets the write at the base
values file regardless of active slots. No other flag; `--context <kind>` can
come later if a real need appears.

### Effect on the bus

`save`, `show`, `list`, and `delete` of an inactive context never touch
`resolved.json` or sinks.

`activate`, `deactivate`, `wallpaper`, and `delete` of an active context
resolve before and after under the store lock, write `resolved.json`, and fan
out the keys whose effective value differs. When no key changed, for instance
a wallpaper with no context arriving while nothing was tuned, the verb exits
without running any sink.

`save` copies every key whose effective value differs from its default,
which is exactly the set `describe` marks `modified`, so the snapshot matches
what the panel shows. It writes the file only; saving the current look does
not activate the profile. Loading is a separate `activate`. That matches the panel flow: save
is a snapshot, the select loads.

`apply` and `doctor` resolve through the same layered path so their view of
the effective values agrees with `set`. `doctor` also reports a slot that
names a missing profile context and an orphan key inside any context file,
the way it reports orphans in base today.

## Section 3: describe contract

`describe --json` gains a top-level `active` object mirroring the slots, and
each param gains a `layer` field naming where its effective value comes from:
`default`, `base`, `wallpaper`, `state`, or `profile`.

```json
{
  "active": { "wallpaper": "3f9a1c2e", "profile": null },
  "params": [
    { "key": "glass.ior", "value": 1.24, "layer": "base", "modified": true }
  ]
}
```

`modified` keeps its meaning, differs from the default, so the existing panel
keeps working unchanged. The panel's per-row and per-section reset already
call `unset`, which now removes the key from the write target, so under an
active wallpaper context a reset reverts to the base value rather than the
default. That is the intended wallpaper-tuning behaviour and needs no panel
code in this piece.

Panel changes that consume `active` and `layer` (active-profile indicator,
save button, profile select) belong to `prism-ea6344`. This piece ships the
contract and the CLI only, verifiable end to end from the shell.

## Section 4: errors, concurrency, testing

### Errors

All fail early with one line and no partial writes:

- unknown kind, the reserved `state` kind, or a name outside the safe
  character set;
- `activate profile`, `show`, or `delete` on a missing file;
- a context file that is not a flat object, or that holds an unknown key or an
  invalid value;
- `context wallpaper` with an empty path.

`active.json` naming a missing profile is not an error for `describe`, which
still has to render the panel, and is an error for `set`, `apply`, and
`doctor`, which report it and refuse to guess.

### Concurrency

Every verb that touches `values.yaml`, a context file, or `active.json` runs
under the existing store lock, and every write uses the existing atomic
temp-and-rename helpers. The wallpaper hook and a panel drag interleave
safely: whichever takes the lock second sees the other's result.

### Testing

With the existing `node --test` suite:

- resolver unit tests for layer order, write-target selection, validation of
  every layer, and the empty-wallpaper versus missing-profile distinction;
- a context-store unit test for the file layout, name validation, hash
  derivation, and `_source`;
- CLI tests through the existing `run(argv, { runner })` harness covering each
  verb, `--base`, the fan-out key diff on activate and deactivate, the
  no-change early exit, and each error line;
- `describe` shape tests for `active` and `layer`;
- the plugin Lua contract check stays green untouched, proving the panel needs
  no change here.

### Documentation

The visual-bus design gets a short context-layers section pointing here, the
README states the config layout, and the plugin contract note records the
`describe` additions.

## Out of scope

- Panel controls for profiles (`prism-ea6344`).
- The Noctalia hook line (`dot-88dc34`) and the wallpaper UX question of
  whether the panel exposes a base-versus-wallpaper switch (`prism-648e0f`).
- The `state` kind's activation sources and its composition rules
  (`prism-9298b9`).
- Per-connector wallpaper contexts; wallpapers here are set on all monitors at
  once.
