# prism: a desktop-agnostic visual parameter bus

- **Status**: Approved design, not yet implemented
- **Date**: 2026-08-15
- **Working name**: `prism` (sources in, surfaces out); rename is cheap until paths ship

## Problem

Control of desktop/terminal visual appearance is spread across many
configuration files and applications, with some parameters specified in
multiple places that drift independently. Concretely, in the current setup:

- Terminal background opacity is defined in four places with drifted values:
  `kitty.conf` (0.95), kitty's `focus-opacity.py` watcher (0.95 active /
  0.65 inactive), ghostty's config (0.85), and niri per-window rules
  (0.98/0.95 whole-window alpha) — plus a stale ownership table in niri's
  `config.kdl` documenting values that no longer match anything.
- niri `gaps` must manually equal `layoutGaps` in `niri-glass.json`, with
  per-host overrides on only one side.
- The kitty/ghostty terminal allowlist exists in both niri window rules and
  niri-glass `paneApps`.
- The 7-slot glass role table is copied across `noctalia-glass-sync`,
  `noctalia-glass-check`, and nvim's `glass.lua`.
- Two independent writers set terminal background color: the noctalia
  template pipeline (files + SIGUSR1) and familiar (live OSC 11 escapes).

There is no shared schema, no single source of truth per parameter, and no
arbitration when two components want the same surface.

## Goal (v1 success criterion)

**Live knobs**: a noctalia panel with sliders that change opacity, blur, and
glass parameters across all bound surfaces in near-real time. The persisted
parameter store that powers this is simultaneously the single source of
truth, subsuming the config-deduplication problem.

### v1 scope decisions

- **Sources**: user controls only — the persisted values file and the
  noctalia slider panel. Existing automated glue (`focus-opacity.py`,
  familiar OSC 11, `noctalia-glass-sync`) keeps running as-is beside prism.
  Arbitration/layering is designed into the schema but not implemented.
- **Sinks**: kitty, niri-glass, and niri. ghostty is deferred (no live
  reload path; a config change requires restart).
- **Placement**: standalone repo (`~/d/prism`) with a machine-enforced
  portability seam, following familiar's model. Dotfiles only wires it up.

## Architecture: daemonless file bus

Follow the pattern the surrounding ecosystem has converged on and familiar
proved: **atomic files as the bus, no daemon**. The contract is a resolved
state file plus capability manifests. A future daemon (for high-frequency
sources like focus events or animation) is an optional additive accelerator
that would trigger the same sink executables — never a replacement for the
file contract.

Rejected alternatives:

- *Daemon with socket API*: proper capability handshake and fast event path,
  but adds a lifecycle/failure mode every component depends on, is against
  the ecosystem's grain, and v1's user-paced writes (a few Hz) don't need it.
- *Config compiler only*: would kill duplication but is not truly live
  (kitty config-reload caveats) and dead-ends — runtime modulation would be
  a rewrite rather than an extension.

## Section 1: Parameter vocabulary, definitions, and sink manifests

Core principle: **parameters are canonical and centrally defined; sinks bind
to them.** A single `terminal.background.opacity.inactive` exists once; both
the kitty sink and the niri sink bind to it. This inverts today's world
where each config dialect defines its own copy.

### Parameter definitions

Versioned YAML files: a `defs/` set shipped with prism (core vocabulary:
terminal opacity active/inactive, blur, saturation, noise, gaps, glass
material params, terminal app list) merged with user/third-party defs from
`~/.config/prism/defs/`. Definitions carry no knowledge of any sink — they
are the desktop-agnostic half of the contract.

```yaml
key: terminal.background.opacity.inactive
type: float          # float | int | bool | color | enum | string | list
range: [0.0, 1.0]
default: 0.65
ui: {group: terminal, control: slider, step: 0.01}
description: Background opacity of unfocused terminal windows
```

### Sink manifests

Each sink is a directory — `integrations/<sink>/` in-tree, or
`~/.config/prism/sinks/<sink>/` for user-added ones — containing
`manifest.yaml` plus an `apply` executable. The manifest is how a sink
communicates its capabilities: which canonical params it consumes and how
quickly changes take effect.

