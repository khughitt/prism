# Definitions, sinks and the device rack

Type: data model, guide; document types 1. Definition, manifest, dry-table and
rack records are currently unversioned; the vendored renderer pipeline uses format
1. This describes their fields, validation and maintenance. Related:
[store](store.md), [plugin exchange](noctalia-plugin.md) and [desktop setup](desktop.md).

## Parameter definitions

Each top-level YAML file in `defs/` contains a list of parameter records.
`src/defs.js` loads files in name order and rejects duplicate parameter keys.

| Field | Meaning and accepted values |
| --- | --- |
| `key` | Dotted key matching `[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+`. |
| `type` | `float`, `int`, `bool`, `color`, `enum`, `string`, or `list`. |
| `default` | Required value used below every saved layer; checked during resolution. |
| `description` | Required string describing the parameter. |
| `range` | Numeric definitions require two finite increasing endpoints; values include both endpoints. |
| `values` | An enum requires its allowed-value list. |
| `items` | A list requires `string`; only arrays of strings are accepted as values. |
| `neutral` | Visible controls declare a valid quiet-baseline value, or the exemption below. |
| `neutralize` | Only `false`; mutually exclusive with `neutral`. Neither appears on hidden controls. |
| `replaces` | Optional retired dotted key. It cannot be self, a still-defined key, or have two replacements. |
| `ui` | Presentation record below. Unknown UI fields are rejected. |

Values must have their declared type: finite floats, integral integers, booleans,
strings, enum members, string arrays, or `#rrggbb`/`#rrggbbaa` colors. Numeric
values outside their range fail. CLI list values use JSON arrays; booleans use
`true` or `false`. Unknown saved parameter keys fail even when shadowed.

## UI metadata

| Field | Meaning and accepted values |
| --- | --- |
| `control` | `slider`, `toggle`, `color`, `select`, or `none`. String/list definitions use `none`. |
| `group` | Required section string. |
| `label`, `order` | Visible controls require a nonempty label and globally unique integer order. |
| `step` | Sliders require a positive finite canonical increment; integer sliders require an integer. |
| `display` | Slider label: `raw` (default), `percent`, or `normalized`. |
| `unit` | Optional nonempty suffix, only for a raw slider label. |
| `scale` | Slider track: `linear` (default), `logarithmic`, or `power`. Logarithmic ranges start above zero. |
| `exponent` | Required finite number greater than 1 for power scales, forbidden otherwise. |
| `state`, `row` | Together: `focused`/`unfocused` and a nonempty row label. Supported for sliders, toggles and colors. |
| `header` | Only `true` on a toggle; at most one per group. |
| `subgroup` | Nonempty subgroup label; all visible non-header rows in a group use it or none do. Each subgroup is contiguous in order. |
| `when` | Gate record with only `param`, `in`, `otherwise`: an existing enum key, nonempty list of its string members, and `hidden` or `effective`. |

`effective` gates apply only to colors, showing the sink-reported swatch beside
the source selector. Gates and subgroups are forbidden on `none`; headers take
neither. Non-sliders reject display/scale/unit/exponent. Slider span must be an
integer multiple of step within floating-point tolerance; integer sliders also
need integer endpoints. Curves change track mapping, not the canonical value.
Matrix halves share neutral and gate metadata. A malformed/missing/duplicated
state in the rack fails validation; the panel validates ordinary matrix rows too.

## Sink manifests and output

Each integration directory may contain `manifest.yaml`; directories without one
are skipped. `PRISM_INTEGRATIONS_DIR` overrides the integration root.

| Field | Meaning and accepted values |
| --- | --- |
| `sink` | String identifying the sink. |
| `binds` | Required list: each entry has declared `param` and `liveness` of `live`, `reload`, or `restart`. |
| binding `drag` | Optional `release`, only with `liveness: live`; batches live-capable writes until gesture release. |
| binding `node` | Optional nonempty renderer node string, used for stage ownership. |
| `generates` | Optional list of bare output filenames, default empty; no directory components or `.`/`..`. |
| `requires` | Optional list, default empty. Each entry chooses exactly one `command` on PATH or bare `probe` name, plus nonempty `fix`. |
| requirement `when` | Optional existing boolean parameter; false skips that requirement, not the sink. |

