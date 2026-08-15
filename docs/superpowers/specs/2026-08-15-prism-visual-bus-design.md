# prism: a desktop-agnostic visual parameter bus

- **Status**: Implemented (v1) — 2026-08-15
- **Date**: 2026-08-15
- **Name**: `prism` (shipped in CLI, config, state, and integration paths)

Implementation kept Kitty's inactive opacity live: the adapter discovered
that Kitty expands the configured abstract socket to PID-suffixed addresses,
so it enumerates the exact live addresses from `/proc/net/unix` before using
the specified inactive-then-focused sequence. Fresh-host niri setup was also
hardened to create both generated/ignored include targets, apply, validate,
and only then expose the config directory. The Noctalia client lives in the
persistent plugin `Main.qml`, preserving queued writes across panel closure,
and coalesces overlapping `describe` refresh requests. `dotfiles-health`
validates Prism ownership when either `~/.config/prism` exists/is a symlink
(including dangling) or `${DOTS_HOME}/prism/$(hostname)/values.yaml` marks a
tracked host. Explicit broken markers remain strict even on unknown hosts;
doctor runs only after the ownership link matches. Hosts with neither marker
do not acquire an unrelated Prism dependency.

Approved final-review product fixes are committed at `e4e11a3`, `532cceb`,
`76fe05e`, and `7a337fe`; the dotfiles final-review head is `74f35be`.

The implementation and dotfiles wiring are committed on their feature
branches. Two environment-dependent checks remain explicitly post-merge:
replacing the temporary live plugin link with setup's permanent
`~/d/prism/integrations/noctalia-plugin` link, and the full manual panel
contract from Tasks 18–19 — live glass/opacity drag, mixed gaps release,
fast-release ordering, blur toggle, param/group reset, and error banner.

## Problem

Control of desktop/terminal visual appearance is spread across many
configuration files and applications, with some parameters specified in
multiple places that drift independently. Concretely, at design time:

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

**Live knobs**: a noctalia panel whose sliders change opacity, blur, and glass
parameters across all bound surfaces. "Near-real time" applies to parameters
whose bindings are *all* liveness `live` — terminal background opacity (kitty
socket) and the `glass.*` set (watched JSON) — which track continuously during
a drag. Parameters with any `reload` binding (`terminal.blur`,
`terminal.saturation.*`, `terminal.noise.*`, `terminal.window.opacity.*`) and
mixed-class parameters (`compositor.gaps`: glass live + niri reload) apply
once on slider release, so their surfaces always move together rather than
tearing apart mid-drag. See Section 4.

The persisted parameter store that powers this is simultaneously the single
source of truth for the parameters it owns.

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

### What v1 closes, and what stays drifted

The Problem section lists five drift sites. v1 does not close all of them,
and the difference is a deliberate scope choice rather than an oversight:

| Problem | v1 |
|---|---|
| Terminal background opacity in four places | **Closed for kitty and niri.** kitty.conf's static `background_opacity` and the watcher's constants are deleted; niri's window rules are generated. ghostty is the exception — see below. |
| `gaps` ≠ `layoutGaps` | **Closed.** One `compositor.gaps` param renders into both the niri fragment and niri-glass. Per-host values live in each host's `values.yaml`; the `gaps` lines in `config.kdl` and both `host-*.kdl` are deleted. |
| Terminal allowlist duplicated | **Closed.** `terminal.apps` renders into the niri fragment and `paneApps`. |
| 7-slot glass role table copied three ways | **Not addressed.** Future work. |
| Two writers of terminal background color | **Not addressed.** Future work (source layering). |