```yaml
sink: kitty
binds:
  - param: terminal.background.opacity.active
    liveness: live        # live | reload | restart
  - param: terminal.background.opacity.inactive
    liveness: live
```

- The UI is generated entirely from `defs × manifests`: a control appears
  because a definition exists; its liveness badge comes from the manifests
  binding it.
- A param no sink binds still shows (grayed) so users see what's available.
- A sink binding an undefined param is a hard error at load (fail early).

### Designed-for but excluded from v1

- **Conditions**: bindings reserve a `when:` field (e.g. per-window or
  `is-active` addressing), unused in v1.
- **Source priority layers**: the resolver is a single-layer user store in
  v1; the resolved output includes a `layer` field per param so arbitration
  can be added without breaking sinks.

## Section 2: Store, resolution, and the CLI

**Runtime**: Node 20+ ESM, zero runtime deps except `yaml` — identical to
familiar's stack, so its idioms (atomic writes, lockfile transactions,
import-free logic modules) carry over directly.

### Two files, two roles

- `~/.config/prism/values.yaml` — the user's persisted overrides, sparse:
  only params changed from defaults. This is what gets checked into
  dotfiles.
- `~/.local/state/prism/resolved.json` — machine-written product: *every*
  defined param with its effective value (`values.yaml[key] ?? default`),
  a monotonic `generation` counter, and per-param `layer: "user"`. Written
  atomically (temp + rename) under a lockfile. **This file is the bus** —
  the only thing sinks ever read.

### Resolution

Deliberately boring in v1: default merged with user override, with
type/range validation at write time. A `set` outside the declared range
fails loudly; nothing clamps silently.

### CLI verbs

- `prism set <key> <value>` / `prism unset <key>` — locked read-modify-write
  of `values.yaml`, re-resolve, write `resolved.json`, then fan out. The
  write path the noctalia sliders use.
- `prism get <key>` / `prism list` — read effective values.
- `prism describe --json` — dump merged defs × manifests plus
  modified-from-default state; the UI bootstraps from this.
- `prism apply [<sink>...]` — re-run fan-out from current state without
  changing anything: the recovery/startup verb (after kitty restarts, niri
  reloads, etc.).
- `prism doctor` — validate defs, manifests, and current state; surfaced via
  `dotfiles-health`.

### Transactionality

A `set` that fails mid-fan-out leaves `values.yaml` and `resolved.json`
consistent (committed before fan-out). Failures are reported per-sink;
`prism apply <sink>` retries. No rollback machinery — sinks are idempotent,
so re-apply is always the fix.

## Section 3: Sink adapters and fan-out

**Execution model: apply-on-write, no watchers in v1.** The CLI is the only
writer, so `prism set` ends by invoking the `apply` executable of each sink
whose manifest binds a changed key. `apply` receives the path to
`resolved.json` plus the changed keys as arguments. The contract stays
file-shaped so a future daemon or external writer can trigger the same
executables without the CLI.

`apply` must be **idempotent**: applying the same state twice is a no-op.
This is what makes `prism apply` a universal repair verb.

### v1 sinks

**niri-glass** — renders glass params into `~/.config/niri/niri-glass.json`;
the existing Quickshell file-watch picks it up live. Migration: that file is
currently a hand-edited symlink into dotfiles; it becomes prism-generated,
with dotfiles keeping only seed values in `values.yaml`. prism owns `gaps`
once; both this sink and the niri sink render it, ending the
`layoutGaps` drift.

**kitty** — two channels in one adapter:

1. *Live*: remote-control calls over the existing `unix:@dotfiles-kitty`
   socket (`set-background-opacity`, `set-colors`) so sliders move
   instantly.
2. *Persistent*: a generated `kitty/prism-generated.conf` include so new
   kitty instances start with the same values.

Interplay fix: `focus-opacity.py` currently holds hardcoded ACTIVE/INACTIVE
constants and would fight live changes on the next focus event. It is
patched (in dotfiles) to read its two opacity values from `resolved.json`
at focus-change time — a cheap file read that turns the fight into
cooperation without bringing focus state into the bus.

