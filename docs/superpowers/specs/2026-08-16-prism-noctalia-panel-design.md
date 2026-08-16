# Prism Noctalia panel design

**Status:** Draft — interaction design approved; written-spec review pending

**Date:** 2026-08-16

## Purpose

Prism's first Noctalia panel proves that definitions can generate working
controls, but it exposes that machinery too directly: 32 visible parameters
appear as long compositor, glass, and terminal lists. Backend ownership and
`live`/`reload` labels are prominent while the visual outcome a person wants
is hard to find.

The revised panel is an everyday appearance control first and a complete
tuning surface second. It presents a six-control Quick section, hides the
remaining controls in semantic collapsed sections, explains each control in
one line, and keeps the definition files as the source of UI organization.

The same change also completes the manual acceptance check for live glass
updates. The live path already exists; this work verifies it end to end and
fixes that path only if the visible effect does not track the slider.

## Goals

- Make the default panel short enough to scan without understanding kitty,
  niri, niri-glass, sinks, or liveness classes.
- Put the six common appearance controls in one mixed Quick section.
- Keep every existing visible parameter available in collapsed, semantic
  advanced sections.
- Show concise, always-visible help for each control.
- Compose Noctalia's native controls and theme rather than introducing a
  Prism-specific visual system.
- Make glass sliders visibly track pointer drags before release.
- Use `Reset` consistently for returning values to their definitions.
- Make the bar widget look like its neighboring small monochrome icons.

## Non-goals

- Presets, search, favorites, or user-configurable Quick controls.
- Persisting expanded/collapsed state between panel openings.
- Duplicating a parameter in both Quick and Advanced.
- A new daemon, IPC channel, in-process glass state, or CLI liveness flag.
- Continuous preview while the color-picker dialog is open. A color applies
  when the picker accepts it.
- Redesigning Prism's values, resolution, queue, or sink contracts.

## Definition-driven presentation contract

The panel continues to render `prism describe --json`; it does not contain a
list of Prism parameter keys. Existing `ui` metadata gains three fields:

```yaml
ui:
  group: Quick
  label: Focused terminal opacity
  order: 10
  control: slider
  step: 0.01
  drag: release
```

- `ui.label` is the human-facing control name.
- `ui.group` is a human-facing semantic section, no longer backend ownership.
- `ui.order` is a unique integer across visible definitions.
- `ui.control` and `ui.step` keep their current meanings.
- `ui.drag` is required for sliders and is either `live` or `release`.
  Pointer sampling occurs only when it is `live` and every sink binding is
  live. Other control types do not declare it.

Every definition whose control is not `none` must have a non-empty label and
a unique integer order. Definition loading fails early when either condition
is violated. A slider must also have a valid drag mode. Hidden definitions do
not need `ui.label` or `ui.order`.

`validateDef` checks one definition's label and integer order. `loadDefs`
checks order uniqueness after every definition file has loaded, because that
constraint crosses files. The presentation sort is explicit:

1. `Quick` is rendered first regardless of its numeric orders.
2. Advanced sections are ordered by their lowest member order.
3. Controls within a section are ordered by their own order.

Orders from different advanced sections may interleave; the minimum-member
rule makes that case unambiguous, so contiguity is not a validation
requirement.

`Quick` is the one conventional group name understood by the panel. It is
rendered directly and always open. Every other group starts collapsed behind
a quiet inline header composed from Noctalia's `NIcon`, `NText`, and
`NIconButton` primitives. The shipped `NCollapsible` is deliberately not
used: its private saturated header cannot expose the agreed Reset action or
modified count.

The panel root holds an `expandedGroups` map keyed by group name. Sections
read it through a binding and toggles update it through a helper that copies
the old keys into a new object and reassigns the property. In-place object
mutation is forbidden because QML would emit no change notification; object
spread is also forbidden because QV4 cannot parse it. A refresh may replace
`root.groups` and recreate every delegate, but each rebuilt section restores
its state from the map. Closing the panel destroys the root and therefore
discards the map, so all advanced sections start collapsed on the next open
without persisted settings.