**ghostty is deliberately left half-owned, and that is a new asymmetry v1
introduces rather than an old one it declines to fix.** ghostty stays in
`terminal.apps`, so prism generates its niri window rules (whole-window
opacity, blur, saturation, noise) while `ghostty/config.ghostty`'s
`background-opacity` remains hand-edited and can drift from
`terminal.background.opacity.active`. The sink itself would be short, but its
dotfiles migration and live-verification pass enlarge a release for a surface
already scoped out. Recorded here so the state is a known consequence, not a
later discovery.

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
generates: [kitty.conf]   # optional; file names under the generated dir
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
- `generates` lists the file **names** a sink writes under
  `~/.local/state/prism/generated/`. It exists for exactly one consumer —
  `doctor`'s bootstrap check (see Bootstrap ordering) — and carries names
  rather than paths so the core still never learns where a config lives.
  Each entry must be a nonempty basename: absolute paths, nested paths,
  `.`, and `..` are rejected. Sinks that write nothing omit it.

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
- `~/.local/state/prism/resolved.json` by default — machine-written product:
  *every*
  defined param with its effective value (`values.yaml[key] ?? default`).
  `PRISM_STATE_DIR` overrides the complete state directory; otherwise
  `XDG_STATE_HOME` replaces `~/.local/state`.
  Written atomically (temp + rename) under a lockfile. **This file is the
  bus** — the only thing sinks ever read. It carries no generation or
  sequence counter: staleness is per-sink (a snapshot of each sink's own
  bound params, see Error handling), and a global counter would both mark
  uninvolved sinks stale after every unrelated `set` and be exactly the kind
  of speculative reservation this design otherwise refuses.

### Resolution

Deliberately boring in v1: default merged with user override, with
type/range validation at write time. A `set` outside the declared range
fails loudly; nothing clamps silently.

**Orphan keys.** A key in `values.yaml` with no matching definition is an
error — but it is the one fail-early case that can strand the user, because
`values.yaml` is dotfiles-tracked and a `git pull` can introduce a key that a
host's older shipped defs do not define. So the failure is scoped rather than
total: `doctor` reports orphans as their own condition (distinct from a stale
or failed sink), and `unset <key>` is permitted on an orphan that exists in
`values.yaml` even though no definition backs it, so the CLI can always dig
itself out. Every other verb — `get`, `list`, `describe`, `set`, `apply` —
still fails loudly, because silently ignoring an unknown key would let a
renamed parameter look applied when nothing consumes it.

### CLI verbs

- `prism set <key> <value>` / `prism unset <key>` — locked read-modify-write
  of `values.yaml`, re-resolve, write `resolved.json`, then fan out. The
  write path the noctalia sliders use. An explicit `set` **always fans out
  for its requested key, even when the stored value is unchanged** —
  otherwise a release `set` whose value was already written by the last
  drag sample would skip reload-class sinks and leave niri stale. There is
  no liveness filter on the write path: the panel already refuses to sample
  anything but a fully-live parameter during a drag (Section 4), so a
  CLI-side filter would only ever be handed parameters that bind no
  reload-class sink, and would filter nothing. Drag-rate protection lives in
  exactly one place.

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

Each adapter invocation has a hard five-second timeout and is killed with
`SIGKILL` when it expires. The timeout is recorded as that sink's failure and
fan-out continues to later sinks, so an adapter that ignores softer signals
cannot wedge the whole operation.

