# Debug backdrop sink

**Date:** 2026-08-29
**Status:** Proposed. Depends on the native niri material sink
(`docs/superpowers/specs/2026-08-28-niri-native-material-sink-design.md`),
whose Prism and dotfiles changes are implemented but not yet burned in.

## Context

Refraction is only as visible as whatever it refracts. The daily-driver
wallpaper is a photograph, and photographs have almost no high-frequency
straight-edge detail, so the parameters that bend and split light produce
changes an operator cannot see while tuning them.

This is not hypothetical. `glass.distortion` and `glass.distortionScale` were
reported as having no effect at the committed values. Investigation showed the
values were reaching the compositor correctly and the shader was consuming
them: at `distortionScale 0.05` the dominant noise octave completes 0.82
periods across a 1639 px window, which is a smooth gradient rather than a
visible warp. Raising the scale made the effect obvious immediately. The
control worked; the backdrop could not show it.

The native material sink deleted the previous diagnostic surface. That surface
was a separate `qs -c niri-glass` preview window carrying its own copy of the
material, which drifted from the real one and had to be maintained twice. Its
removal was correct and is not being reversed. What is missing is narrower: a
way to make the real material, on real windows, legible while tuning.

Two facts from the compositor decide the shape of the solution. Native niri
fills both xray buffers from `Layer::Background` only, so a diagnostic surface
is refracted by the glass exactly when it is a Background layer-shell surface;
anything on `Bottom` or above is not refracted at all. And layer-shell has no
intra-layer ordering control, so within `Background` the most recently created
surface stacks on top.

## Decision

Prism gains a `debug-backdrop` sink bound to one new boolean. When the value
is true the sink starts a small Quickshell configuration shipped in this
repository, which paints a high-contrast checkerboard with saturated axis
crosshairs on the `Background` layer. When the value is false the sink stops
it.

```text
Noctalia toggle
  -> prism set debug.backdrop
  -> debug-backdrop sink
  -> qs start or stop
  -> Background layer surface
  -> refracted by the live material on real windows
```

The wallpaper is never touched. The backdrop is a second Background surface
that covers it while running and reveals it again when stopped.

### Naming

The parameter is `debug.backdrop`, in a new `defs/debug.yaml`, not
`glass.debugBackdrop` as originally sketched.

The `glass.*` namespace is pinned by test to be exactly niri's native material
grammar — `test/glass-defs.test.js` asserts the `glass.` key set equals the
transcribed native parameter list, so that Prism can never offer a value the
compositor rejects. That invariant is worth more than the naming convenience.
A diagnostic backdrop is not a material parameter, and putting it under
`glass.` would mean weakening the one test that keeps the material surface
honest.

The definition is `{type: bool, default: false, ui: {group: Debug, control:
toggle, label: Debug backdrop, order: 500}}`. `ui.order` is unique across every
definition, not per group, and 500 sits clear of the current maximum of 410.

## Goals

- Make subtle refraction, fringing, and distortion legible while tuning, on
  real windows carrying the real material.
- Leave the Noctalia wallpaper, its rotation timer, its derived palette, and
  `walictl` completely unaware that the backdrop exists.
- Converge idempotently: applying the sink repeatedly at either value reaches
  the same state without accumulating processes.
- Ship no second copy of the material and no second definition of its
  parameters.

## Non-goals

- Reinstating a preview window. Live terminals remain the preview surface.
- Making the backdrop configurable. Cell size, colors, and crosshairs are
  fixed; a debug aid with its own settings surface is a second product.
- Compositor changes. Native niri gains no debug mode for this.
- Replacing or scheduling wallpapers. Prism does not enter that domain.

## Backdrop surface

`integrations/debug-backdrop/shell.qml` renders, per screen via `Variants` over
`Quickshell.screens`, a `PanelWindow` with:

- `WlrLayershell.layer: WlrLayer.Background` — required for the xray buffers to
  pick the surface up. `Bottom`, which the retired glass panes used, is not
  refracted.
- `WlrLayershell.namespace: "prism-debug-backdrop"` — identifies the surface in
  `niri msg layers`.
- `WlrLayershell.keyboardFocus: WlrKeyboardFocus.None`, `exclusionMode:
  ExclusionMode.Ignore`, and an empty `mask: Region {}` — the backdrop takes no
  input, reserves no space, and passes clicks through to the desktop.
- All four anchors set, painting a 64 px checkerboard in near-black and white
  with red horizontal and vertical center lines. The checkerboard's straight
  edges make distortion and anisotropic blur visible; the saturated lines make
  chromatic aberration visible.

A throwaway spike confirmed both load-bearing assumptions on the live system:
the surface stacks above Noctalia's wallpaper, and the glass material
genuinely refracts it.

## Sink contract

`integrations/debug-backdrop/manifest.yaml` declares `sink: debug-backdrop`,
`generates: []`, and one bind: `{param: debug.backdrop, liveness: live}`. The
sink produces no file, so there is nothing to link into dotfiles and nothing
for `prism doctor`'s generated-file check to look for.

`integrations/debug-backdrop/apply` resolves the absolute path of its sibling
`shell.qml` from `import.meta.url` and converges:

| Value | Command | Meaning |
|-------|---------|---------|
| true  | `qs -d -n -p <shell.qml>` | daemonize; `-n` exits immediately if an instance of this config already runs |
| false | `qs kill -p <shell.qml>` | kill the instance for this config |

The exit codes were verified against the installed `qs`:

- `qs -d -n -p` exits 0 both when it starts an instance and when it declines
  because one is already running. Start is therefore idempotent by
  construction, and any nonzero exit is a real failure.
