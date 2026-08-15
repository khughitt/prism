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
  Arbitration/layering is future work, designed when a second source
  actually exists.
- **Sinks**: kitty, niri-glass, and niri. ghostty is deferred as a scope
  choice, not a capability gap: Linux ghostty (1.3.1 installed) supports
  `reload_config` and scripted reload via its systemd integration
  (`systemctl reload --user app-com.mitchellh.ghostty.service`), so a
  future ghostty sink is liveness class `reload`. (Only macOS background-opacity changes require restart.)
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
material params, terminal app list). Definitions carry no knowledge of any
sink — they are the desktop-agnostic half of the contract.

```yaml
key: terminal.background.opacity.inactive
type: float          # float | int | bool | color | enum | string | list
range: [0.0, 1.0]
default: 0.65
ui: {group: terminal, control: slider, step: 0.01}
description: Background opacity of unfocused terminal windows
```

Contract constraints (so `describe` can always generate a working UI):

- `enum` definitions MUST carry a `values:` list; `select` controls render
  from it.
- `ui.control` is one of `slider | toggle | color | select | none`.
  `none` means CLI/file-editable only — the panel hides it. `list` and
  `string` params have no v1 control and MUST declare `control: none`
  (e.g. `terminal.apps`).
- Loading fails on a definition that violates these rules (fail early).

### Sink manifests

Each sink is a directory `integrations/<sink>/` containing
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
  binding it. When multiple sinks bind one param with different liveness,
  the badge shows the **slowest** class (live < reload < restart) — it
  answers "when has everything settled".
- A param no sink binds still shows (grayed) so users see what's available.
- A sink binding an undefined param is a hard error at load (fail early).

Conditions (per-window / `is-active` addressing), source priority layers,
and user-level defs/sinks directories are deliberately absent from the v1
schema — see Future work. Nothing is reserved speculatively; each future
representation is designed when its first real consumer exists.

## Section 2: Store, resolution, and the CLI

**Runtime**: Node 20+ ESM, zero runtime deps except `yaml` — identical to
familiar's stack, so its idioms (atomic writes, lockfile transactions,
import-free logic modules) carry over directly.

### Two files, two roles

- `~/.config/prism/values.yaml` — the user's persisted overrides, sparse:
  only params changed from defaults. This is what gets checked into
  dotfiles.
- `~/.local/state/prism/resolved.json` — machine-written product: *every*
  defined param with its effective value (`values.yaml[key] ?? default`)
  and a monotonic `generation` counter. Written atomically (temp + rename)
  under a lockfile. **This file is the bus** — the only thing sinks ever
  read.

### Resolution

Deliberately boring in v1: default merged with user override, with
type/range validation at write time. A `set` outside the declared range
fails loudly; nothing clamps silently.

### CLI verbs

- `prism set <key> <value>` / `prism unset <key>` — locked read-modify-write
  of `values.yaml`, re-resolve, write `resolved.json`, then fan out. The
  write path the noctalia sliders use. An explicit `set` **always fans out
  for its requested key, even when the stored value is unchanged** —
  otherwise a release `set` whose value was already written by the last
  drag sample would skip reload-class sinks and leave niri stale.
  `--liveness live` restricts fan-out to bindings of that class (state
  files are still fully written); the plugin uses this during slider drags
  so reload-class sinks (niri) are only applied by the plain `set` on
  release.

  Value parsing is by declared type: `float`/`int` use strict numeric
  parsing, `bool` accepts `true`/`false`, `color` is a literal hex string
  (`#rrggbb` or `#rrggbbaa`), `enum` must equal one of the definition's
  `values`, `list` is a JSON array, `string` is taken verbatim. Anything
  else is a loud error.
- `prism get <key>` / `prism list` — read effective values.
- `prism describe --json` — dump merged defs × manifests plus
  modified-from-default state; the UI bootstraps from this.
- `prism apply [<sink>...]` — lock, load and validate defs and
  `values.yaml`, **re-resolve, rewrite `resolved.json`**, then fan out.
  The recovery/startup verb: it must produce correct sink state from
  `values.yaml` alone — fresh checkout, edited/pulled values, changed
  definitions, or a crash that left `resolved.json` absent or stale.
  (`apply` is `set` minus the value change.)
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
whose manifest binds a changed key — where the key named by the `set` counts
as changed even if its stored value did not move (see the CLI contract). `apply` receives the path to
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
   socket so sliders move instantly. Because opacity is per-OS-window in
   kitty and there is no stored active/inactive pair, the adapter applies
   **both states immediately**. It must not use `state:focused` matching:
   kitty deliberately falls back to the *last-focused* window when none is
   currently focused — the likely state while the user is operating the
   noctalia panel. Instead: enumerate OS windows via `kitten @ ls`, set
   **all** of them to the inactive value, then, only if `ls` reports an
   actually focused OS window, set that one to the active value by numeric
   id. Documented fallback: if this proves unreliable in implementation,
   `terminal.background.opacity.inactive` is demoted to liveness `reload`
   (applied on next focus transition) rather than shipping a flaky live
   claim.