**The store lock is deliberately not held across fan-out.** Sink `apply`
programs are external processes that talk to sockets and compositors; holding
a lock across them would make one wedged sink block every other writer, which
is a worse failure than the race it prevents. The consequence, stated plainly:
under two concurrent writers (the panel plus a shell `prism set`) both commit
under the lock in some order, then fan out unserialized, so the last sink
write can carry the earlier value while `resolved.json` holds the later one.
State is never corrupt — only a sink can lag it. `doctor` detects exactly this
(the sink's bound-param snapshot no longer matches resolved), and `prism apply`
repairs it. The panel avoids the race for its own writes by serializing to one
in-flight subprocess (Section 4); nothing serializes a human racing the panel
from a shell, and nothing needs to.

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

**Generated-file targets are machine-local.** The config directories the
sinks feed (`~/.config/niri`, `~/.config/kitty`) are cloud-synced symlinks
into the dotfiles repo and shared across hosts, while generated content is
per-host (gaps differ per machine). Sinks therefore write their real output
under `~/.local/state/prism/generated/`, and dotfiles setup places a
symlink at each config-path location (`niri-glass.json`, `prism.kdl`,
`kitty/prism-generated.conf`) pointing there. The symlink's literal target
is identical on every host, so cloud sync of the symlink is harmless; the
content it resolves to never leaves the machine.

#### Bootstrap ordering (a hard constraint, not a nicety)

The three sinks fail very differently when their generated target is absent —
a fresh clone, a new host, a wiped state directory:

| sink | missing target |
|---|---|
| niri-glass | `FileView.onLoadFailed` warns, QML defaults are used — safe |
| kitty | include warning, kitty starts — degraded |
| **niri** | **the entire config is rejected; niri does not start with the user's config** |

niri treats a dangling `include` as a fatal parse error (`niri validate`
rejects both a missing file and a symlink to a missing target). Since
`include "./prism.kdl"` lives in the git-tracked, cloud-synced `config.kdl`
while its target is machine-local, a host that has never run `prism apply`
would inherit a broken compositor config. The ordering is therefore part of
the contract:

1. Setup leaves the tracked niri directory unexposed while it creates the
   generated-file symlink inside it, selects the host fragment, and creates an
   empty ignored `noctalia.kdl` placeholder if Noctalia has not generated it
   yet. Empty KDL is valid, and Noctalia later owns and replaces that file.
2. Setup runs `prism apply niri`, materializing the target. If no niri is
   running, the adapter writes the target and then returns nonzero because it
   cannot reload; setup accepts that result only when `NIRI_SOCKET` is unset
   and the generated target is nonempty with a different device+inode from
   before the invocation, proving that atomic rename replaced it. Any other
   failure remains fatal.
3. Setup validates the still-unexposed config by explicit path with
   `niri validate -c`. A failure is a setup failure, not something discovered
   at the next login.
4. Only after validation does setup link the directory into `~/.config/niri`.
   A running niri reloads the newly exposed config; without one, setup states
   that the config will load on first start and instructs the user to run
   `prism apply niri` after startup to reload and clear the failed sink status.
   During migration, the `include` line likewise lands only after `apply` is
   proven on the host.

`prism doctor` (and `dotfiles-health` through it) treats a missing or
dangling generated target as a **hard failure**, not a warning. It is the
one condition that can prevent the desktop from starting, so it must never
be reported in the same register as a dead kitty socket.

### v1 sinks

**niri-glass** — renders glass params into `~/.config/niri/niri-glass.json`;
the existing Quickshell file-watch picks it up live. Migration: that file is
currently hand-edited and tracked in dotfiles (reached through the
`~/.config/niri` symlink); it becomes prism-generated, with dotfiles keeping
only seed values in `values.yaml`. prism owns `gaps` once; both this sink and
the niri sink render it, ending the `layoutGaps` drift.

*Canonical defaults come from the QML, not from the file on disk.* The
checked-in `niri-glass.json` is **not valid JSON** — `"paneLip": 08` has a
leading zero — and the live Quickshell log confirms `JsonAdapter` fails to
deserialize it, so the `JsonAdapter` property defaults in niri-glass's
`shell.qml` are what is actually on screen today. Seeding prism's defaults
from the file would silently change the desktop's appearance on first apply
while looking like a faithful capture. The glass defs are therefore
transcribed from the `JsonAdapter` block, and the migration verifies that
installing the generated file produces **no visual change** — which is only a
meaningful check because the two sets differ (`layoutGaps` 24 vs 26,
`paneLip` 6 vs 8, `probeExposure` 0.5 vs 0.0, `thickness` 20 vs 5,
`distortionScale` 0.5 vs 0, among others).

*The schema is closed and complete.* prism defines a `glass.*` param for
**every** `JsonAdapter` property — including `jellyFlex` and `jellyRipple`,
which the current file omits — and regenerates the whole file from that set.
No merge-preserve of unknown keys: a generated file that quietly carries
fields prism cannot explain is a second source of truth wearing a disguise.
The cost is explicit and accepted: prism owns the serialized form of a schema
that niri-glass's QML defines, so **adding a knob to `shell.qml` requires
adding the matching def to prism**, or the knob is unreachable through the
generated file. That coupling is the price of ending the drift, and it is
cheap to honor because both repos are local.

**kitty** — two channels in one adapter:

1. *Live*: remote-control calls over the existing kitty sockets so sliders
   move instantly. The configured `listen_on unix:@dotfiles-kitty` address
   is expanded by kitty to `unix:@dotfiles-kitty-<kitty_pid>`; the adapter
   reads `/proc/net/unix`, deduplicates exact PID-suffixed matches, and
   applies to every current socket. No exact match is a loud sink failure,
   as is a discovered socket that disappears or rejects a call. Because
   opacity is per-OS-window in kitty and there is no stored active/inactive
   pair, the adapter applies **both states immediately**. It must not use
   `state:focused` matching:
   kitty deliberately falls back to the *last-focused* window when none is
   currently focused — the likely state while the user is operating the
   noctalia panel — and this is documented behavior, not an accident
   ("If no window is focused, the last focused window is matched").

   For each discovered socket, the sequence is:
   `set-background-opacity --all <inactive>` in one call, then read
   `kitten @ ls` from that socket and, **only if** an OS window reports
   `is_focused: true`, a second call setting that window to `<active>`.

   The second call must match on **the id of a kitty window inside the
   focused OS window, not the OS window's own id.** These are two separate
   id namespaces: `kitten @ ls` returns OS windows each with an `id`,
   containing tabs containing windows with their own independent `id`
   sequence, and `set-background-opacity --match` selects *kitty windows*
   (there is no `--match-os-window`; opacity then applies to the whole OS
   window containing the match). On a single-window setup both ids are `1`,
   so confusing them passes a smoke test and breaks the moment a second OS
   window exists — the tests must use distinct values for the two.

   Documented fallback: if this proves unreliable in implementation,
   `terminal.background.opacity.inactive` is demoted to liveness `reload`
   (applied on next focus transition) rather than shipping a flaky live
   claim.
2. *Persistent*: a generated `kitty/prism-generated.conf` include so new
   kitty instances start with the same values. **Placement is part of the
   contract**: kitty applies later settings over earlier ones, so the
   include goes into the include chain near the end of `kitty.conf` —
   after the host and theme includes, and immediately *before* the
   `nvim-glass` `kitty-glass.conf` include, which must stay last-wins for
   `transparent_background_colors`. `kitty.conf`'s own static
   `background_opacity 0.95` line is **deleted** in the same change, along
   with the comment instructing humans to keep it in sync with
   `focus-opacity.py`. Leaving either would preserve exactly the drift this
   project exists to end.

Interplay fix: `focus-opacity.py` keeps hardcoded ACTIVE/INACTIVE constants
only as the missing-state fallback and reads its two opacity values from
`resolved.json` at focus-change time. It resolves that file with Prism's own
precedence: `PRISM_STATE_DIR`, then `XDG_STATE_HOME/prism`, then
`~/.local/state/prism`. This cheap file read keeps focus transitions in the
watcher without fighting live bus changes; the adapter only handles the
moment a value changes. Kitty caches watcher Python for the process lifetime:
SIGUSR1 reloads the generated config include but does **not** load the patched
watcher into an existing process. The patch takes effect in new or restarted
Kitty processes; existing processes converge as they are restarted or closed.

Accepted limitation: the watcher does a second job the live channel does not
replicate. `_rescale_transparent_colors` drags the seven
`transparent_background_colors` entries (nvim's cursorline, lualine, barbar)
along with the window background, so unfocused chrome does not end up the most
solid thing on screen. That path runs `patch_colors` through kitty's internal
API, which the adapter — an external process on a remote-control socket —
cannot reach. So **during a drag the terminal body tracks the slider while
those seven colors do not**, and the two reconverge on the next focus
transition once the patched watcher is loaded. This is a visible-but-transient
inconsistency during an interaction the user is already watching change, and
reimplementing kitty's internal color-patching path in the adapter is far more
machinery than a v1 release should carry. Documented rather than fixed.

**niri** — generated include fragment, the proven `noctalia.kdl` pattern.
`apply` renders `~/.config/niri/prism.kdl` (window-rule
opacity/blur/saturation/noise for the terminal allowlist, gaps) and then runs
`niri msg action load-config-file`. With no running niri the write succeeds
but the command returns nonzero at the reload step; bootstrap handles that
specific state as described above. Liveness class `reload`: sub-second, not
per-frame. There is deliberately **no debounce inside the adapter** — each
`apply` is a short-lived process, so no timer survives between invocations.
Drag-rate protection comes from the panel instead: a parameter this sink
binds is never fully `live`, so the panel does not sample it during a drag at
all and writes it once on release (Section 4). This sink is therefore invoked
at most once per interaction without any rate-limiting machinery on the write
path.

Include placement and the parameters it displaces:

- `include "./prism.kdl"` joins the existing includes at the top of
  `config.kdl`, beside `./noctalia.kdl`. niri accepts a field defined in
  more than one included file without complaint, and which definition wins
  is not something this design relies on: every value prism now owns must be
  **removed** everywhere else, not merely left alone. A surviving duplicate
  either overrides prism or contradicts it in the source — both are the
  drift this replaces.
- From `config.kdl`: the terminal `background-effect`/opacity window rules,
  `gaps` in the `layout` block, and the stale ownership-table comment.
- From **both** `host-europa.kdl` and `host-titan.kdl`: `gaps`. This is easy
  to miss — the per-host gap values live only in the host includes, and
  leaving them means prism's fragment is overridden and appears to do
  nothing. Per-host gaps move into each host's `values.yaml`.
- The generated target must exist before the include does; see Bootstrap
  ordering above.

The terminal app allowlist becomes a prism param (`terminal.apps`, type
list) rendered into both the niri fragment and niri-glass's `paneApps`.

### Error handling

An `apply` failure (dead kitty socket, niri not running) is reported and
recorded per-sink in `~/.local/state/prism/sink-status.json`, never blocks
other sinks, and never corrupts state. Staleness is per-sink: each record
holds a snapshot of that sink's own bound params as applied, so an unrelated
`set` never marks it stale.

`prism doctor` reports three distinct conditions, in descending severity:

1. **Missing generated target** — a `generates` name with no file behind it.
   Hard failure; this is the one condition that can stop niri from starting.
2. **Orphan values** — a key in `values.yaml` with no definition, named
   alongside its `prism unset` remedy. Reported before resolution, which
   would otherwise throw on it.
3. **Stale or failed sink** — snapshot ≠ current values, an `ok: false`
   record, or no record at all.

The next `set` or an explicit `prism apply` heals 1 and 3; `unset` heals 2.

## Section 4: The noctalia plugin UI

A noctalia plugin (QML, same shape as the existing wali-panel/catwalk
plugins) that is a **pure client of the CLI** — zero built-in knowledge of
parameters, sinks, or semantics.

- **Bootstrap**: on open, runs `prism describe --json` and builds the UI
  from the result — one section per `ui.group`, one control per definition
  (`slider` / `toggle` / `color` / `select`), each showing current effective
  value and a liveness badge (live / reload / grayed-unbound).
- **Writes**: drag sampling is **liveness-gated** — only a param whose
  effective liveness is fully `live` is written during a pointer drag
  (sampled at ~10 Hz as an ordinary `prism set`); a reload-class or
  mixed-class pointer drag (e.g. gaps: glass live + niri reload) is not
  sampled and is written once on release, so its surfaces move together.
  Keyboard/wheel slider movement has no press/release boundary, so `moved`
  debounces a 100 ms ordinary `set` for every liveness class. Pointer release
  always issues a final ordinary `set`, applying every bound sink. **These
  input gates are the only drag-rate protection in the system** — the CLI has
  no liveness filter to fall back on, so a future high-frequency writer that
  is not this panel must implement its own.
  Because independently spawned processes can acquire the store lock out of
  launch order, the plugin **serializes its writes**: at most one `prism`
  subprocess in flight, with a FIFO pending queue in which successive drag
  samples of the *same* param coalesce to the newest — discrete writes
  (toggles, selects, unsets, group resets) are never dropped or reordered.
  Release enqueues the final value and waits for the queue to drain,
  guaranteeing the released value is the last write. A queue drain containing
  only a drag sample deliberately skips `describe`: replacing the model while
  the pointer is pressed would reset the slider. Release and every discrete
  drain refresh normally, so badges and modified markers converge afterward.
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
   prism config wiring**: dotfiles setup links `~/.config/prism` to a
   host-specific directory in the repo (`prism/<hostname>/`, each holding
   that host's `values.yaml`) — gaps are per-host, and putting the host
   specificity in the directory link keeps every file under the write path
   a real file (atomic rename would destroy a `values.yaml` symlink). Seed
   each host's values, `git rm` the tracked `niri-glass.json`, and
   gitignore it — otherwise the first generated write dirties the dotfiles
   repo. Verify that installing the generated file causes **no visual
   change** against the QML defaults that are live today (see the
   niri-glass sink above). No *code* changes to existing components. Until
   step 4 the knobs are CLI-only (`prism set`); "live" means the change is
   visible the moment the command runs.
2. kitty sink + the `focus-opacity.py` patch in dotfiles; gitignore
   `kitty/prism-generated.conf`. In the same change, add the include in the
   correct position and delete `kitty.conf`'s static `background_opacity`
   line and its keep-in-sync comment (see the kitty sink above). Use SIGUSR1
   to prove the generated include reloads without a config error, but verify
   focus cooperation in a fresh temporary/new Kitty process: watcher Python
   is process-cached, so existing processes do not load the patch on config
   reload and converge only when restarted or closed.
3. niri sink (`prism.kdl` include, gitignored). Materialize the generated
   target and validate the tracked config by explicit path before linking that
   directory into `~/.config/niri` — a dangling include makes niri reject the
   whole config. With no running niri, only the reload failure is deferred and
   the validated config loads on first start; a running niri reloads after the
   link. Then delete the now-duplicated opacity/blur window-rule values,
   `gaps`, and the stale ownership table from `config.kdl`, and `gaps` from
   **both** `host-*.kdl` files.
4. noctalia plugin — sliders arrive here.
5. Remaining dotfiles wiring: noctalia plugin symlink, `dotfiles-health`
   runs `prism doctor`.

Two environment notes that shape the migration:

- **The dotfiles repo is inside cloud sync** (`~/d` is the Dropbox root), so
  `prism/<hostname>/values.yaml` is a synced file that prism rewrites via
  atomic rename. A sync client observing a mid-write rename can produce a
  conflicted copy. v1 ships no conflict-resolution mechanism and does not
  need one: writes are user-paced, the file is small and per-host, and the
  bus itself (`resolved.json`, `generated/`) lives in `~/.local/state`,
  outside sync entirely. Recorded so a stray `values (conflicted copy).yaml`
  is recognized rather than investigated.
- **Host selection now has two mechanisms.** dotfiles already selects host
  files by relinking `niri/host.kdl`; prism selects them by linking
  `~/.config/prism` at `prism/<hostname>/`. Both are host specificity
  expressed as a symlink, resolved at setup time, and they are not unified
  in v1 — worth knowing before adding a third.

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
- An optional daemon fast path for high-frequency modulation. Note that v1
  keeps drag-rate protection entirely in the noctalia panel (there is no
  CLI-side liveness filter), so any second high-frequency writer must bring
  its own gating or reintroduce one on the write path.
- ghostty sink (liveness `reload` on Linux via `reload_config` /
  `systemctl reload --user app-com.mitchellh.ghostty.service`) and other
  third-party sinks. This one closes a drift v1 leaves open rather than
  adding new reach — see the half-owned state noted in the scope table.
- UI controls for `list`/`string` params (v1 hides them via
  `control: none`).
- Folding the glass role table / `noctalia-glass-sync` pipeline into prism.