- `qs kill -p` exits 0 when it killed an instance and 255 when there was none
  running. Both are the converged "stopped" state; any other nonzero exit is a
  real failure.

Convergence is driven by those exit codes rather than by parsing the instance
list, because `qs list --json` prints the plain sentence `No running
instances.` instead of `[]` when there is nothing to list — the empty case is
not valid JSON, so a list-parsing sink would need a special case for exactly
the state the exit codes already report unambiguously.

`-d` means `qs` daemonizes itself and the apply process returns immediately, so
the sink needs no detached-spawn machinery and finishes well inside `fanOut`'s
five-second timeout.

`liveness: live` is correct: a toggle takes effect at once with nothing to
reload or restart. Prism's `effectiveDrag` leaves it `live`, which is right for
a discrete control.

## Noctalia and wali boundary

The backdrop deliberately does not use the wallpaper path. Setting a
checkerboard through `noctalia msg wallpaper-set` or through wali's rotation
would regenerate the Material 3 palette from the checkerboard, be overwritten
by the next rotation tick, and leave `walictl` reporting a wallpaper the
operator never chose. Restoring afterwards would have to reverse all three.

Because the backdrop is a separate layer-shell surface, none of that happens.
Rotation keeps running underneath, the palette keeps deriving from the real
photograph, `noctalia msg wallpaper-get` keeps returning it, and
`noctalia/config.toml` is never written. Stopping the backdrop reveals the
wallpaper immediately with no restore step. The spike confirmed each of these
after teardown.

The Noctalia plugin needs no change. It renders definitions generically, and
`glass.enabled` already proves toggles render; a new `Debug` group sorts last
by `ui.order`. The plugin's `dependencies = ["prism"]` stays accurate — the
plugin still only calls `prism`, and `qs` is the sink's dependency, not the
plugin's.

## Failure behavior

A nonzero exit other than the converged cases above fails the sink. `fanOut`
records it, `prism doctor` reports it, and nothing is retried or substituted.
The most likely cause is `qs` missing or no Wayland session, and both should be
loud.

Because the sink generates no file, `prism doctor` would otherwise report
`debug-backdrop: never applied` forever on a fresh machine. Dotfiles setup
therefore runs `prism apply debug-backdrop` in its graphical phase alongside
`prism apply niri`. Unlike the niri sink, this one has no cold-start artifact
to defer to, so setup treats its failure as fatal rather than accepting a
deferred case. At the tracked default of false this converges by way of `qs
kill` reporting nothing to kill, which needs no compositor and no Wayland
session.

The value is authoritative, like every other Prism value: leaving the backdrop
on across a reboot brings it back on at setup. Adding a special
do-not-persist rule for this one parameter would break the declarative
contract for no real benefit, since the panel toggle is one click away.

## Known limitation

Ordering within the `Background` layer is creation order, and layer-shell
offers no way to pin it. If Noctalia restarts while the backdrop is running,
Noctalia's wallpaper surface is created last and covers the backdrop. Toggling
the backdrop off and on restores it. This is worth documenting rather than
engineering around: Noctalia restarts are rare, the failure is obvious, and the
recovery is one click.

## Verification

Automated, in `test/debug-backdrop-sink.test.js`, modelled on
`test/niri-apply.test.js` with a fake `qs` on `PATH` that records its argv and
returns a scripted exit code:

- true invokes `qs` with exactly `-d -n -p <absolute shell.qml>`.
- false invokes `qs kill -p <absolute shell.qml>`.
- `kill` exiting 255 succeeds; `kill` exiting 1 fails the sink.
- start exiting nonzero fails the sink and the recorded status names it.

In `test/debug-defs.test.js`:

- `debug.backdrop` is a `bool` defaulting to false with a toggle control.
- No `glass.` key is added, so `test/glass-defs.test.js` continues to pin the
  material surface to the native grammar unchanged.
- `debug.backdrop` is bound by the `debug-backdrop` sink and by no other, so it
  can never reach generated `prism.kdl`.

Manual, once, on the live system: toggle on, confirm the checkerboard appears
and terminals refract it; confirm `niri msg layers` shows
`prism-debug-backdrop` alongside `noctalia-wallpaper` on `Background`; confirm
clicks pass through to the desktop; toggle off, confirm the wallpaper returns
and `noctalia msg wallpaper-get` is unchanged; confirm `prism doctor` is ok at
both values.

## Alternatives rejected

### Swap the wallpaper through Noctalia or wali

Hostile to three systems that currently work: it regenerates the Material 3
palette from a checkerboard, races the fifteen-minute rotation timer, and
desynchronizes `walictl`. Restoring correctly means reversing all three. The
layer-shell surface achieves the same visual result while touching none of
them.

### A wali plugin providing a debug wallpaper

Cleaner than calling `wallpaper-set` directly, but still routes a debugging aid
through the wallpaper pipeline and still regenerates the palette. It also puts
the toggle in a second place, when the whole point is that it sits beside the
parameters it helps tune.

### Reinstate a preview window carrying its own material

This is what was just deleted, and for good reason: a second copy of the
material drifts from the real one. The backdrop inverts the relationship —
instead of a fake window showing a fake material, real windows show the real
material against a legible background.

### A debug backdrop inside niri

The compositor could paint one itself, guaranteeing correct layer placement.
Rejected because it costs a compositor build and release for a tuning
convenience that Prism can deliver without touching niri, and because it would
put an appearance control outside the system that owns appearance controls.

### Ship the backdrop as a named Quickshell config

Launching by `qs -c <name>` requires a `~/.config/quickshell/<name>` symlink,
which is exactly the link the native material work removed. Launching by
`-p <path>` keeps the config self-contained in this repository with nothing to
install and nothing for dotfiles to link.