The `describe` response shape changes additively: its existing `ui` object
carries the new fields without changing the top-level shape or write
commands. The shipped `ui.group` values intentionally change meaning and are
not preserved as backend names; the Noctalia panel is their only current
consumer. A future integration can place a new control by declaring its
label, group, and order; QML still does not need to know the parameter key or
sink.

## Information architecture

Quick contains the six everyday controls and mixes implementations on
purpose. From the user's perspective they all change window appearance.

| Parameter | Label |
| --- | --- |
| `terminal.background.opacity.active` | Focused terminal opacity |
| `terminal.background.opacity.inactive` | Unfocused terminal opacity |
| `compositor.gaps` | Window spacing |
| `glass.roughness` | Glass blur |
| `glass.transmission` | Glass clarity |
| `glass.attenuationColor` | Glass tint |

The remaining controls appear once in these collapsed sections:

| Section | Parameters and labels |
| --- | --- |
| Opacity & Focus | `terminal.window.opacity.active` — Focused window opacity; `terminal.window.opacity.inactive` — Unfocused window opacity; `terminal.blur` — Background blur; `terminal.saturation.active` — Focused saturation; `terminal.saturation.inactive` — Unfocused saturation; `terminal.noise.active` — Focused noise; `terminal.noise.inactive` — Unfocused noise |
| Glass Shape | `glass.paneLip` — Edge bevel; `glass.paneShiftX` — Horizontal pane offset; `glass.paneShiftY` — Vertical pane offset |
| Glass Optics | `glass.ior` — Refraction; `glass.thickness` — Glass thickness; `glass.attenuationDistance` — Tint depth; `glass.chromaticAberration` — Color fringing; `glass.distortion` — Distortion; `glass.distortionScale` — Distortion scale; `glass.anisotropicBlur` — Directional blur |
| Motion | `glass.jellyFlex` — Flex; `glass.jellyRipple` — Ripple; `glass.springDampingRatio` — Motion damping; `glass.springStiffness` — Motion stiffness; `glass.springEpsilon` — Settle threshold |
| Diagnostics | `glass.gridOverlay` — Drafting grid; `glass.calibrate` — Calibration visuals; `glass.probeExposure` — Wallpaper exposure; `glass.samples` — Render samples |

`terminal.apps` remains hidden with `control: none`.

## Panel behavior and appearance

The existing panel header, scroll container, and error banner remain. Inside
the scroll area:

1. Quick renders in a simple themed surface with six controls.
2. Advanced groups render below it behind quiet, theme-native headers.
3. Closing and reopening the panel returns all advanced groups to collapsed.

`NValueSlider`, `NToggle`, and `NComboBox` receive `ui.label`, `description`,
and `defaultValue` through their native properties, including their native
modified indicator. `NColorPicker` is the only control wrapped in an
`NLabel`, because it does not expose those properties.

All four control types use one Prism-owned Reset affordance: a fixed-width,
small trailing `NIconButton` in the same position, visible only when the
parameter is modified, with tooltip `Reset to default`. It calls `unset`.
`NValueSlider.showReset` remains false; its native button has different
geometry and routes through `moved`, so mixing it with the other controls
would make Reset inconsistent.

Each slider also shows a quiet `on release` hint when `ui.drag` is `release`
or any binding is not live. A fully live-drag slider shows no hint. An
unbound control (`effectiveLiveness === null`) is disabled and labeled
`unavailable`; it is not misrepresented as merely slow. The implementation
terms `live`, `reload`, sink names, and backend group names are not shown.

Numeric values are rounded to the precision implied by `ui.step`, then
trailing fractional zeros and a trailing decimal point are removed. Thus
`2.2199999999999998` displays as `2.22`, `0.000100` as `0.0001`, and `0.0040`
as `0.004`.

