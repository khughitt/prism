# Prism

Prism resolves appearance definitions and applies them to the configured
backends. The `niri` sink is the sole compositor integration: it generates one
prism.kdl carrying layout, terminal opacity, and the native niri glass
material and its terminal assignment. With glass enabled the layout block also
turns niri's gradient focus ring off, since the material's own ring of light
marks the focused window. Terminal background opacity defaults to
zero so the glass is the only surface behind the text; with the focus split on,
unfocused terminals get a second material whose optics are the `glass.inactive.*`
overrides: frosted backdrop, blur, tint, tint distance, refraction, depth,
fringing, distortion, distortion detail, directional blur, noise, and
saturation, iridescence, aurora amount, drift rate, and two aurora colors. Blur,
tint distance, fringing, distortion, noise, and saturation ship already receded;
the remaining pairs start level. Iridescence and aurora start at zero. Aurora
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
The Noctalia integration is a native
v5 plugin under `integrations/noctalia-plugin/`; its panel is a shared `Glass`
section for the frame and pane motion and a `Focus` rack with one card per glass
stage in the shader's order (Backdrop, Distortion, Refraction, Fringing,
Directional blur, Tint, Iridescence, Aurora, Saturation, Noise). The rack's mix columns place the
unfocused state on the left and the focused on the right. Each card shows its
mix for both focus states, a light
colored by category that bypasses the stage when clicked, and a chevron that
reveals its other parameters. Bypass is a real `glass.bypass.<device>` value:
the niri sink writes the stage's dry value into both materials while it is
set and the mix keeps its number. Bypassing Refraction also silences Fringing
and Directional blur, which ride its taps, and flattens Blur. Design:
`docs/specs/2026-09-08-device-chain-rack-design.md`.

## Configuration layout

```
~/.config/prism/values.yaml                  # base values, dotfiles-tracked per host
~/.config/prism/contexts/profile/<name>.yaml # named profiles, full snapshots
~/.config/prism/contexts/wallpaper/<id>.yaml # per-wallpaper overrides, `_source` names the wallpaper
~/.local/state/prism/active.json             # which contexts are active (runtime state)
~/.local/state/prism/resolved.json           # the bus: every parameter's effective value
~/.local/state/prism/migrations/<stamp>/     # byte-for-byte copies of the store files `prism migrate` rewrote
```

Values resolve as defaults, then base, then the active wallpaper context, then
the active profile. `prism set` writes into the topmost explicit layer: the
loaded profile, else the wallpaper while it is pinned, else base; a wallpaper
the hook activated on its own is an overlay and never captures edits.
`prism set --base` writes the base file regardless. `prism context` manages
contexts: `list`, `show`, `save` and `rename` (profiles), `activate`,
`deactivate`, `delete`, `pin` and `unpin wallpaper`, and `wallpaper <path>`, the last being
what a Noctalia `wallpaper_changed` hook calls. Design:
`docs/specs/2026-09-05-prism-context-layers-design.md`.

A definition may replace a retired one (`replaces: <old key>` in `defs/`).
The store is never rewritten behind your back: `prism doctor` reports a
pending migration wherever a replaced key is still stored, and `prism migrate`
rewrites base and every profile and wallpaper context, active or not, after
copying each file it touches into a timestamped directory under the state
dir. It converts what has an equivalent (`glass.ring.driftHz 0` becomes
`glass.ring.sweepMs 0`) and falls back to the new default otherwise; a file
that already holds the new key keeps its value. Then `prism apply`. Rollback
is copying the backup back over the config dir.

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
The installed niri must accept `iridescence` and `aurora`; the material capability
probe checks this before applying glass.

## Reset modes

```sh
prism reset defaults|symmetric|neutral [--base] [--group <name>]
```

The panel offers the same actions per section and across all visible controls.
`defaults` removes overrides held by the write target, including shadowed ones;
the value revealed may come from another layer. `symmetric` copies each focused
value onto its unfocused twin. `neutral` writes the curated quiet baseline,
leaving `glass.focusSplit` unchanged. Edge bevel stays at 8 pixels so the
native material ring fits with zero pane offsets. Effect dependencies still apply: raise
Refraction above 1 before exploring Blur or Directional blur.

Without `--base`, comparisons and symmetric's source use resolved values.
With `--base`, they use base values over def defaults; active overlays may still
hide the result. Each reset changes one target layer and invokes each affected
sink at most once. A reset with no target changes writes nothing.

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
