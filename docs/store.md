# Store records and transitions

Type: data model, protocol; document types 1. The YAML/JSON store and mutation
protocol are currently unversioned. This describes persisted records, resolution,
write order and recovery. Related: [usage](usage.md), [definitions](definitions.md),
[panel exchange](noctalia-plugin.md) and [desktop outputs](desktop.md).

## Locations

`PRISM_CONFIG_DIR` overrides the config directory; otherwise it is
`$XDG_CONFIG_HOME/prism`, defaulting to `~/.config/prism`.
`PRISM_STATE_DIR` overrides state; otherwise it is `$XDG_STATE_HOME/prism`,
defaulting to `~/.local/state/prism`.

```text
config/
  values.yaml                     Default look
  contexts/profile/<name>.yaml     named looks
state/
  active.json                     selected slots and pending edits
  resolved.json                   derived effective parameter bus
  sink-status.json                 latest apply result per sink
  effective/<sink>.json            externally resolved installed colors
  generated/                      sink-generated config
  migrations/                     immutable migration-attempt backups
```

## Look documents

Default and named looks are YAML mappings. Flat dotted parameter keys hold
saved values validated against [definitions](definitions.md#parameter-definitions).
The optional `_wallpapers` map holds sparse absolute values per wallpaper ID:

```yaml
glass.roughness: 0.4
_wallpapers:
  abc12345:
    _source: /pictures/example.jpg
    glass.roughness: 0.2
```

`_source` is a required string; other underscore metadata is rejected. Pair IDs
and profile names match `[A-Za-z0-9._-]+`. The wallpaper hook resolves the actual
path and uses the first eight hex digits of its SHA-256 as ID; loaded pair IDs
use the general name grammar. The source string is provenance, not image content.
Missing Default means empty base values; a missing selected named look is broken.
Malformed YAML, non-mappings, bad metadata, unknown parameters and invalid values
are errors. A shadowed bad value still fails resolution.

## Runtime and layer resolution

The runtime JSON object accepts only:

| Field | Meaning |
| --- | --- |
| `profile` | Optional valid name; absent selects Default. JSON null is not a stored profile name. |
| `wallpaper` | Optional object with only string `id` and `path`; id follows the name grammar. |
| `_scratch` | Optional flat parameter mapping; omitted/empty means no pending edits. |

Absent runtime means empty slots/scratch. Clearing scratch retains selected slots.
Values resolve low to high: definition defaults, Default/base, loaded profile,
that look's wallpaper pair, reserved state position, then scratch. A missing pair
is untuned; another look's pair supplies nothing. `held` lists layers containing
a key; `layer` is the winning source; `fallback` is the value beneath scratch.
Every ordinary set edits scratch, omitting values already supplied beneath it.
Base writes use the explicit `--base` option and preserve pairs.

## Reserved items

`state` is reserved in the layer/kind vocabulary. It has no designed activation
source or available context verbs; runtime does not accept a state slot. Its
place in reported order is not an implemented workflow or a promise of a date.

## Derived records

| Record | Fields and invariants |
| --- | --- |
| Resolved bus | JSON `{params: {key: value}}`, all defined effective values; recomputed from inputs. |
| Effective report | Per-sink JSON map `{key: {value, from}}`; both fields strings, value validated by its definition. Unknown keys, invalid JSON/value and duplicate reports of a key fail describe. Missing report directory means no reported colors. |
| Sink status | Per-sink JSON map `{ok, at, params, error?}`: boolean result, ISO timestamp, bound parameter snapshot and diagnostic on failure. Doctor compares generated targets and current values with recorded application. |

An effective report describes the last successful installed output, not a saved
override. The niri report publishes after config validation and before reload.
The bus can become stale after interruption; `prism doctor` reports divergence
and `prism apply` recomputes it and retries sink application.

## Mutation exchange

CLI commands and panel actions are clients of the same store. A store lock
serializes mutation and coherent reads. A lock identifies PID/start time and a
unique token; only proven holder death permits reclamation, not age alone.
Writers replace whole look/runtime files through same-directory temporary files.
Sink and status locks separately serialize output and status publication.

| Operation | Saved/runtime write order and appearance |
| --- | --- |
| Select profile/Default with wallpaper | Save all outgoing scratch to its pair; publish next slots and empty scratch; recompute/apply bus. Same-look explicit selection follows this rule. |
| Select without wallpaper | Publish selected look and empty scratch; recompute/apply. Pending edits are discarded. |
| Rotate/activate/deactivate wallpaper | Publish next slot and carried scratch together, then bus/apply. Save no outgoing pair. Incoming pair keys win; other visible values are carried as edits. Reobserving the same wallpaper is a no-op. |
| Recover from broken selected look | Validate incoming look and inputs; select it with scratch preserved; apply all bound keys. Do not save an unreadable outgoing pair. |
| Keep in look or pair | Write the whole look, then clear scratch in runtime; verify effective values do not change. The resolved bus is not rewritten by commit. |
| Save As | Write destination full snapshot, remove its current-wallpaper pair, retain other pairs; select it with empty scratch. Outgoing look is untouched. |
| Clear pair | Replace look without that pair, retain slots and scratch, then bus/apply. |
| Delete active profile | Publish Default selection with scratch preserved; unlink profile; then bus/apply. |
| Rename active profile | Hard-link complete file; repoint runtime; unlink old name. Preserve appearance and bus. |
| Layout migration | Immutable backup and absence list; all look writes; runtime; then remove old sources. No sink applies. |

Keeping in Default or the loaded profile removes committed keys from that look's
active pair in the same file replacement. Default values equal to definition
defaults are omitted. `commit base` refuses while a named profile is loaded;
unnamed `commit profile` requires one. Ordinary empty commits fail with nothing
to commit; Save As can snapshot without pending edits.

Rendered Keep, Save As, Clear, Rename and Delete actions carry both
`--expect-look` (`default` or `profile:<name>`) and `--expect-wallpaper`
(`none` or `id:<id>`). Both are required together when used and are checked under
the lock before mutation; a stale pair of slots fails. Direct CLI calls may omit
both. A wallpaper operation also checks its positional ID against the active one.
Explicit profile selection carries no expected-slot guard.

## Failure and recovery

File replacement and write ordering cover process interruption, not power-loss
durability. Before runtime publication, scratch covers an interrupted saved write;
after it, apply repairs a stale bus. Retry profile/pair migration from current
files: identical copies are accepted; conflicts are refused without overwriting.
Retrying a completed selection is a new selection, not a transaction rollback.
The store can be updated even when a sink fails; the CLI reports that failure and
keeps its diagnostic. Repair the sink requirement/output and rerun apply.

Ordinary reads never repair bad records. Select Default to escape a broken named
look; repair malformed Default/runtime before resolving. A structurally readable
invalid pair may be cleared; malformed shared YAML must be repaired explicitly.
Migration backups and rollback procedures are in [usage](usage.md#migration-and-rollback).