Every visible numeric definition must satisfy the snapped-slider invariant:
`(default - range[0]) / step` is an integer within floating-point tolerance.
An automated check covers the entire shipped definition set. Six current
steps change so every default is representable:

- `glass.thickness`: `2` -> `0.1`
- `glass.attenuationDistance`: `100` -> `1`
- `glass.distortionScale`: `0.1` -> `0.01`
- `glass.springDampingRatio`: `0.1` -> `0.05`
- `glass.springStiffness`: `100` -> `1`
- `glass.springEpsilon`: `0.01` -> `0.000001`

Representable does not mean every value is selectable by pointer on a finite
track. In particular, the linear `springEpsilon` range spans about one
million steps; its default is exact through Reset and keyboard/wheel input,
but pointer drag is coarse near the lower bound. A logarithmic control would
be a separate UI type and is out of scope.

Native control indicators and section modified counts use Noctalia's normal
accent color. The quiet section header exposes a small Reset-section action
only when the section contains modified values. The selected glass tint is
the only parameter-specific color accent; the rest of the panel uses
Noctalia's surface, text, outline, error, and accent colors.

Resetting a section enqueues one `unset` for each modified member through the
existing FIFO queue; no special bulk command is added.

## Bar widget

The bar entry point keeps `NIconButton` and copies the installed
`keybind-cheatsheet` capsule contract exactly:

- `baseSize: Style.getCapsuleHeightForScreen(screen?.name)`
- `applyUiScale: false`
- `customRadius: Style.radiusL`
- `colorBg: Style.capsuleColor`
- `colorFg: Color.mOnSurface`
- `colorBgHover: Color.mHover`
- `colorFgHover: Color.mOnHover`
- `colorBorder: "transparent"`
- `colorBorderHover: "transparent"`
- `border.color: Style.capsuleBorderColor`
- `border.width: Style.capsuleBorderWidth`
- `tooltipDirection: BarService.getTooltipDirection(screen?.name)`

`BarService` requires the `qs.Services.UI` import. The icon changes from
`palette` to the monochrome `wand` glyph.

The current mismatch is not the common rounded shape. On this bar,
`showCapsule: false` makes the native capsule color transparent, while Prism
currently uses `NIconButton`'s filled surface-variant background, outline,
primary foreground, default size, and double UI scaling. Matching the native
contract removes those conspicuous differences while preserving the normal
hit target, hover behavior, and panel toggle API.

## Live glass behavior

The current data path is the intended real-time mechanism:

```text
pointer drag
  -> `ui.drag: live` plus fully-live sink bindings
  -> sample gate opens at most once each 100 ms
  -> serialized `prism set`
  -> atomic values/resolved update
  -> atomic niri-glass JSON replacement
  -> niri-glass FileView reload
  -> visible glass property update
```

Every `glass.*` manifest binding is already `live`. A glass slider therefore
samples while pressed and sends one ordinary final write on release. The
sample marker affects queue coalescing only; it does not create a different
CLI command. Toggle and accepted-color changes are discrete writes.

The two terminal-background opacity parameters remain live-capable through
kitty's socket adapter but declare `ui.drag: release`. Each kitty apply first
sets every OS window to the inactive opacity, performs a `kitten ls` JSON
round-trip, then restores the focused window to the active opacity, per
socket. Repeating up to three kitten subprocesses per socket during drag
would be slow and could visibly flicker the focused terminal between inactive
and active.
The panel therefore writes both opacity sliders once per pointer release and
labels them `on release`; keyboard/wheel input retains its ordinary debounce,
and discrete CLI sets still use the live adapter immediately.

Parameters with reload or mixed bindings are not sampled during pointer
drag. A `ui.drag: release` override has the same interaction. Both show `on
release` and write once on release, retaining Prism's no-partial-drift
contract. `compositor.gaps`, for example, must not move the glass panes ahead
of the compositor gaps.

