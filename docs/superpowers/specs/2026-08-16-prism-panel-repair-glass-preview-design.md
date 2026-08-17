# Prism panel repair and isolated glass preview

**Date:** 2026-08-16
**Status:** Implemented and interaction-accepted on `main`; color correction
implemented in niri-glass `af7b05f`

Implementation commits: Prism `1c5d887`, `e480ffb`, `d392aad`, `a1fc62b`,
`7665605`, `eb3a865`, and `dc8ef4b`; niri-glass `6219993`, `12eb73d`,
`90bc36d`, and `bdb83e8`; dotfiles `0c7fb78`.
Pressed-slider follow-ups are Prism `93790d9`, `c783d13`, `13ce02c`, and
`c3a0a32`.
Transport, generated-consumer health, isolated preview creation, and
restoration passed; the ordered neutral-material sweep completed. Manual
Passes 1–2 accepted optimistic slider/toggle/color updates, reconciliation,
Reset alignment/clearing, and persistent Glass disable/re-enable across panel
and controlled Noctalia lifecycles. Preview show, diagnostic grid/wallpaper
switching, panel-close/reopen cleanup, Diagnostics layout, direct-IPC
click-through/focus, live Preview dragging, and immediate release/re-drag are
also accepted. Failed-write banner persistence, continued panel usability, and
post-restore recovery passed as well. The historical neutral sweep found an
opaque/milky flat face and correctly stopped before guessing a shader change.
Focused niri-glass fix `af7b05f` found that encoded `#263238` entered linear
shader math and Qt encoded it again as `#6c7a81`.

## Context

Live acceptance of the streamlined Noctalia panel exposed two separate
problems.

First, the panel is still denser and slower-feeling than intended. The
`Quick` heading repeats information already conveyed by the panel, native
Noctalia labels are too large for six basic controls at the current UI scale,
Reset icons align to the full parameter row rather than the value/control
line, and slider text waits for a complete `prism set` → fan-out → `prism
describe` round trip before it reflects a move.

Second, the glass controls were not changing the live layer. Prism correctly
wrote `resolved.json` and the generated `niri-glass.json`, but the consumer
path `~/.config/niri/niri-glass.json` was absent. The running niri-glass
instance logged that it had fallen back to built-in defaults. Its initial
niri event stream and wallpaper lookup also logged failures, so the layer
must be restarted and checked after the config path is repaired.

The observed milky appearance is not evidence that every material control is
broken. The current shader simulates transmission by sampling the wallpaper;
it does not sample compositor pixels. Its leading white-cast term is already
visible in the arithmetic: `mix(DIFFUSE, transmitted, 0.95)` retains 5% of
the white-derived diffuse color before adding HDR probe reflections and pale
attenuation. The output is an effectively opaque wallpaper-derived surface.
The broken consumer path prevented the controls that tune those terms from
taking effect.

## Goals

- Make the six basic controls fit comfortably without renaming backend
  groups or increasing the panel size.
- Make displayed control values respond immediately while retaining Prism's
  authoritative post-write refresh.
- Align one subtle Reset affordance with each control's value.
- Repair and health-check the generated niri-glass consumer path.
- Add a persistent, live `Glass enabled` switch in the panel title row.
- Add one transient, isolated preview that exposes the glass directly while
  the settings panel remains usable.
- Let the preview switch between the current wallpaper and a fixed neutral
  diagnostic background with a high-contrast grid.
- Determine the source of the milky appearance with a controlled neutral
  material test before changing the shader or shipped defaults.

## Non-goals

- A persistent above-window placement mode.
- Refracting or sampling terminal/compositor pixels from a Wayland client.
- Hiding, moving, spawning, or changing the opacity of real terminals.
- Dummy terminal processes.
- A full-screen preview with a Noctalia-panel cutout.
- User-selectable diagnostic colors, presets, or a preview color picker.
- Persisting preview state in `values.yaml` or `resolved.json`.
- A Prism daemon, a polling loop, or a second parameter transport.
- A shader redesign before the neutral-material test proves one is needed.

## 1. Panel layout

The panel keeps its existing preferred dimensions. The title row becomes:

```text
Prism                                      Glass  [on]
```

`Glass enabled` is a compact switch supplied by the conventional `Title`
presentation group. It is not a seventh basic-settings row.

The `Quick` group remains the semantic group used by definitions and sorting,
but its visible heading is removed. The six controls begin immediately below
the title/error area. Advanced sections keep their existing collapsed
headers and within-session expansion state.

