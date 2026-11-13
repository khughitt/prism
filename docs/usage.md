# Using Prism

Type: guide; document types 1. Use the CLI or panel to edit, save and restore a
desktop look. Related: [store records and transitions](store.md),
[desktop setup and recovery](desktop.md), [definitions](definitions.md) and
[panel exchange](noctalia-plugin.md).

## Command line

```sh
prism [--json|--pretty] [--color auto|always|never] <command> [args]
prism --help
prism context --help
prism help context show
```

Root and per-command help read no store and exit 0; `--version`/`-V` prints the
package version. `--json` and `--pretty` are mutually exclusive global options
accepted before or after commands. Pretty is default; `PRISM_FORMAT` sets the
default and explicit flags win. `PRISM_COLOR` defaults to `never`; color options
are accepted but output currently contains no color.

Exit 0 means success, 1 an operation failure, 2 a usage error. JSON results normally
use one stdout object; operation/usage errors use `{error: {kind, detail}}` on
stderr with no stdout. `doctor` and `requirements` instead report findings on stdout
(`ok: false`) with exit 1; parse that report even when the command fails. Successful
`migrate pairs --json` is silent. Pretty diagnostics retain the sink/validation message.
Use `PRISM_COMPLETE=zsh prism` or `PRISM_COMPLETE=bash prism` to generate completion.

| Command | Result or action |
| --- | --- |
| `get <key>` | Effective value; JSON contains `key`, `value`. |
| `list` | All effective values; JSON contains `params`. |
| `describe` | Active slots, profiles, layers, rack and parameter metadata; [model](noctalia-plugin.md#describe-model). |
| `set <key> <value> [--base]` | Edit scratch, or Default directly with `--base`; apply bound sinks. |
| `unset <key> [--base]` | Remove that override; apply the revealed values. |
| `reset <revert|symmetric|neutral> [--base] [--group <name>]` | Reset visible controls in scope. |
| `commit <base|profile|wallpaper> [<name-or-id>]` | Keep pending edits or Save As, without changing appearance. |
| `apply [<sink>…]` | Recompute/apply all sinks or named sinks. |
| `requirements` | Report required commands/probes (`ok`, `unmet` in JSON); findings exit 1 on stdout. |
| `doctor` | Diagnose store, bus, generated files and sink status (`ok`, `problems`); findings exit 1 on stdout. |
| `migrate [pairs]` | Explicit parameter replacement or old pair-layout conversion. |
| `context list` | Discover profiles/pairs and active slots. |
| `context show <profile|wallpaper> <name-or-id> [--look <token>]` | Inspect saved content; wallpaper look can be inactive. |
| `context activate <profile|wallpaper> <name-or-id>` | Explicitly select a saved context. |
| `context deactivate <profile|wallpaper>` | Select Default or clear the wallpaper slot. |
| `context wallpaper <path>` | Wallpaper hook: canonicalize path and follow it, tuned or untuned. |
| `context clear wallpaper <id>` | Remove its saved pair, retaining the active slot and scratch. |
| `context delete <profile|wallpaper> <name-or-id>` | Delete the named profile or selected look's wallpaper pair. |
| `context rename profile <old> <new>` | Rename a look with all its pairs. |

Successful applied changes report `changed` keys and `applied` sinks in JSON.
If a sink fails, saved edits remain; repair its error and run apply. Do not treat
an operation failure as a rollback of the store.

## Edit and keep

```sh
prism set glass.roughness 0.4
prism commit base
prism set glass.roughness 0.2
prism reset revert
```

Set writes pending scratch and applies it immediately. Keep in look saves into
the active profile (`commit profile`) or Default (`commit base`). A loaded named
profile blocks commit base: select Default first. Keep for wallpaper uses
`commit wallpaper <active-id>`. Base/profile commits remove the committed keys
from that look's current pair; wallpaper commit keeps them in the pair.
Empty ordinary commits report nothing to commit. The panel's edited count and
resets cover visible controls; transitions and commits move every scratch key.

## Select, rotate and Save As

```sh
prism context activate profile Aurora
prism context deactivate profile
prism commit profile NewLook
```

Explicit selection saves pending keys to the outgoing look–wallpaper pair and
loads the selected look with zero pending edits. With no wallpaper it discards
pending edits. Selecting the already selected look follows the same CLI rule.
Wallpaper rotation saves nothing: the incoming pair's keys win, while other
visible values remain as pending edits. A repeated wallpaper observation does
nothing. Save As snapshots the screen into a named look and loads it, removing
its current-wallpaper pair while retaining its other pairs and the outgoing look.

For an inactive pair, use `context show wallpaper <id> --look profile:<name>`;
`--look default` names Default. The list output identifies the look for each pair.
Deleting the active profile selects Default and preserves scratch, unlike normal
selection. Rename carries its pairs. The [store protocol](store.md#mutation-exchange)
defines stale-action guards and interruption behavior.

The panel's native dropdown does not currently send a same-option reselect event.
Use Keep for wallpaper there, or explicit CLI selection. Simulated Lua callbacks
do not establish physical desktop acceptance.

## Starter profiles

Aurora and Rainbow are full snapshots under `resources/profiles/`, using native
optics and manual tint to preserve their colors. Installing/loading one also
replaces effective non-glass settings such as terminal app IDs and gaps.
From the checkout, copy without replacing edited profiles:

```sh
profile_dir="${PRISM_CONFIG_DIR:-${XDG_CONFIG_HOME:-$HOME/.config}/prism}/contexts/profile"
mkdir -p "$profile_dir"
cp --update=none resources/profiles/{Aurora,Rainbow}.yaml "$profile_dir/"
prism context activate profile Aurora
```

Use Rainbow instead for that preset. The material capability probe checks the
required optics before applying; manual tint cannot repair an incompatible build.

## Reset scope

Revert removes pending keys and reveals saved layers. Symmetric copies focused
values to unfocused twins. Neutral writes the curated quiet values and exempts
`glass.focusSplit`; it is not a blanket zero. `--group Focus`, for example, limits
visible controls to that section. Without `--base` comparisons use resolved values;
with it they use Default over definition defaults, which overlays can still hide.
No-op resets write nothing; each affected sink runs at most once.
Raise Refraction above 1 before judging roughness blur/directional blur; see the
[interaction matrix](definitions.md#pipeline-and-structural-interactions).

## Migration and rollback

Run `prism migrate pairs` for stores with old standalone wallpaper files, retired
pinned state or standalone scratch. It copies old wallpaper adjustments into
Default and existing profiles, moves scratch into runtime, and removes old sources
only after all destinations are written. No sink runs or pending value is committed.
Identical existing copies are accepted; conflicting edits are refused. Retry from
current files after interruption. New profiles do not inherit migrated pairs.

Keep the first complete immutable attempt backup. Restore config-relative originals
into config and the backup's state-directory originals into state; remove new
outputs identified by `$backup/originally-absent.txt` config/state prefixes. Later attempt backups cover
later write prefixes and do not replace that first backup. Never copy the whole
backup directory into config. The absence list is for manual rollback, not an input
the migration reads.

Plain `prism migrate` replaces retired parameter keys across Default, every look
and pair and runtime scratch. Each changed physical file is backed up before
replacement. Equivalent old values carry over; other retired values take the new
default; an existing replacement key wins. Run `prism apply` afterwards. Restore
originals to their respective config/state locations to undo it. Doctor/discovery
remain read-only diagnostics when old sources block ordinary commands.
