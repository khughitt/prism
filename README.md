# Prism

Prism is the appearance layer of a [niri](https://github.com/YaLTeR/niri) desktop:
one store of look settings (glass optics, focus ring, gaps, terminal opacity),
saved as named profiles and per-wallpaper adjustments, rendered into niri's
configuration and tuned live from a [Noctalia](https://github.com/noctalia-dev/noctalia)
shell panel or the `prism` command line.

## Requirements

- niri built with the native glass material (`niri-material`). Stock niri does
  not accept the material config; `prism requirements` and the material
  capability probe say so before glass is applied.
- Noctalia v5, for the panel plugin and the wallpaper and palette hooks
  (optional: the command line works without it).
- Node.js 20 or newer.

## Install

```sh
git clone https://github.com/khughitt/prism.git
cd prism
npm install
ln -s "$PWD/bin/prism" ~/.local/bin/prism
prism doctor
```

Include the generated `~/.local/state/prism/generated/prism.kdl` from the niri
config. The Noctalia plugin lives under `integrations/noctalia-plugin/`.

## Overview

Prism resolves appearance definitions and applies them to the configured
backends. The `niri` sink is the sole compositor integration: it generates one
prism.kdl carrying layout, terminal opacity, and the native niri glass
material and its terminal assignment. With glass enabled the layout block also
turns niri's gradient focus ring off, since the material's own ring of light
marks the focused window. Terminal background opacity defaults to
zero so the glass is the only surface behind the text; with the focus split on,
unfocused terminals get a second material whose optics are the `glass.inactive.*`
overrides: frosted backdrop, blur, tint, tint distance, refraction, depth,
fringing, distortion, distortion detail, directional blur, noise,
saturation, iridescence, aurora amount, drift rate, two aurora colors,
reflection, edge highlight, and edge profile. Blur,
tint distance, fringing, distortion, noise, and saturation ship already receded;
the remaining pairs start level. Iridescence, aurora, and edge highlight start at
zero; reflection (0.6) and edge profile (2, a quarter-round bevel) start at the
owner's pick from niri-material's glass-edge contact sheet. Aurora
drift uses whole Hz from 0 to 30; 0 pins the field, and niri halves the rate
under reduced motion.

Every `glass.inactive.*` default is fixed, not inherited: tuning `glass.ior`
leaves `glass.inactive.ior` at 1.5. Set both halves of a row, or the unfocused
material keeps the shipped default for that optic. This bites on upgrade for
frosted backdrop, tint, refraction, depth, and distortion detail, whose focused
halves were shared parameters until the matrix widened — an existing
`glass.backdropBlur = true` now frosts only the focused window until
`glass.inactive.backdropBlur` is set to match.

The two materials share the slab frame (`glass.paneLip`,
`glass.paneShiftX`, `glass.paneShiftY`), the pane motion (`glass.jellyFlex`,
`glass.jellyRipple`), and `glass.noiseType`: `white` or `fine` (the Prism
default). The frame is shared deliberately — a per-state frame would resize and
shift the slab on every focus change, and niri swaps materials as a hard cut.
Edge profile (`glass.bevelProfile`) shapes the bevel without resizing it, so it
is the one focused/unfocused row in the `Glass` section.
The Noctalia integration is a native
v5 plugin under `integrations/noctalia-plugin/`; its panel is a shared `Glass`
section for the frame and pane motion and a `Focus` rack with one card per glass
stage in the shader's order (Backdrop, Distortion, Refraction, Fringing,
Directional blur, Saturation, Noise, Tint, Aurora, Reflection, Edge highlight,
Iridescence). The rack's mix columns place the
unfocused state on the left and the focused on the right. Each card shows its
mix for both focus states, a light
colored by its stage's site family (source, geometry, transmission, light, post) that bypasses the stage when clicked, and a chevron that
reveals its other parameters. Bypass is a real `glass.bypass.<device>` value:
the niri sink writes the stage's dry value into both materials while it is
set and the mix keeps its number. Bypassing Refraction also silences Fringing
and Directional blur, which ride its taps, and flattens Blur. Design:
`docs/specs/2026-09-08-device-chain-rack-design.md`.

## Configuration layout

```
~/.config/prism/values.yaml                  # Default settings and its wallpaper pairs
~/.config/prism/contexts/profile/<name>.yaml # named look settings and its wallpaper pairs
~/.local/state/prism/active.json             # active slots and pending edits in _scratch
~/.local/state/prism/resolved.json           # the bus: every parameter's effective value
~/.local/state/prism/migrations/<stamp>/     # byte-for-byte originals before parameter migration
~/.local/state/prism/migrations/<stamp>-*/   # immutable originals for each layout-migration attempt
```

Default and named looks keep flat parameter keys. Their optional `_wallpapers`
map holds sparse absolute adjustments, keyed by wallpaper id:

```yaml
glass.roughness: 0.4
_wallpapers:
  abc12345:
    _source: /pictures/example.jpg
    glass.roughness: 0.2
```

Values resolve as defaults, base, loaded profile, that look's wallpaper pair,
reserved state, then scratch. A missing pair is untuned; another look's pair
never supplies its values. active.json stores `profile`, `wallpaper` (an
`{id, path}` object), and optional `_scratch`. Clearing scratch preserves the
active slots. All mutations use the existing store lock.

Every `prism set` writes scratch; a value already shown beneath scratch is
omitted. Selecting a profile or Default saves **all** pending keys to the
outgoing look–wallpaper pair and loads the selected look with zero pending
edits. Selecting the already active look does the same. With no wallpaper,
explicit selection discards pending edits. A wallpaper rotation (the Noctalia
hook, or `context activate`/`deactivate wallpaper`) saves nothing. It keeps the
screen, changing only the keys the incoming look–wallpaper pair sets, and every
other visible value that the new fold would not show stays as a pending edit.
Leaving a tuned wallpaper therefore turns its values into pending edits; Keep
for wallpaper saves them to the wallpaper now showing. Repeated observations of
the same wallpaper are no-ops. Panel counts and resets retain their
visible-control scope, while transitions and commits move every scratch key.
The panel names saved adjustments as `N for Aurora + this wallpaper` (or
`Default`), separate from pending edits. Selection shows zero pending edits
immediately, then reconciles the selected look's values and saved count.
Keep, Clear, Rename, Delete, and Save As wait for that reconciliation; sliders
and rapid selections remain available.

Same-look activation works through the CLI (`prism context activate profile
Aurora`, or `prism context deactivate profile` for Default). The installed
Noctalia dropdown does not emit a same-option click to Lua; existing Keep for
wallpaper saves the current pair in the panel. The native capability is tracked
as `prism-02befb`. Desktop validation is recorded separately in
[the acceptance checklist](docs/notes/2026-09-20-profile-wallpaper-pairs-acceptance.md).

`commit base` keeps edits in Default; `commit profile` keeps them in the loaded
look. Both remove just the committed keys from that look's active pair in the
same file replacement. `commit wallpaper <id>` keeps edits in the active pair.
`commit profile <name>` saves the current appearance as a full snapshot and
loads it: it removes the destination's current-wallpaper pair, retains its
other pairs, and leaves the outgoing look untouched. A commit never changes
what is on screen or rewrites the resolved bus. `prism reset revert` forgets
pending edits and reveals the saved look plus pair. `prism set --base` writes
Default settings directly without replacing its pairs.

`prism context` supports `list`, `show`, `rename` (profiles), `activate`,
`deactivate`, `delete`, `clear wallpaper <id>`, and `wallpaper <path>` (the
Noctalia hook). `context list` prints saved wallpaper pairs from every look as
`wallpaper <look-token> <id> <source>` and marks only the selected pair.
`context show wallpaper <id> --look <look-token>` inspects an inactive look;
without `--look` it uses the selected look. `context show profile <name>` prints
the full document, including its pairs. Look tokens are `default` or
`profile:<name>`; wallpaper tokens are `none` or `id:<id>`.
Wallpaper commands operate on the selected look. Clear removes
its active pair and retains the wallpaper slot; delete removes the pair and
clears that slot when active. Renaming a profile carries all its pairs.
Deleting the active profile removes its settings and pairs, selects Default,
and **preserves scratch**; this differs from ordinary explicit selection.
Panel Keep, Save As, Clear, Rename, and Delete actions append
`--expect-look <look-token> --expect-wallpaper <wallpaper-token>`. Both flags
are required together; stale actions fail before changing files. Direct CLI
calls may omit them to act on the current store. Explicit profile selection
remains unguarded so it can select the requested destination.

Explicitly selecting a valid look can recover from a missing or broken active
named profile, including its selected pair. `prism doctor` recommends
`prism context deactivate profile` to select Default. Recovery preserves
scratch and writes no outgoing pair, validates Default/base, runtime, scratch,
and the incoming look independently, then applies every bound key. A wallpaper
rotation cannot recover a still-selected broken look. A parameter-invalid pair
can be cleared when its containing document is structurally readable; malformed
shared YAML is refused without changing its bytes. Repair that document or
select away from a broken named look. Ordinary reads never repair the store.
Design: `docs/specs/2026-09-20-profile-wallpaper-pairs-design.md`.

Before using an older store, run **`prism migrate pairs`**. It copies every old
`contexts/wallpaper/*.yaml` adjustment to Default and every existing profile,
moves old scratch.yaml into runtime `_scratch`, and drops retired `pinned`.
No sink runs and no pending value is normalized or committed. Profiles created
after migration inherit no pairs. Remaining old sources block ordinary commands
with this migration remedy; doctor and discovery remain read-only diagnostics.

Migration plans from current files under the lock, validates everything before
mutation, accepts identical existing copies, and refuses conflicting pairs or
scratch without overwriting them. Every modifying attempt first creates a
fresh backup, preserving YAML comments and all original bytes. Config originals
retain their config-relative paths; runtime originals are under state/.
originally-absent.txt lists new output paths using config/ or state/ prefixes
for manual removal during rollback. Migration never reads that list. All look
writes finish before runtime, and all destination writes finish before old
sources are deleted. Rerun an interrupted migration: it rereads current files,
preserves unrelated edits, and refuses conflicting hand edits. Completed reruns
make no changes and no backup.

Keep the **first complete backup**. To undo the entire layout conversion, copy
its config-relative originals over the config directory, copy its state/
originals over the state directory, and remove the outputs listed in its
originally-absent.txt. Later attempt backups describe later write prefixes
and do not replace the original backup. This restores the old layout for old
code or a fresh migration. Do not copy the backup directory wholesale into
config: state/ and the restoration list belong elsewhere.

Plain `prism migrate` remains parameter replacement, after layout migration.
It traverses Default, every named look and every pair (active or inactive),
and runtime scratch, grouping changes into one replacement per physical file.
It first backs up each changed file. Equivalent values carry over
(`glass.ring.sweepMs 0` becomes `glass.ring.beamSpeed 0`); other old values take
the new default, and an already present replacement key keeps its value.
Then run `prism apply`. Restore config-relative originals to config and
state/active.json to state to undo parameter migration.

| Operation | Durable write order | Interruption recovery |
|---|---|---|
| Select a look with outgoing edits | Outgoing look/pair; runtime with next slots and empty scratch; bus | Before runtime, scratch still covers the saved values. Retry preserves ownership; after runtime, apply repairs a stale bus. |
| Rotate wallpaper | Runtime with next slots and carried scratch; bus | Runtime publishes the slot and the carried scratch together. After it, `prism apply` repairs a stale bus. |
| Select without wallpaper | Runtime with selected look and empty scratch; bus | Runtime publishes selection and discard together. |
| Recover a broken named look | Runtime with valid incoming look and preserved scratch; bus | Retry before runtime. After it, use `prism apply`; repeating selection is a new ordinary save/discard action. |
| Keep in look / Keep for wallpaper | Whole look document; runtime with empty scratch | Scratch covers intermediate writes; completed retry can report nothing to commit. |
| Save As | Destination snapshot with current pair removed; runtime selecting it with empty scratch | Source is unchanged before runtime; destination snapshot supplies the same screen afterward. |
| Clear pair | Whole look without pair; bus | One intended appearance change; completed retry can report untuned. |
| Delete active profile | Runtime selecting Default with scratch preserved; unlink profile; bus | Retry can remove the now-inactive file; apply repairs the bus. |
| Rename active profile | Hard-link complete file; runtime names new profile; unlink old name | Existing inode checks permit retry; appearance and bus remain unchanged. |
| Migrate pairs | Fresh immutable backup and absence list; looks; runtime; delete old sources | Retry from current files; old sources remain until every destination contains their data. |

These guarantees cover process interruption and atomic file replacement, not
power-loss durability. A stale resolved bus or interrupted sink application is
repaired with `prism apply`.

## Noctalia palette

Glass tint (`glass.tintSource: noctalia`, the default) and the ring's optional
`noctalia` color source (`glass.ring.colorSource`) read
`$XDG_STATE_HOME/prism/noctalia-palette.json` (prism's state directory), which a
Noctalia user template renders on every palette change. Noctalia's `colors_changed` hook, which fires
after the templates are written and only when the palette changed, re-renders
the niri sink. The wallpaper hook stays `prism context wallpaper`. The
template is registered with the other user templates (a templates.toml in the
Noctalia config directory):

```toml
[theme.templates.user.prism]
input_path  = "<prism checkout>/integrations/niri/noctalia-palette.template"
output_path = "$XDG_STATE_HOME/prism/noctalia-palette.json"
```

and the hook sits beside `wallpaper_changed` in the Noctalia config.toml:

```toml
[hooks]
colors_changed = ["prism apply niri"]
```

An enabled Noctalia tint requires a valid surface, plus primary when its accent
mix is positive. A missing or invalid required field fails before writing the
generated config. When the ring is the sole palette consumer, a missing file
still rests it on the manual ring color; a malformed file fails.
`PRISM_NOCTALIA_COLORS` points the sink at another file.

The Tint device's details provide **Tint source** (`noctalia`/`manual`) and
**Palette accent mix** (0–100%, default 10%). Both focus states share the
Noctalia-derived color. The tint pickers, like the ring's Color picker, appear
only under the manual source. Under any other source the cell shows the color
from the last apply as a read-only swatch behind a lock; its tooltip reads
"From <source>, as of the last apply. Select the manual source to edit." Palette
accent mix is shown only under the Noctalia source. Choosing manual makes the
stored colors take effect on the next successful apply:

```sh
prism set glass.tintSource manual
prism set glass.tintSource noctalia
prism set glass.tintAccentMix 0.1
```

Tint bypass emits white under either source and needs no tint palette. Neutral
reset selects manual white tint with zero mix. The ring keeps its own Color
source; if a malformed palette blocks that consumer, select its manual Color
source too. Aurora and Rainbow starter snapshots select manual tint to retain
their curated colors. Existing user looks without an explicit source follow
Noctalia; no saved values are rewritten by palette changes.

The 30/35 px distance defaults assume 20 px depth. Absorption depends on both:
transmittance is approximately `color^(depth / distance)` on a flat face. Saved
explicit depths/distances still win, so check both when tuning a very dark pane.

### Upgrade to palette-driven glass tint

The template now supplies both `primary` and `surface`. The tint
source uses the surface with a 10% palette-accent mix, with distance defaults
of 30 px focused and 35 px unfocused at 20 px depth. Dark-mode legibility is
the goal; a near-white light-mode surface produces nearly clear glass and
cannot make dark terminal text legible over a dark wallpaper.

The launcher and registered template can both load from the main checkout,
so this upgrade requires **two separate merges**, with a refresh between them:

1. Merge the expanded template, its tests and these upgrade instructions.
   Keep the old sink/defaults installed; the extra surface field is harmless
   to the existing ring reader. The new tint controls become available in the second merge.
2. Run `noctalia msg templates-apply` to reapply the current palette's user
   templates. Its `ok` acknowledgment does not prove rendering completed.
   Verify both fields before proceeding, from the main checkout:

   ```sh
   node --input-type=module <<'JS'
   import fs from 'node:fs';
   import assert from 'node:assert/strict';
   import { noctaliaColorsPath } from './integrations/niri/palette.js';
   const file = noctaliaColorsPath();
   const colors = JSON.parse(fs.readFileSync(file, 'utf8'));
   for (const field of ['primary', 'surface']) {
     assert.equal(typeof colors?.[field], 'string', `${file}: ${field} missing`);
     assert.match(colors[field], /^#[0-9a-fA-F]{6}$/, `${file}: invalid ${field}`);
   }
   console.log('palette ready:', file, colors);
   JS
   ```

3. Only after successful verification on every host being upgraded, merge the
   sink, defaults and controls, then run `prism apply niri`. A failed refresh
   blocks this second merge and leaves the old apply path working.

If templates-apply leaves primary-only output for a wallpaper-generated scheme,
run this synchronous render from the main checkout, then repeat verification:

```sh
(
scheme=$(noctalia msg color-scheme-get)
case "$scheme" in
  wallpaper\ *) scheme=${scheme#wallpaper } ;;
  *) printf '%s\n' 'Use templates-apply for a predefined scheme.' >&2; exit 1 ;;
esac
noctalia theme "$(noctalia msg wallpaper-get)" \
  --scheme "$scheme" --default-mode "$(noctalia msg theme-mode-get)" \
  -r "$PWD/integrations/niri/noctalia-palette.template:${XDG_STATE_HOME:-$HOME/.local/state}/prism/noctalia-palette.json"
)
```

The direct command renders only Prism's output, without other templates or
post-hooks. It writes the registered default state path; if using a custom
`PRISM_NOCTALIA_COLORS`/`PRISM_STATE_DIR`, render to that configured file instead.
It refuses predefined schemes rather than replacing their colors. A predefined
scheme has no direct-render fallback here: if templates-apply fails, leave the
second merge blocked until the transport is repaired. If the new sink was
installed independently, its manual tint source will provide recovery through the controls from the second merge. Manual absorption cannot solve light-mode
legibility by itself.

## Command line

`prism [--json|--pretty] [--color <when>] <command> [args]`, following the shared CLI
vocabulary (ops `docs/specs/2026-09-20-cli-conventions-design.md`). The command table
is declared once in `src/commands.js` and mirrored in `tools/cli.toml`, the vendored
copy of ops's inventory; `test/cli-surface.test.js` proves the two agree.

- `--help`/`-h` on the root and on every command, `context <verb>` included, and
  `prism help <command>…` routes to the same text; help prints to stdout, exits 0,
  and reads no store. `--version`/`-V` prints `prism <version>`.
- `--json` and `--pretty` are global and mutually exclusive, accepted before or after
  the command; the default is pretty, `PRISM_FORMAT` overrides the default, the flag
  overrides both. Under `--json` every command prints exactly one object: `get`
  `{"key","value"}`, `list` `{"params":{…}}`, `describe` its document (a text summary
  otherwise), a change that reached the sinks `{"changed":[keys],"applied":[sinks]}`,
  `doctor` `{"ok","problems"}`, `requirements` `{"ok","unmet"}`, `migrate`
  `{"backup","files"}`, `context list` `{"active","contexts"}`, `context show`
  `{"kind","name","source","values"}`.
- `--color auto|always|never` (default `never`, `PRISM_COLOR` overrides) is accepted
  everywhere; prism prints no color yet.
- Exit codes: 0 done, 1 the command ran and failed, 2 a usage error (unknown command or
  option, missing or extra argument, a value outside its set). A usage error is one
  stderr line with the usage line; under `--json` a failure is one
  `{"error":{"kind","detail"}}` object on stderr and nothing on stdout.
- Completion: `PRISM_COMPLETE=zsh prism` (or `bash`) prints a script that calls back into
  `prism` for commands, options, and closed value sets, the mechanism the dotfiles
  already source for `tasks`.

## Starter profiles

`resources/profiles/Aurora.yaml` and `resources/profiles/Rainbow.yaml` are ordinary full snapshots
for the existing profile picker. They use the native niri-material presets' optics
in both focus states: Aurora adds a green/violet field at 4 Hz; Rainbow combines
refraction, fringing, and iridescence. Noise is explicitly off and saturation is
1 so host blur settings cannot change the look. Other Prism settings use the
shipped defaults, including terminal app ids and gaps; loading a starter replaces
the effective values of those settings too.

From the Prism checkout, install without overwriting profiles you have edited:

```sh
profile_dir="${PRISM_CONFIG_DIR:-${XDG_CONFIG_HOME:-$HOME/.config}/prism}/contexts/profile"
mkdir -p "$profile_dir"
cp --update=none resources/profiles/{Aurora,Rainbow}.yaml "$profile_dir/"
prism context list
prism context activate profile Aurora
```

Choose `Rainbow` instead for the rainbow preset, or select either in the panel's
profile picker. `prism context deactivate profile` restores the lower layers.
The installed niri must accept `iridescence`, `aurora`, `bevel-profile`, `reflection`,
and `edge-highlight`; the material capability probe checks this before applying glass.

## Reset modes

```sh
prism reset revert|symmetric|neutral [--base] [--group <name>]
```

The panel offers the same actions per section and across all visible controls.
`revert` forgets the edits in scope; the value revealed comes from the layers
beneath. `symmetric` copies each focused
value onto its unfocused twin. `neutral` writes the curated quiet baseline,
leaving `glass.focusSplit` unchanged. Edge bevel stays at 8 pixels so the
native material ring fits with zero pane offsets. Effect dependencies still apply: raise
Refraction above 1 before exploring Blur or Directional blur.

Without `--base`, comparisons and symmetric's source use resolved values.
With `--base`, they use base values over def defaults; active overlays may still
hide the result. Each reset changes scratch (base with `--base`) and invokes each
affected sink at most once. A reset with no changes writes nothing.

## Development prerequisites

- Node.js 20 or newer
- Lua (for the direct Noctalia plugin module checks)
- `just` and Python 3 (the test front door and its timing wrapper)

Install the existing Node dependency with `npm install`.

## Tests

- `just test` runs the full Prism suite (`npm test`) through the timing wrapper
  `tools/tt`; `just check` and `just gate` are the pre-commit and pre-push
  gates, and a fresh clone installs the hooks with
  `git config core.hooksPath .githooks`.
- `tools/cli.toml` and `tools/cli_surface.py` are byte-identical copies of the shared
  CLI table and its helper in the ops repository; a change to prism's command surface
  is a change to the ops table first, then re-vendored here.
- `npm run test:plugin-lua` is the direct Noctalia plugin contract check for
  the production Lua modules.

The production plugin runs inside Noctalia; Lua is only a development test
prerequisite and is not a runtime package dependency.
