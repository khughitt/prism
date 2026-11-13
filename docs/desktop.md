# Desktop setup and recovery

Type: guide; document types 1. Configure the current Linux desktop integrations,
optional Noctalia panel and palette, and diagnose application failures. Related:
[usage](usage.md), [store outputs](store.md), [definitions](definitions.md) and
[plugin exchange](noctalia-plugin.md).

## Direction and limits

Prism is intended as a visual-parameter bus across desktops. niri-material is the
current compositor target, not the only intended one. Other compositors are not
implemented. The CLI works without Noctalia; the panel needs native Noctalia v5
with plugin API 22 or newer. Automated contracts do not establish fresh physical
desktop acceptance for every host or shell version.

## Compositor and terminals

Use [niri-material](https://github.com/khughitt/niri-material), not stock niri.
The installed build must accept the material properties Prism emits, including
`accent-tint`; an older material build fails the capability probe for every glass
apply, regardless of tint source. Manual tint cannot repair this incompatibility.
Run `prism requirements` and `prism doctor` to see the probe's diagnostic.

Include the generated state-directory file in niri's config:

```kdl
include "~/.local/state/prism/generated/prism.kdl"
```

Use your actual state-directory path if overridden. Configure the palette below,
or choose `prism set glass.tintSource manual` without Noctalia; then run
`prism apply niri`. The sink writes its candidate before `niri validate` composes
the surrounding config. Rejected validation restores the previous generated file.
A successful validation publishes installed colors before requesting reload;
reload failure remains an error but leaves validated output available for cold start.

The fragment contains layout gaps, terminal opacity and native material assignment
for `terminal.apps`. Glass turns the compositor gradient focus ring off because
the material supplies its own ring. Default terminal background opacity is zero.
With focus split, unfocused optics use their own fixed defaults: changing a focused
value does not change its twin. The pane frame/motion and noise type are shared,
so focus changes do not resize the slab. Optical dependencies are in
[definitions](definitions.md#pipeline-and-structural-interactions).

Kitty's sink writes generated `kitty.conf`; include it in Kitty configuration.
Live opacity updates additionally need Kitty remote control and abstract listening
sockets. Prism discovers PID-suffixed addresses in `/proc/net/unix` and applies
inactive/focused values to live windows. Generation does not itself prove a live
window accepted remote control. CLI terminal parameters remain available even
though the panel hides them.

The optional `debug.backdrop` uses the separate `qs` executable from Quickshell;
Noctalia is not that dependency. It is required only when that debug feature is
enabled. Diagnose it with requirements/doctor rather than changing glass defaults.

## Noctalia plugin and hooks

After installing the CLI, link the plugin from the checkout into Noctalia's native
data directory, then enable its canonical ID while the shell is running:

```sh
plugin_dir="${XDG_DATA_HOME:-$HOME/.local/share}/noctalia/plugins"
mkdir -p "$plugin_dir"
ln -s "$PWD/integrations/noctalia-plugin" "$plugin_dir/prism"
noctalia msg plugins enable khughitt/prism
```

An existing link is not overwritten by this command; inspect it before replacing
it. Keep it on the installed checkout. Add `khughitt/prism:widget` to an existing
bar slot array in Noctalia's config, preserving its other entries. The widget opens
`khughitt/prism:panel` on its originating output. The [plugin reference](noctalia-plugin.md)
describes model mismatch errors and the independently installed CLI/panel boundary.

Merge these hook entries into the existing `[hooks]` table; preserve other actions:

```toml
[hooks]
wallpaper_changed = ['prism context wallpaper "$NOCTALIA_WALLPAPER_PATH"']
colors_changed = ["prism apply niri"]
```

Wallpaper observation follows the actual file without saving outgoing edits.
The colors hook runs after palette templates are written and only when colors
changed; a wallpaper rotation alone does not prove palette rendering completed.

## Palette and tint sources

Register the user template in Noctalia's templates.toml (replace the input path):

```toml
[theme.templates.user.prism]
input_path = "<prism checkout>/integrations/niri/noctalia-palette.template"
output_path = "$XDG_STATE_HOME/prism/noctalia-palette.json"
```

The output must match Prism's state directory or `PRISM_NOCTALIA_COLORS` override.
Glass tint defaults to `noctalia`: surface mixed with primary by
`glass.tintAccentMix` (default 0.1). A positive mix needs both fields; zero needs
surface only. A Noctalia ring source independently needs primary. The sole ring
consumer tolerates a missing file by retaining manual ring color; malformed data
fails. Enabled palette tint requires a valid file before generated config changes.

| Tint source | Behavior |
| --- | --- |
| `noctalia` | Shared palette tint for both focus states; show Palette accent mix. |
| `manual` | Stored focused/unfocused colors; show editable tint pickers. |
| `familiar` | Stored colors shifted per window toward its agent-session hue; show focused/unfocused Session hue controls. Windows without a session keep manual tint. No tint palette is needed. |

Non-manual sources show a locked installed swatch from the last apply. Tint bypass
emits white without palette/session hue. Neutral reset chooses manual white, zero
mix and zero session hue. The ring keeps its own source: select manual there too
if its malformed palette still blocks apply. Aurora/Rainbow use manual colors.
Palette changes do not rewrite saved looks.

Absorption depends on depth and tint distance: flat-face transmittance is roughly
`color^(depth / distance)`. Distances 30 px focused/35 px unfocused assume 20 px
depth; saved explicit values win. Session hue is clearest on dark glass and can
be subtle on pale glass. Near-white light-mode surface gives nearly clear glass;
manual absorption alone cannot ensure dark-text legibility over dark wallpaper.

## Refresh and diagnose palette output

After registering/updating the template, run `noctalia msg templates-apply`.
Its acknowledgment is not proof of rendering. From the checkout, verify before apply:

```sh
node --input-type=module <<'JS'
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { noctaliaColorsPath } from './integrations/niri/palette.js';
const file = noctaliaColorsPath();
const colors = JSON.parse(fs.readFileSync(file, 'utf8'));
for (const field of ['primary', 'surface']) {
  assert.equal(typeof colors?.[field], 'string', `${file}: ${field} missing`);
  assert.match(colors[field], /^#[0-9a-fA-F]{6}$/);
}
console.log('palette ready:', file);
JS
prism apply niri
```

For a wallpaper-generated scheme whose template refresh leaves primary-only output,
this synchronous render writes only Prism's template, without other templates/hooks:

```sh
(
scheme=$(noctalia msg color-scheme-get)
case "$scheme" in
  wallpaper\ *) scheme=${scheme#wallpaper } ;;
  *) printf '%s\n' 'Use templates-apply for a predefined scheme.' >&2; exit 1 ;;
esac
noctalia theme "$(noctalia msg wallpaper-get)" \
  --scheme "$scheme" --default-mode "$(noctalia msg theme-mode-get)" \
  -r "$PWD/integrations/niri/noctalia-palette.template:${PRISM_NOCTALIA_COLORS:-${PRISM_STATE_DIR:-${XDG_STATE_HOME:-$HOME/.local/state}/prism}/noctalia-palette.json}"
)
```

Repeat verification, then apply. This deliberately refuses predefined schemes;
repair their template transport or select manual consumers for recovery. A missing
or invalid required field fails before config publication. `prism doctor` names
stale bus/output/application state; `prism apply` repairs after the cause is fixed.