Parameter rows use one compact Prism-owned label/description treatment for
all four control types. Labels step down from Noctalia's large setting label
to the medium theme size; descriptions remain small. The panel title steps
down from extra-large to large. Slider values step down from medium to small,
`on release`/`unavailable` hints use the extra-small size, and repeated
margins/row gaps shrink by one theme step. Global Noctalia font or UI scale is
never changed.

The Reset icon remains visible only for modified parameters. It sits in the
same control row and vertical alignment as the slider value, toggle, select,
or color value. An extra-small `on release` or `unavailable` hint sits at the
trailing edge of that control row immediately before Reset, so the hint stays
attached to the interaction it qualifies. The icon remains smaller and
lower-contrast than the primary control. Section Reset remains in the
advanced-section header. Because Prism owns the row labels, native control
labels and `defaultValue` indicators are disabled deliberately; the Reset icon
is the sole per-parameter modified marker, while the header count remains the
section-level marker.

When the body overflows, the native `NScrollView` scrollbar reservation stays
enabled. Explicitly disabling `reserveScrollbarSpace` clipped the right edge
of Diagnostics Reset buttons under the scrollbar; `eb3a865` removed that
override. The native gutter was still visually tight, so `dc8ef4b` adds
`userRightPadding: Style.marginS` without replacing the native reservation.
Its final visual spacing remains an explicit acceptance check.

## 2. Optimistic control state

Each `ParamControl` owns a local displayed value initialized from
`param.value`. User interaction updates that local value before enqueueing the
write:

```text
input → local displayed value → Prism queue → set/fan-out → describe refresh
```

Sliders bind both their thumb and formatted text to the local value. Toggle,
select, and color controls use the same rule so the panel has one response
model. Pointer samples still coalesce through the existing queue, and
sample-only drains still skip `describe`; refreshing every sample would
destroy the pressed delegate and regress live dragging.

The client's pressed-slider state spans the full pointer press, not merely
sample writes. If a prior release drains after the next press but before that
new drag emits its first `onMoved` sample, reconciliation remains deferred
until release. Otherwise `describe` can rebuild the delegate and strand the
second grab. Fix `93790d9` implements that lifetime and clears it on
release or delegate destruction; `c783d13` discards an in-flight result while
pressed. `13ce02c` invalidates the process result at press time, so it remains
discarded even if press and release both finish before exit, and then replays
one fresh description. Final `c3a0a32` preserves that invalidation when a
refresh/replay starts while the slider remains pressed. The series is reviewed,
merged, and loaded. The user accepted the post-restart immediate release then
re-click/drag retest with no sticking.

The post-write `describe` response remains authoritative. Delegate refresh
reconciles the local value, `modified` state, and Reset visibility with the
stored result. A failed write keeps the existing banner behavior and the
following refresh rolls the optimistic value back. The CLI does not adopt
optimistic or quantizing behavior. Reassigning `root.groups` after `describe`
is load-bearing: it recreates delegates and restores the `displayedValue`
binding. Any future in-place model update must add explicit reconciliation
before removing that assignment.

## 3. Persistent glass enablement

Add one definition:

```yaml
- key: glass.enabled
  type: bool
  default: true
  ui: {group: Title, control: toggle, label: Glass, order: 0}
  description: Render the niri glass layer
```

The niri-glass manifest binds it as `live`, and the generated JSON contains
`enabled`. `Title` joins `Quick` as a presentation convention understood by
the presentation helper: `titleParam(params)` extracts the single `Title`
member, while `groupParams(params)` excludes `Title` and retains its existing
body-group result with `Quick` first. The body-group array and its 32-control
coverage therefore stay unchanged; the extracted title toggle plus the body
cover all 33 visible controls exactly once. The shipped definitions must
contain exactly one `Title` member and it must be a toggle. QML renders the
routed definition and never names `glass.enabled`. This section supersedes
the earlier streamlined-panel statement that `Quick` was the only
conventional group.

The closed niri-glass schema makes the cross-repository landing order
load-bearing:

1. Add `conf.enabled: true` to niri-glass first.
2. Add `"enabled": true` to
   `test/fixtures/niri-glass-seed.json`, which mirrors those QML defaults.
3. Add the Prism definition and live manifest binding.

Step 2 deliberately makes `test/glass-defs.test.js` fail on the missing
definition; Step 3 returns it to green. The completed Prism change proves
that every `glass.*` definition has a seed key and every seeded default equals
QML.

niri-glass adds `conf.enabled: true`. When false, the normal glass scene is
hidden without stopping Prism or the Noctalia panel. The config watcher stays
alive so re-enabling is immediate. The isolated preview is independent: a
user may preview and tune glass while the normal layer is disabled.

