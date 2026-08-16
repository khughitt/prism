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
- Use Noctalia's native components and theme rather than a Prism-specific
  visual system.
- Make glass sliders visibly track pointer drags at the existing roughly
  10 Hz sample rate.
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
list of Prism parameter keys. Existing `ui` metadata gains two fields:

```yaml
ui:
  group: Quick
  label: Focused terminal opacity
  order: 10
  control: slider
  step: 0.01
```

- `ui.label` is the human-facing control name.
- `ui.group` is a human-facing semantic section, no longer backend ownership.
- `ui.order` is a unique integer across visible definitions. Sorting visible
  parameters by this number determines both section order and control order.
- `ui.control` and `ui.step` keep their current meanings.

Every definition whose control is not `none` must have a non-empty label and
a unique integer order. Definition loading fails early when either condition
is violated. Hidden definitions do not need `ui.label` or `ui.order`.

`Quick` is the one conventional group name understood by the panel. It is
rendered directly and always open. Every other group uses Noctalia's native
`NCollapsible` and starts collapsed. The panel is recreated when opened, so
expanded state is deliberately not persisted.

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
2. Advanced groups render below it as native collapsibles.
3. Closing and reopening the panel returns all advanced groups to collapsed.

Each parameter row has:

- a human label;
- its existing definition description as a concise, always-visible line;
- the existing slider, toggle, select, or color control;
- a small, borderless Reset icon only when modified, with tooltip
  `Reset to default`; and
- a quiet `on release` hint only when `effectiveLiveness` is not `live`.

Fully live parameters have no badge. The implementation terms `live`,
`reload`, sink names, and backend group names are not shown. Numeric values
are formatted to the precision implied by `ui.step`, so values such as
`2.2199999999999998` display as `2.22`.

Modified labels and counts use Noctalia's normal accent color. Collapsed
headers show a subtle modified count and a small Reset-section action only
when the section contains modified values. The selected glass tint is the
only parameter-specific color accent; the rest of the panel uses Noctalia's
surface, text, outline, error, and accent colors.

All Reset actions continue to call `prism unset` through the existing FIFO
queue. Resetting a section enqueues one unset for each modified member; no
special bulk command is added.

## Bar widget

The bar entry point keeps `NIconButton` and follows the same native capsule
configuration as the installed Noctalia plugin widgets:

- `baseSize` comes from the screen's capsule height;
- UI scaling is not applied twice;
- background, border, hover, and tooltip direction use the bar's style;
- foreground is `Color.mOnSurface`; and
- the icon changes from `palette` to the monochrome `wand` glyph.

This removes the oversized blue circular appearance while preserving the
bar's normal hit target, hover behavior, and panel toggle API.

## Live glass behavior

The current data path is the intended real-time mechanism:

```text
pointer drag
  -> at most one sample each 100 ms
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

Parameters with reload or mixed bindings are not sampled during pointer
drag. They show `on release` and write once on release, retaining Prism's
no-partial-drift contract. `compositor.gaps`, for example, must not move the
glass panes ahead of the compositor gaps.

Acceptance requires visible tracking before pointer release, not merely a
changing generated file. If that fails, diagnosis follows the existing path
from QML signal through FileView reload. No parallel state channel is added.

## Errors and write lifecycle

The persistent `PrismClient`, serialized FIFO queue, sample coalescing,
release ordering, refresh coalescing, and pending keyboard/wheel flush remain
unchanged. Collapsing a section must not discard a pending write.

CLI failures continue to appear in the existing error banner. Presentation
errors fail at definition load time rather than silently placing a control in
an arbitrary section.

## Verification

Automated checks cover:

- visible definitions require a label and unique integer order;
- shipped definitions produce the exact six Quick keys and all remaining
  visible keys exactly once;
- sorting produces the specified section and control order;
- numeric formatting follows slider step precision;
- Reset still routes through the existing client/queue contract;
- the bar widget uses the native capsule properties and `wand`; and
- QML lint plus the complete Node suite remain clean.

Manual acceptance covers:

1. Open Prism: Quick is immediately visible and every advanced section is
   collapsed.
2. Expand sections, close the panel, and reopen it: they are collapsed again.
3. Drag several glass sliders: the visible panes track continuously at about
   10 Hz, without waiting for release; the final displayed and stored values
   agree.
4. Drag Window spacing: nothing applies mid-drag; compositor gaps and glass
   panes move together on release.
5. Use parameter and section Reset actions: defaults return, modified accents
   and counts clear, and no queued unset is lost.
6. Exercise a failing sink: the error banner remains visible and the panel
   remains usable.
7. Compare the bar beside neighboring widgets: `wand` is monochrome, capsule
   sized, and has no conspicuous blue circular treatment.

## Documentation impact

When implementation lands, update the v1 visual-bus design and plan where
they still describe backend-named groups, visible liveness badges, or an open
manual live-glass panel contract. Their status headers and checkboxes must be
corrected only after the corresponding tree and manual evidence exist.