2. *Persistent*: a generated `kitty/prism-generated.conf` include so new
   kitty instances start with the same values.

Interplay fix: `focus-opacity.py` currently holds hardcoded ACTIVE/INACTIVE
constants and would fight live changes on the next focus event. It is
patched (in dotfiles) to read its two opacity values from `resolved.json`
at focus-change time — a cheap file read that turns the fight into
cooperation without bringing focus state into the bus. Ongoing focus
transitions remain the watcher's job; the adapter only handles the moment
a value changes.

**niri** — generated include fragment, the proven `noctalia.kdl` pattern.
`apply` renders `~/.config/niri/prism.kdl` (window-rule
opacity/blur/saturation/noise for the terminal allowlist, gaps) and triggers
`niri msg action load-config-file`. Liveness class `reload`: sub-second, not
per-frame. There is deliberately **no debounce inside the adapter** — each
`apply` is a short-lived process, so no timer survives between invocations.
Drag-rate protection comes from the fan-out filter instead: the plugin's
drag path uses `prism set --liveness live`, which skips this sink entirely;
niri is applied once by the plain `set` on slider release.

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
- **Writes**: slider drags issue `prism set --liveness live` (sampled at
  ~10 Hz); release issues a plain `prism set` with the final value, which
  also applies reload-class sinks (niri). Because independently spawned
  processes can acquire the store lock out of launch order, the plugin
  **serializes its writes**: at most one `prism set` subprocess in flight,
  plus a single pending value that newer drag samples replace. When the
  in-flight process exits, the pending value (if any) is sent next. Release
  enqueues the final value and waits for the queue to drain, guaranteeing
  the released value is the last write.
- **Reset affordances**: per-param revert (`prism unset`) and per-group
  reset; modified-from-default state comes through `describe`.
- **No caching**: the panel re-runs `describe` on open rather than watching
  files. Live external-change reactivity is a v1 non-goal — the panel is
  the only writer in practice.

Placement: `integrations/noctalia-plugin/` in the prism repo (an integration
like any other — the core never names noctalia), symlinked into
`~/.config/noctalia/plugins/` by dotfiles setup.

Extension story: a user on another compositor/terminal contributes defs, a
manifest, and an `apply` script under `integrations/` — and the unmodified
plugin grows the right controls. (Out-of-tree user defs/sinks directories
are future work; they arrive when an external integration actually exists.)

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

Ownership note driving step 1: `~/.config/niri` is a symlink to the
dotfiles `niri/` directory, so anything prism generates there lands inside
the tracked repo. The `noctalia.kdl` precedent (generated + gitignored in
that same directory) is the model.

1. Core + niri-glass sink, **including the dotfiles ownership handoff and
   prism config wiring**: create the `~/.config/prism` link in dotfiles
   setup (a `prism/` dir in the dotfiles repo holding `values.yaml`, wired
   like the existing `familiar/` config link), seed `values.yaml` from the
   current `niri-glass.json`, `git rm --cached` the tracked file, and
   gitignore it — otherwise the first generated write dirties the dotfiles
   repo. No *code* changes to existing components. Until step 4 the knobs
   are CLI-only (`prism set`); "live" means the change is visible the
   moment the command runs.
2. kitty sink + the `focus-opacity.py` patch in dotfiles; gitignore
   `kitty/prism-generated.conf`.
3. niri sink (`prism.kdl` include, gitignored); then delete the
   now-duplicated opacity/blur window-rule values and the stale ownership
   table from `config.kdl`.
4. noctalia plugin — sliders arrive here.
5. Remaining dotfiles wiring: noctalia plugin symlink, `dotfiles-health`
   runs `prism doctor`.

Existing systems (noctalia color pipeline, familiar, `noctalia-glass-sync`)
are untouched in v1; folding them in as prioritized sources is the
designed-for v2.

## Future work (explicit non-goals for v1)

- Source priority layers and arbitration (noctalia palette, familiar
  identity/state, focus tracking as bus sources); how `resolved.json`
  represents layers is designed then, alongside its consumers.
- Per-window / conditional bindings (a `when:` field on manifest binds).
- Out-of-tree user defs and sinks directories
  (`~/.config/prism/{defs,sinks}/`), when an external integration exists.
- An optional daemon fast path for high-frequency modulation.
- ghostty sink (liveness `reload` on Linux via `reload_config` /
  `systemctl reload --user`) and other third-party sinks.
- UI controls for `list`/`string` params (v1 hides them via
  `control: none`).
- Folding the glass role table / `noctalia-glass-sync` pipeline into prism.