The 100 ms gate is an upper bound, not a promised observed rate: each sample
still spawns and serializes a complete `prism set`, so slow writes reduce the
frequency. Acceptance requires visible tracking before pointer release, not
merely a changing generated file or a measured 10 Hz rate. If that fails,
diagnosis follows the existing path from QML signal through FileView reload.
No parallel state channel is added.

## Errors and write lifecycle

The persistent `PrismClient`, serialized FIFO queue, sample coalescing,
release ordering, refresh coalescing, and pending keyboard/wheel flush remain
unchanged. Replacing the described model must preserve the panel root's
expanded-group map, and collapsing a section must not discard a pending
write.

CLI failures continue to appear in the existing error banner. Presentation
errors fail at definition load time rather than silently placing a control in
an arbitrary section.

## Verification

Automated checks cover:

- visible definitions require a label and unique integer order;
- slider definitions require an explicit `live` or `release` drag mode;
- every shipped `ui.drag: live` slider has fully live sink bindings;
- the cross-file duplicate-order check runs in `loadDefs`, while per-def
  label/type checks remain in `validateDef`;
- shipped definitions produce the exact six Quick keys and all remaining
  visible keys exactly once;
- sorting produces the specified section and control order;
- every shipped numeric default satisfies the snapped-slider invariant;
- numeric formatting follows slider step precision and trims trailing zeros;
- every inline YAML fixture passed through `loadDefs` gains valid
  label/order/drag metadata before the error it intends to exercise, so
  validation tests retain their original targets; direct `Map` fixtures for
  resolver/value unit tests do not cross this loading boundary and remain
  minimal;
- Reset still routes through the existing client/queue contract;
- refreshing after a write preserves expanded sections within the current
  panel instance, and the map helper reassigns rather than mutating in place;
- Panel.qml's source-contract tests are re-anchored to the new delegates while
  retaining their sample-refresh, keyboard/wheel, release, and destruction-
  flush assertions; they also require both `ui.drag: live` and fully live
  bindings before pointer sampling;
- the bar widget uses the native capsule properties and `wand`; and
- QML lint plus the complete Node suite remain clean.

Manual acceptance must load the code under test. Before restarting Noctalia,
temporarily point its Prism plugin link at this worktree's
`integrations/noctalia-plugin`, or run acceptance after the branch has merged
and the permanent link resolves to that merge. Restore the permanent target
if acceptance aborts.

Manual acceptance covers:

1. Open Prism: Quick is immediately visible and every advanced section is
   collapsed.
2. Expand sections, close the panel, and reopen it: they are collapsed again.
3. Expand a section and change a value: the post-write refresh leaves that
   section open for the rest of the current panel session.
4. Drag several glass sliders: the visible panes track before release; the
   final displayed and stored values agree.
5. Drag the two terminal-background opacity sliders: nothing applies
   mid-drag; release applies the final values once rather than producing
   repeated drag-rate flicker, and the stored focused/unfocused values agree
   with Prism.
6. Drag Window spacing: nothing applies mid-drag; compositor gaps and glass
   panes move together on release.
7. Use parameter and section Reset actions: defaults return, modified accents
   and counts clear, and no queued unset is lost.
8. Exercise a failing sink: the error banner remains visible and the panel
   remains usable.
9. Compare the bar beside neighboring widgets: `wand` is monochrome and its
   size, foreground, background, border, and hover treatment match them.

## Documentation impact

When implementation lands, update the v1 visual-bus design and plan where
they still describe backend-named groups, visible liveness badges, or an open
manual live-glass panel contract. They must also distinguish sink liveness
capability from the new explicit pointer-drag mode: kitty remains live-capable
but its opacity sliders are release-only. Their status headers and checkboxes
must be corrected only after the corresponding tree and manual evidence
exist.

Update `docs/notes/noctalia-plugin-contract.md` with the verified capsule
properties, quiet section composition, and the reason `NCollapsible` is not
used.