**niri** — generated include fragment, the proven `noctalia.kdl` pattern.
`apply` renders `~/.config/niri/prism.kdl` (window-rule
opacity/blur/saturation/noise for the terminal allowlist, gaps) and triggers
`niri msg action load-config-file`. Liveness class `reload`: sub-second, not
per-frame. The niri `apply` internally rate-limits `load-config-file`
(trailing-edge debounce, ~300 ms) so slider drags don't hammer the
compositor.

The terminal app allowlist becomes a prism param (`terminal.apps`, type
list) rendered into both the niri fragment and niri-glass's `paneApps`.

### Error handling

An `apply` failure (dead kitty socket, niri not running) is reported and
recorded per-sink in `~/.local/state/prism/sink-status.json`, never blocks
other sinks, and never corrupts state. `prism doctor` surfaces stale sink
status; the next `set` or an explicit `prism apply` heals it.

## Section 4: The noctalia plugin UI

A noctalia plugin (QML, same shape as the existing wali-panel/catwalk
plugins) that is a **pure client of the CLI** — zero built-in knowledge of
parameters, sinks, or semantics.

- **Bootstrap**: on open, runs `prism describe --json` and builds the UI
  from the result — one section per `ui.group`, one control per definition
  (`slider` / `toggle` / `color` / `select`), each showing current effective
  value and a liveness badge (live / reload / grayed-unbound).
- **Writes**: slider drags issue `prism set`, debounced to ~10 Hz while
  dragging with a final exact-value set on release. kitty and niri-glass
  being live-class gives real-time feedback; the niri adapter's internal
  debounce absorbs the rest.
- **Reset affordances**: per-param revert (`prism unset`) and per-group
  reset; modified-from-default state comes through `describe`.
- **No caching**: the panel re-runs `describe` on open rather than watching
  files. Live external-change reactivity is a v1 non-goal — the panel is
  the only writer in practice.

Placement: `integrations/noctalia-plugin/` in the prism repo (an integration
like any other — the core never names noctalia), symlinked into
`~/.config/noctalia/plugins/` by dotfiles setup.

Extension story: a user on another compositor/terminal writes defs, a
manifest, and an `apply` script — and the unmodified plugin grows the right
controls.

## Section 5: Testing, repo layout, and migration

### Testing

The familiar playbook: all logic (def/manifest loading, validation,
resolution, renderers for the kdl/conf/json dialects) lives in import-free
ESM modules tested with `node --test`, no desktop required. Sink `apply`
scripts are thin shells over tested render functions; side-effects (socket
calls, `niri msg`) are injected so tests assert command lines without a live
compositor. Integration smoke test: `dotfiles-health` runs `prism doctor`.
Development follows TDD.

### Repo layout

```
src/            # store, resolve, defs/manifest loading, CLI
defs/           # shipped canonical parameter definitions
integrations/   # kitty/, niri/, niri-glass/, noctalia-plugin/
test/
docs/
```

Seam enforcement, as in familiar: a test forbids `src/` from naming
niri, kitty, ghostty, or noctalia.

### Migration order (each step independently shippable)

1. Core + niri-glass sink — first live slider-able surface; zero changes to
   existing components.
2. kitty sink + the `focus-opacity.py` patch in dotfiles.
3. niri sink (`prism.kdl` include); then delete the now-duplicated
   opacity/blur window-rule values and the stale ownership table from
   `config.kdl`.
4. noctalia plugin.
5. Dotfiles cleanup: seed `values.yaml`, gitignore generated files, wire
   setup symlinks.

Existing systems (noctalia color pipeline, familiar, `noctalia-glass-sync`)
are untouched in v1; folding them in as prioritized sources is the
designed-for v2.

## Future work (explicit non-goals for v1)

- Source priority layers and arbitration (noctalia palette, familiar
  identity/state, focus tracking as bus sources).
- Per-window / conditional bindings (`when:` field).
- An optional daemon fast path for high-frequency modulation.
- ghostty sink (restart-only liveness) and other third-party sinks.
- Folding the glass role table / `noctalia-glass-sync` pipeline into prism.