A probe names an executable regular file `probe-<name>` beside `apply`.
The apply executable receives the resolved JSON path followed by changed keys.
It reads the bus's `params`, writes its declared generated files, and fails
nonzero with the useful diagnostic on stderr. Fan-out invokes each selected sink
once; the slowest binding determines reported liveness, and any non-live or
release binding makes a parameter's effective drag mode `release`.
Apply/probe subprocesses have a 5-second bound; probe children use 2 seconds.

Generated files live under `$PRISM_STATE_DIR/generated/` (or its XDG default). Optional effective
reports and apply status are specified in [store records](store.md#derived-records).
They report installed state; they do not replace saved parameter values.

## Rack and dry records

The rack file `defs/rack/devices.yaml` has nonempty `group`, list `shared` of
stage IDs, and a nonempty `devices` list. Each device has only these fields:

| Field | Meaning |
| --- | --- |
| `device`, `label` | Unique ID matching `[a-z][a-zA-Z0-9]*` and nonempty display label. |
| `stage` | Existing pipeline stage, unique among devices and absent from top-level shared stages. |
| `mix`, `rows` | Main matrix-row label and list of detail-row labels in the rack group. |
| `shared` | List of single parameter keys exposed by the device. |
| `bypass` | A boolean toggle key; the sink supplies its dry meaning. |

Every rack row/single belongs to one device, except its group-header toggle.
Device order follows pipeline stage order. Bound native nodes must belong to
that device's stage; every written stage has a device or explicit shared status.
Authored `category` and `requires` are rejected: site family and dependencies are
derived. The describe rack adds `site`, `scope`, `family`, `interactions`, and an
optional earlier-device `requires`. Multiple distinct requirements are rejected.
Each interaction has `kind`, other `device`, `why` and `source` (`schema` or `dry`).

Each sink's optional `dry.yaml` maps a `glass.bypass.<device>` key to nonempty
renderer-field overrides. A field names the suffix of a parameter in the same
namespace; its manifest binding provides the native node. Duplicate bypass
declarations across sinks, unknown bypasses or fields without a node fail.
Dry coupling derives requires edges; schema edges carry their own decision suffix.

## Pipeline and structural interactions

`defs/rack/pipeline.json` is a byte copy of the renderer's generated file.
Its [renderer-owned model](https://github.com/khughitt/niri-material/blob/materials-26.04/docs/materials/pipeline-schema.md)
defines sites, stages, interactions, scope and composition law. Prism validates
version/shape at load and rack ownership against it. The byte-contract test uses
`NIRI_MATERIAL_DIR` or the registered material checkout; with neither it reports
its explicit skip. Runtime operation needs no renderer source checkout.

The block below is generated from the pipeline and niri dry table. The decision
is explicit; perceptual hypotheses are not invented as unconditional edges.

<!-- interactions:begin -->
| Device | Depends on | Kind | Source | Mechanism | Decision |
| --- | --- | --- | --- | --- | --- |
| Backdrop | Refraction | attenuates | schema | the prefilter level is roughness * clamp(ior * 2 - 2, 0, 1), so ior 1 flattens Blur while frosted backdrop still selects the blurred source | expose |
| Fringing | Refraction | requires | dry | the glass.bypass.refraction dry entry writes chromatic-aberration | expose |
| Directional blur | Refraction | requires | dry | the glass.bypass.refraction dry entry writes anisotropic-blur | expose |
<!-- interactions:end -->

Conditional coupling stays prose: at zero chromatic aberration, ior 1 leaves no
depth-jittered spread for directional blur; nonzero aberration still spreads the
other color taps. No measured perceptual interactions are asserted here.

## Direction and limits

The renderer currently fixes stage order. A sequence composition law does not
enable a reorder control: configurable order or placements need renderer/schema
support and corresponding Prism bindings before Prism can expose them. The schema
may describe stages and placement selectors that Prism does not yet control.

## Maintain and diagnose

Add a definition, bind it in its sink, and assign its owned rack row/stage when
visible. Run the corresponding definition/rack/sink tests through `just test-one`.
For a renderer schema update, copy its generated bytes rather than edit the copy.
Regenerate only the interaction block with
`PRISM_DOCS_UPDATE=1 just test-one test/pipeline-interactions.test.js`; a normal
`just test-one test/pipeline-interactions.test.js` rejects stale/missing markers.
`just test-fast` includes these checks and the real CLI/Lua contract; `just check`
checks guides/types and hygiene. A schema or ownership error is a definition/
binding problem, not a reason to disable validation.