Implementation keeps the transparent click-through `PanelWindow` alive and
gates only its normal `View3D` and calibration overlay. The first
implementation bound `PanelWindow.visible` directly to `conf.enabled`;
false→true recreated the Quick3D surface and crashed in
`QQuick3DSceneManager::setWindow`. Regression fix `90bc36d` preserves the
layer-shell/input surface, passed 57/57 tests and Qt 6 lint, and survived a
live false→true transition in the same process. Independent review approved
the focused fix.

`Glass enabled` uses the normal sparse-store rule. Setting it to its default
removes the override; setting it false persists across panel openings,
Noctalia restarts, login, and reboot.

Live acceptance confirmed false persisted through panel close/reopen and a
controlled Noctalia stop/start, the fresh panel still showed off, and enabling
restored glass immediately. A second off/on cycle repeated the result without
the prior `prism exited 255` banner. An earlier anomalous first restart was not
reproducible when the value was checked before stop, while stopped, and after
restart, so no speculative fix was added for it.

## 4. Isolated preview

### Surface

niri-glass owns a second, normally hidden `PanelWindow` on the panel's screen.
It is a large bounded surface anchored on the side opposite the Prism panel,
not a full-screen layer. It uses:

```qml
WlrLayershell.layer: WlrLayer.Overlay
WlrLayershell.keyboardFocus: WlrKeyboardFocus.None
exclusionMode: ExclusionMode.Ignore
mask: Region {}
```

The surface therefore renders above ordinary windows but cannot take pointer,
touch, or keyboard input and does not reserve workspace space. Because it is
isolated from the panel rectangle, it does not rely on same-layer map order or
a compositor-specific visual cutout.

In logical pixels, its width is `min(1200, screen.width * 0.42)`, its height is
`min(900, screen.height * 0.70)`, and it is vertically centered with a 32 px
margin from the chosen screen edge. The representative slab occupies 75% of
the preview in each dimension. These bounds leave the 560 px Prism panel and
the preview side by side on the supported desktop while remaining useful on a
1920 px output.

The preview renders one representative, chamfered slab rather than replaying
live terminal geometry. It consumes the same `conf` material values as real
panes. niri-glass extracts the shared custom material/uniform bindings into a
single composed component used by the real panes and the preview; the shader
contract is not duplicated.

The transparent, input-empty preview `PanelWindow` remains mapped for the
life of the niri-glass process. Preview selection gates its only visual
children—the background `Image` and `View3D`—instead of toggling the window's
`visible` property. The original show → panel-close/hide path recreated the
Quick3D surface and crashed in `QQuick3DSceneManager::setWindow`; `bdb83e8`
keeps the same process alive through show/hide while preserving an invisible,
click-through idle surface.

### Background

The preview has two panel-local background modes:

- `Wallpaper`: crop-fill the current wallpaper.
- `Diagnostic background`: replace it with neutral slate `#263238` and draw
  the existing 40 px minor / 200 px major grid at increased contrast.

The fixed color is deliberately not configurable. Spatial grid detail makes
refraction, distortion, blur, and chromatic separation visible without
wallpaper clutter. The preview's texture is the same background it displays,
so the material samples a coherent backdrop.

### Transient IPC contract

Preview state belongs to niri-glass memory and is controlled through native
Quickshell IPC, not Prism values. niri-glass exposes an `IpcHandler` target
`prismGlass` with two idempotent calls:

```text
showPreview(output: string, side: "left" | "right", diagnosticBackground: bool)
hidePreview()
```

Unknown outputs and invalid sides fail loudly. Calling `showPreview` while
visible updates or moves the existing preview. Calling `hidePreview` while
hidden succeeds.

Dotfiles setup installs the niri-glass source directory as the named
Quickshell config `$XDG_CONFIG_HOME/quickshell/niri-glass`, and niri launches
it with `qs -c niri-glass`. The plugin uses the same stable selector for IPC:

```text
qs -c niri-glass ipc call prismGlass ...
```

No personal source path, environment override, or `qs list` parser enters
plugin code. `PrismClient` serializes the fixed IPC command shape, reports
non-zero exits through the existing error banner, and ensures a final
`hidePreview` cannot be overtaken by an earlier toggle.

Preview queue items have explicit `preview-show` and `preview-hide` command
shapes in `Queue.argvFor`; they cannot fall through to the `prism set`
default. `Queue.affectsParams(item)` distinguishes ordinary parameter writes
from preview calls. `PrismClient` remembers whether any item in a batch
affects parameters and refreshes at drain only when that flag is true **and**
the last completed item is not a sample. Thus preview-only and sample-only
batches do not refresh; a parameter write followed by Preview does refresh;
and `[final, sample]` defers refresh to the active drag's later release rather
than destroying its pressed delegate.

