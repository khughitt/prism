# Noctalia plugin contract

Captured from the installed `wali-panel` plugin and the corresponding Noctalia plugin loader. This is the v1 contract for Prism's Noctalia integration.

## Files and manifest

Noctalia scans each immediate child of its `plugins/` configuration directory for a file named `manifest.json`. The manifest must contain non-empty `id`, `name`, `version`, `author`, and `description` fields, an `entryPoints` object, and an `x.y.z` version string.

Prism declares these entry points:

```json
{
  "main": "Main.qml",
  "barWidget": "BarWidget.qml",
  "panel": "Panel.qml"
}
```

`Main.qml` is instantiated once when the plugin loads. Each entry-point root that receives it must declare `property var pluginApi: null`; Noctalia injects that property during object creation.

## Bar button and panel

The bar component is registered as `plugin:<discovery-key>`. Noctalia injects `screen`, `widgetId`, `section`, `sectionWidgetIndex`, `sectionWidgetsCount`, and `pluginApi`. A bar button opens its panel with `pluginApi.togglePanel(screen, buttonItem)`.

The panel entry point also receives `pluginApi`. It may expose `allowAttach`, `contentPreferredWidth`, and `contentPreferredHeight`; Noctalia reads those properties when laying out the popout. While the popout is open, `pluginApi.panelOpenScreen` identifies its screen.

## Processes

QML that launches Prism imports `Quickshell.Io` and uses its native `Process` type. Commands are argument arrays, for example `command: ["prism", "describe", "--json"]`. `StdioCollector` objects on `stdout` and `stderr` expose their text, and `onExited(exitCode)` is the completion boundary. Prism does not add a process wrapper in Task 16.

## Color control

Noctalia's settings UI exposes `NColorPicker` from `qs.Widgets`. Its input is `selectedColor`, it receives the current shell screen through `screen`, and it emits `colorSelected(color)` when the user accepts a color. Prism converts that opaque QML color value to lowercase `#rrggbb` before passing it to the CLI.

## Prism presentation and lifecycle

Prism's presentation helper recognizes three group conventions. `Title`
must contain exactly one visible toggle and is extracted into the panel title;
QML renders that returned definition and never names `glass.enabled`. `Quick`
is the first, always-open body group. `Diagnostics` remains a normal body
group, with the panel inserting its transient Preview controls before the
definition-driven parameters.

Numeric sliders may declare `ui.display` (`raw`, `percent`, or `normalized`),
`ui.scale` (`linear` or `logarithmic`), and a raw-only `ui.unit`. Any visible
control may declare boolean `ui.affectsPreview`. Definition loading rejects
invalid combinations before they reach QML.

The panel keeps stored and written values canonical. Slider writes snap to the
canonical grid relative to the range minimum. Normalized and logarithmic
tracks use continuous pointer coordinates while keyboard and wheel events move
one canonical step. While Preview is open, rows without
`affectsPreview: true` are dimmed and marked `Not in preview`; the note explains
that they still update their normal consumers, and the controls remain enabled.

Manifest bindings may declare `drag: release` only beside `liveness: live`.
The raw public `bindings[]` entries stay `{sink, liveness}`; `describe`
retains `effectiveLiveness` as capability and emits `effectiveDrag` as the
panel's aggregated pointer policy (`live`, `release`, or `null`).

Each control updates a local displayed value before enqueueing its write. A
drained parameter batch then runs authoritative `prism describe --json`;
replacing the grouped model recreates delegates and reconciles their values,
modified state, and Reset visibility. Sample-only drains skip that refresh so
they cannot destroy a slider while it is pressed. A slider also reports its
pressed lifetime to the persistent client: any reconciliation requested after
a prior release but before the new drag's first sample is deferred until the
pressed slider releases. Destruction clears the pressed state so a disappearing
delegate cannot strand refresh suppression. Pressing also invalidates an
already-running `describe`; its eventual result is discarded even if press and
release both finish before that process exits, and one fresh replay follows.

The persistent `PrismClient` lives in `Main.qml`, while `Panel.qml` is created
and destroyed with the popout. That ownership lets panel destruction enqueue
`hidePreview` safely: closing the panel does not destroy the FIFO or its
in-flight process.

Noctalia's SmartPanel closes when the user clicks outside it. Panel
destruction then intentionally enqueues `hidePreview`, so preview
click-through cannot be accepted by clicking outside the open settings panel:
that action removes the preview by contract. Show the preview through direct
IPC with the settings panel closed, then interact through it to validate the
empty input region independently.

## Write and preview queue

Parameter writes and preview IPC share one FIFO. Preview verbs have explicit,
path-free command shapes:

```text
qs -c niri-glass ipc call prismGlass showPreview <output> <left|right> <true|false>
qs -c niri-glass ipc call prismGlass hidePreview
```

Preview items do not affect Prism parameters. At drain, the client refreshes
only when the batch contained a parameter write **and** its last completed
item was not a drag sample. This keeps `[final, preview-hide]` refreshable but
suppresses `[final, sample]`, deferring reconciliation until the active
second drag releases instead of replacing its pressed delegate.

## Native Noctalia composition

Prism composes quiet section headers from `NIcon`, `NText`, and
`NIconButton`; `NCollapsible` cannot expose the required Reset action and
modified count. It owns one label/description block and one trailing Reset
button for every control type rather than mixing the native controls'
different label and reset geometries.

`NScrollView` reserves scrollbar space by default. Prism retains that native
default; disabling it lets the vertical scrollbar overlap and clip trailing
Reset buttons at the right edge. Prism also supplies
`userRightPadding: Style.marginS`, extending the native reserved gutter
without replacing the component's scrollbar calculation.

Conditional controls that must not move their always-visible sibling use a
`ColumnLayout`. The Diagnostics Preview toggle therefore stays fixed when its
Diagnostic-background toggle appears or disappears.

The bar widget matches Noctalia's native capsule contract: it uses
`Style.getCapsuleHeightForScreen(screen?.name)`, disables a second UI-scale
application, takes the capsule colors/border/radius from `Style`, and obtains
tooltip direction from `BarService` via `qs.Services.UI`. Its icon is the
monochrome `wand` glyph.

## Discovery and identity

For a local plugin, the installed directory basename is the discovery key: the scanner reads `<plugins>/<key>/manifest.json`, stores the manifest under `<key>`, resolves entry-point paths from that directory, keys enablement in `plugins.json` by `<key>`, and registers the bar widget as `plugin:<key>`. The scanner accepts a directory symlink because it follows directory and file tests.

Noctalia requires `manifest.id` but its folder scanner does not verify that it equals the directory basename. Prism deliberately keeps them equal: install this repository directory as `plugins/prism` and use manifest id `prism`. A newly discovered plugin defaults to disabled; enabling it records `states.prism.enabled: true`, loads its entry points, and adds `plugin:prism` to the bar.

## Sources checked

- Installed plugin: `wali-panel/manifest.json`, `Main.qml`, `BarWidget.qml`, and `Panel.qml`
- Noctalia loader: `Services/Noctalia/PluginRegistry.qml` and `PluginService.qml`
- Noctalia hosts: `Modules/Bar/Extras/BarWidgetLoader.qml`, `Modules/Panels/Plugins/PluginPanelSlot.qml`, and `Services/UI/BarWidgetRegistry.qml`
- Noctalia controls: `Widgets/NValueSlider.qml`, `NToggle.qml`,
  `NComboBox.qml`, `NColorPicker.qml`, and `NCollapsible.qml`
- Native capsule reference: `keybind-cheatsheet/BarWidget.qml`
