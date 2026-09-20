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
explicit selection discards pending edits. A wallpaper rotation saves the
outgoing pair; the first wallpaper activation and repeated observations of the
same wallpaper preserve scratch. Panel counts and resets retain their
visible-control scope, while transitions and commits move every scratch key.

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
Noctalia hook). Wallpaper commands operate on the selected look. Clear removes
its active pair and retains the wallpaper slot; delete removes the pair and
clears that slot when active. Renaming a profile carries all its pairs.
Deleting the active profile removes its settings and pairs, selects Default,
and **preserves scratch**; this differs from ordinary explicit selection.

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
(`glass.ring.driftHz 0` becomes `glass.ring.sweepMs 0`); other old values take
the new default, and an already present replacement key keeps its value.
Then run `prism apply`. Restore config-relative originals to config and
state/active.json to state to undo parameter migration.

| Operation | Durable write order | Interruption recovery |
|---|---|---|
| Select a look or rotate wallpaper with outgoing edits | Outgoing look/pair; runtime with next slots and empty scratch; bus | Before runtime, scratch still covers the saved values. Retry preserves ownership; after runtime, apply repairs a stale bus. |
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
- `npm run test:plugin-lua` is the direct Noctalia plugin contract check for
  the production Lua modules.

The production plugin runs inside Noctalia; Lua is only a development test
prerequisite and is not a runtime package dependency.