When Preview is enabled, the panel compares its global center with its
screen geometry's global center and asks niri-glass to anchor on the opposite
side, passing `panelOpenScreen.name` as the output. Changing the
diagnostic-background toggle calls `showPreview` again with the same output
and side. `Panel.Component.onDestruction` enqueues `hidePreview`, so closing
the panel clears preview even when the user forgets to toggle it off. Opening
the panel starts from Preview off; restarting niri-glass also starts hidden.

Clicking outside Noctalia's `SmartPanel` closes it, and panel destruction
enqueues `hidePreview` by contract. Pointer pass-through therefore cannot be
validated by clicking behind the preview while the settings panel remains
open: the panel closes first and intentionally hides the preview. Acceptance
uses the same preview IPC directly, with the settings panel closed, to test
click-through and focus behavior independently of SmartPanel dismissal.

The Preview and Diagnostic-background toggles form the first compact row in
the existing Diagnostics section. Diagnostic background is visible/enabled
only while Preview is active. Preview state does not affect modified counts
or Reset actions. `Diagnostics` is the third and final presentation convention:
the panel inserts these transient controls before that group's parameter
repeater. Unlike `Title`, it remains a normal body group returned by
`groupParams`.

Those two controls use a `ColumnLayout`: making Diagnostic background visible
must not shift the always-visible Preview toggle. The earlier `RowLayout`
moved Preview when the conditional control appeared; `dc8ef4b` corrected the
layout, subject to final visual confirmation.

## 5. Generated-file repair and health

The persistent bus remains:

```text
values.yaml
  → resolved.json
  → generated/niri-glass.json
  → ~/.config/niri/niri-glass.json symlink
  → niri-glass FileView
```

Dotfiles setup remains the sole creator of the consumer symlink. The repair
reruns that existing step after the generated file exists, then restarts
niri-glass so the first successful load is observed.

The same setup phase creates the named Quickshell config link and changes the
niri startup command from a source-path launch to `qs -c niri-glass`. The
source checkout remains wherever dotfiles setup expects it; neither Prism QML
nor the generated configuration embeds that location.

`dotfiles-health` gains an exact check that the consumer path exists and
resolves to the generated file, plus an exact check that the named Quickshell
config resolves to the niri-glass source directory. It also fails if
`$XDG_CONFIG_HOME/quickshell/shell.qml` exists or is a symlink, because
Quickshell then treats that root path as the default configuration and does
not discover named subdirectories. `prism doctor` continues to validate
Prism's generated target and sink snapshots; it does not claim ownership of
external config-path wiring. Documentation must distinguish those two health
boundaries.

The live repair preserves the current host `values.yaml`, including
experimental geometry values. Tests snapshot and restore it atomically. No
default reset or cleanup is inferred from the dirty dotfiles worktree.

After restart, acceptance verifies all of the following before material
tuning:

- FileView logs no missing-config warning.
- Generated writes change the file observed through the consumer path.
- The niri event stream has populated panes on a workspace containing a
  configured terminal app.
- Wallpaper IPC returns a non-empty current path.

If the event stream or wallpaper lookup still fails after restart, diagnose
that first broken link and add a focused regression. Do not add speculative
polling or recovery code merely because the old instance logged one failure.

## 6. Milky-glass diagnosis

The preview provides a controlled test before changing shader behavior or
defaults. Snapshot the user's values, then apply this ordered cumulative
sweep:

```text
transmission = 1
probe exposure = 0
attenuation color = #ffffff
roughness = 0
```

The first step removes the white diffuse term exactly; if it substantially
reduces the cast, the shader arithmetic has identified transmission as the
cause. The second removes HDR probe contribution, the third removes volume
tint, and the fourth removes mip blur. Record the visual delta after each
step. At the final neutral state, the slab's flat face should reproduce the
diagnostic grid without a white cast; chamfers may still refract. Restore the
snapshot atomically afterward.

If the neutral combination is clear, the transport repair and preview solve
the reported inability to tune the look; shipped defaults do not change in
this work. If it remains milky, add a failing shader/render regression where
possible and change only the responsible diffuse/specular term. Do not mask
the problem with arbitrary new presets.

**Focused follow-up result (2026-08-17):** `tap()` now composites the
procedural grid in encoded space and decodes the completed sample once before
attenuation and lighting. Runtime acceptance reproduced `#263238` on the
isolated neutral face and confirmed normal procedural-grid parity.

## 7. Error handling and ordering

- Config-link failure is a dotfiles-health failure, not a silent successful
  install.
- Persistent parameter writes retain the existing FIFO, sample coalescing,
  error banner, and authoritative refresh.
