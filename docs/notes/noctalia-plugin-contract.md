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

## Discovery and identity

For a local plugin, the installed directory basename is the discovery key: the scanner reads `<plugins>/<key>/manifest.json`, stores the manifest under `<key>`, resolves entry-point paths from that directory, keys enablement in `plugins.json` by `<key>`, and registers the bar widget as `plugin:<key>`. The scanner accepts a directory symlink because it follows directory and file tests.

Noctalia requires `manifest.id` but its folder scanner does not verify that it equals the directory basename. Prism deliberately keeps them equal: install this repository directory as `plugins/prism` and use manifest id `prism`. A newly discovered plugin defaults to disabled; enabling it records `states.prism.enabled: true`, loads its entry points, and adds `plugin:prism` to the bar.

## Sources checked

- Installed plugin: `wali-panel/manifest.json`, `Main.qml`, `BarWidget.qml`, and `Panel.qml`
- Noctalia loader: `Services/Noctalia/PluginRegistry.qml` and `PluginService.qml`
- Noctalia hosts: `Modules/Bar/Extras/BarWidgetLoader.qml`, `Modules/Panels/Plugins/PluginPanelSlot.qml`, and `Services/UI/BarWidgetRegistry.qml`
- Noctalia color control: `Widgets/NColorPicker.qml` and its settings-UI consumers