- Preview calls are discrete and ordered; close-time `hidePreview` is last.
- A drained batch runs `describe` only if it contained a parameter-affecting
  write and its last completed item was not a sample. This preserves both
  mixed preview refreshes and an active second drag.
- A preview IPC failure leaves the persistent settings usable and displays
  the existing banner.
- Closing the panel never writes Preview or Diagnostic background into
  `values.yaml`.
- `glass.enabled` is persistent and is not reset when the panel closes.

## 8. Verification

### Automated

- niri-glass lands `conf.enabled: true` before Prism updates the closed-schema
  seed fixture, definition, manifest binding, and generated-output tests.
- `test/glass-defs.test.js` proves the new QML default, seed key, and Prism
  default agree.
- Shipped presentation tests retain exactly six Quick controls, route one
  toggle through `titleParam`, keep `Title` out of `groupParams`, retain the
  existing body-group order including the conventional `Diagnostics` group
  and 32-control coverage, and cover all 33 visible controls exactly once
  across both results.
- Panel source-contract tests cover removal of the visible `Quick` heading,
  compact type sizes, control-row Reset alignment, the absence of inert native
  `defaultValue` configuration, local optimistic values, the load-bearing
  delegate rebuild, and close-time preview cleanup.
- Queue/client tests prove preview commands have explicit argv shapes, do not
  trigger preview-only refreshes, preserve a required mixed-batch refresh,
  suppress refresh for `[final, sample]`, remain ordered, and never drop the
  final hide.
- niri-glass tests cover IPC validation/idempotency, opposite-side selection,
  background selection, shared material use, and `enabled` behavior.
- Dotfiles health tests fail for a missing, dangling, or wrong consumer link
  or named Quickshell config link, and for a root
  `quickshell/shell.qml` that disables named-config discovery.
- Node suites, Qt 6 `qmllint`, niri-glass tests, `prism doctor`,
  `dotfiles-health`, shell syntax, and diff checks pass.

### Live acceptance

1. Repair the consumer symlink, restart niri-glass, and prove config, event,
   wallpaper, and pane data are healthy.
2. Open Prism: the title switch and all six basic controls fit comfortably;
   no `Quick` heading is shown.
3. Move every control type: its displayed value changes immediately, then
   agrees with the authoritative refresh.
4. Modified Reset icons align with their values/controls and clear correctly.
5. Disable glass, close/reopen the panel and restart Noctalia: the normal
   layer remains disabled. Re-enable it and confirm immediate return.
6. Enable Preview: a large isolated surface appears opposite the panel and
   remains click-through and non-focusable while controls stay usable.
7. Toggle Diagnostic background: the preview switches between wallpaper and
   neutral grid without touching persistent values.
8. Change several glass values: the preview responds live before pointer
   release and stores the final values correctly.
9. Toggle Preview off, then on again and close the panel: both paths remove
   the preview. Reopening starts with Preview off.
10. Run the neutral-material sequence, record whether milkiness remains, and
    restore the user's values atomically.

## 9. Alternatives rejected

- **Hide real terminals:** affects interactive windows, crosses kitty/niri
  behavior, and makes restoration a data-loss boundary.
- **Full-screen overlay:** would need a panel-position cutout or accidental
  same-layer ordering to keep settings visible.
- **Persistent above mode:** cannot refract compositor pixels and would
  misrepresent wallpaper-derived blending as terminal glass.
- **Dummy terminal:** adds a process and lifecycle that contributes nothing
  to material evaluation.
- **Persist preview as a Prism definition:** pollutes host configuration and
  can survive the panel it belongs to.
- **Solid-color picker/presets:** a fixed neutral grid answers the diagnostic
  question with less UI and no new persistent schema.
- **Refresh after every drag sample:** recreates pressed delegates and revives
  the failure the sample-refresh guard already prevents.

## 10. Documentation impact

Implementation must update:

- the Prism/Noctalia plugin contract note;
- the visual-bus design and v1 plan where visible-parameter counts, Quick
  structure, live acceptance, generated-file health, or niri-glass ownership
  are stated;
- the streamlined-panel design and plan, whose live-acceptance claims are now
  superseded by this repair, including the “one conventional group” wording;
- Task 6 Step 1's literal `jq` predicate: total parameters become 34,
  `ui.control != "none"` parameters become 33, and Quick remains six;
- niri-glass README/config documentation for `enabled`, the preview IPC, and
  the material's wallpaper-sampling limitation;
- dotfiles setup/health documentation for the consumer-link check.

Status headers and checkboxes change only after their claims are verified
against the relevant repository histories and live system.
