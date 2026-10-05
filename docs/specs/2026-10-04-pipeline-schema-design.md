# Pipeline schema: the renderer's sites, scope, composition law, and coverage as data

**Date:** 2026-10-04
**Status:** draft, awaiting owner review
**Task:** `prism-eef38f`, first design child of goal `prism-a03862` (device
chain). Spans prism and niri-material; the renderer-side steps are filed in
niri-material and reference this document by path.

## Context

The device rack (`2026-09-08-device-chain-rack-design.md`) presents the glass
optics as an ordered chain "in the shader's order", and `defs/rack/devices.yaml`
restates that order by hand. It drifted within nine days: niri-material moved
saturation and noise to a hook before Beer-Lambert tint on 2026-09-18
(`docs/specs/2026-09-12-material-render-order-design.md` there), and the rack
kept showing them last until `prism-ba8c59` fixed the file on 2026-10-04.
Nothing could have caught it, because prism holds no machine-readable
statement of what the renderer does.

The goal's next piece is the first device that can move: noise applied before
the frosted blur instead of after it (`material-cf32e5`, `prism-be5abe`). That
cannot be a card reorder. The material shader has no list to permute. Blur is
a source selection made once per output before any glass fragment runs
(niri-material `docs/materials/render-pipeline.md` §2 and §4), and every other
stage is bound to one of six hook sites. "Order" in this pipeline means which
site a device occupies and, inside a site, where composition does not
commute, the sequence there.

A 2026-10-04 review of the first proposal made five objections: a site enum
does not describe order inside a site; a grained backdrop texture is shared by
every window and cannot carry a focus split; "cached is cheaper" is a
hypothesis; the rack misrepresented the order; film grain lands on glass
only, not the window. All five are projections of one structure the renderer
already has. This design writes that structure down as data, owned by the
renderer, pinned to its code by tests, and consumed by prism's rack, sink, and
later exploration tools.

## Decisions

- **The schema is renderer-owned data, generated from Rust tables and pinned
  by tests.** niri-material gains static tables for sites and stages beside
  its parameter specs, a test that renders them to
  `resources/materials/pipeline.json` under `MATERIAL_DOCS_UPDATE=1` and fails
  when the file is stale (the pattern `material-config.md`'s parameter table
  already uses), and tests that pin the tables to `OPTICS`, `ORDER`, every
  `ParamSpec`, and the hook calls in `main.frag`.
- **Prism vendors the file and validates against it.** `defs/rack/pipeline.json`
  is a byte copy; a contract test compares it with the niri-material checkout
  when one is reachable. `loadRack` checks `devices.yaml` against the schema
  and fails on a device out of stage order, a `requires` the schema does not
  carry, or a stage the schema does not know. The rack file keeps only what
  is presentation.
- **Scope is a stage attribute; carrier, law, coverage, and cost belong to the
  site.** A per-output texture site can host a per-material stage that only
  selects from it (roughness picks a pyramid level), so scope cannot be the
  site's.
- **Order is a parameter exactly where the law is a sequence.** Additive
  light commutes; function composition on a color does not. The schema marks
  each site's law so a future order control is offered only where it means
  something. No order control is added here.
- **A placement is legal when code exists for it.** The schema describes the
  pipeline as built. Noise at the source or post site enters the schema with
  `material-cf32e5`, not before. The physics-versus-model argument becomes
  moot: a site is legal when the renderer implements it.
- **The rack's category becomes the stage's site family.** `category` leaves
  `devices.yaml`; the panel colors a card by the site family the schema gives
  its stage. "post" on saturation and noise was a second copy of the same
  stale fact.
- **A device's `requires` is derived, never written.** It comes from the
  schema's `requires` edges or from the sink's dry table, which moves from
  `render.js` into `integrations/niri/dry.yaml` so the rack loader can read
  it without importing sink code. Fringing's silence under a bypassed
  Refraction is a sink policy, not a renderer fact, and the schema does not
  carry it.
- **The interaction matrix has two cell kinds, and only one is derived.**
  Structural edges (one device makes another inert or invisible by
  construction) come from the schema. Perceptual dominance (both survive, one
  swamps the other) is measured. The schema carries the first; an evidence
  document carries the second.
- **Nothing is reserved speculatively.** No placements, order controls, or
  cost numbers appear in the schema before their first consumer.

## Section 1: the model

### Sites

A site is a point in the per-frame computation where a stage can act. Each
has four attributes:

| Attribute | Values | Meaning |
| --- | --- | --- |
| `carrier` | `texture`, `normal`, `linear`, `light`, `encoded` | The value a stage here transforms: a per-output offscreen texture; the slab's surface normal; linear-light RGB of the transmitted backdrop; additive linear light; encoded sRGB. |
| `law` | `sequence`, `sum`, `product`, `coupled` | How two stages at the site combine. `sequence`: function composition, order matters. `sum` and `product`: commutative, order is meaningless. `coupled`: the site's stages are one computation (the refraction taps); there is no notion of order among them. |
| `coverage` | `backdrop`, `glass`, `window` | Where the result lands. `backdrop`: the shared texture every glass window samples. `glass`: the slab's translucent pixels and the band outside the window; opaque client pixels bypass the material shader entirely. `window`: the window's area under the client, drawn by the separate background-effect element. |
| `cost` | `cached`, `fragment` | `cached`: recomputed when the backdrop is damaged and reused across frames and windows. `fragment`: evaluated per glass fragment per frame. A cost class frames measurement; it is not a measurement. |

The sites, in pipeline order:

| # | Site | Carrier | Law | Coverage | Cost | Where in the renderer |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `source` | texture | sequence | backdrop | cached | `effect_buffer.rs`: sharp offscreen, Kawase blur, prefilter pyramids |
| 2 | `normal` | normal | sequence | glass | fragment | `main.frag` before the taps; hook `normal` |
| 3 | `taps` | normal → linear | coupled | glass | fragment | `tap()` loop in `main.frag` |
| 4 | `behind` | linear | sequence | glass | fragment | hook `behind` |
| 5 | `attenuation` | linear | product | glass | fragment | Beer-Lambert in `main.frag` |
| 6 | `within` | light | sum | glass | fragment | ring beam and hook `within` |
| 7 | `specular` | light | sequence | glass | fragment | Fresnel glint and hook `specular` |
| 8 | `emissive` | light | sum | glass | fragment | sweeps and hook `emissive` |
| 9 | `encode` | linear → encoded | coupled | glass | fragment | `linearToSrgb(transmitted + within + specular + emissive)` |
| 10 | `post` | encoded | sequence | glass | fragment | hook `post`, empty today |
| 11 | `background-effect` | encoded | sequence | window | fragment | `postprocess.frag` under the window body |

`specular` is a sequence, not a sum, because its hook signature transforms the
glint (`iridescence_specular(specular, …)` hues what it receives) rather than
adding to it. `within` and `emissive` hooks return light that is added.

### Stages

A stage is one named step at a site, with the parameters that act there.
Attributes:

| Attribute | Meaning |
| --- | --- |
| `id` | Stable name; prism device ids match these where a device exists. |
| `site` | One of the sites above. |
| `scope` | `output` (one value per output, shared by every window), `material` (per material definition, which prism splits into focused and unfocused), `window` (per window rule). |
| `params` | The native parameter nodes that act at this stage, spelled as `ParamSpec.node` spells them (`"noise"`, `"noise type="`, `"roughness"`); global `blur` block fields as `"blur passes"`, `"blur offset"`. |
| `optic` | Present when the stage is an entry of `OPTICS`; carries the hook name. |
| `animated` | True when the stage's uniforms change without a configuration change (`next_change` is not `None`, or the stage reads a signal or jelly state). |

Today's stages, in order. Devices in the rack are marked; the others are
shared geometry, signal-driven light, or plumbing.

| # | Stage | Site | Scope | Params | Optic | Animated | Device |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `blur` | source | output | `blur passes`, `blur offset` | | | |
| 2 | `prefilter` | source | material | `backdrop-blur`, `roughness` | | | `backdrop` |
| 3 | `slab` | normal | material | `bevel`, `offset-x`, `offset-y`, `thickness`, `jelly-flex` | | yes (residuals) | |
| 4 | `distortion` | normal | material | `distortion`, `distortion scale=` | | | `distortion` |
| 5 | `ripple` | normal | material | `jelly-ripple` | | yes | |
| 6 | `refraction` | taps | material | `ior`, `thickness` | | | `refraction` |
| 7 | `fringing` | taps | material | `chromatic-aberration` | | | `fringing` |
| 8 | `directional-blur` | taps | material | `anisotropic-blur` | | | `directionalBlur` |
| 9 | `saturation` | behind | material | `saturation` | `saturation_behind` | | `saturation` |
| 10 | `noise` | behind | material | `noise`, `noise type=` | `noise_behind` | | `noise` |
| 11 | `tint` | attenuation | material | `attenuation-color`, `attenuation-distance`, `thickness` | | | `tint` |
| 12 | `ring` | within | material | `light-ior`, `roughness`, `ring-*`, `chromatic-aberration` | | yes (signal) | |
| 13 | `aurora` | within | material | `aurora`, `aurora drift-hz`, `aurora color` | `aurora_within` | yes | `aurora` |
| 14 | `glint` | specular | material | `ior` | | yes (signal light) | |
| 15 | `iridescence` | specular | material | `iridescence` | `iridescence_specular` | | `iridescence` |
| 16 | `sweeps` | emissive | material | (responses only) | | yes | |
| 17 | `encode` | encode | material | | | | |
| 18 | `effect-saturation` | background-effect | window | `blur saturation` | | | |
| 19 | `effect-noise` | background-effect | window | `blur noise` | | | |

The two background-effect stages read the global `blur` fields; a window
rule's `background-effect` block overrides them per window, which is what
`window` scope records. Prism's terminal rule pins both neutral.

The parameter-to-stage map is the inverse of the `params` column and
formalizes §5 of `render-pipeline.md`: `thickness` acts at `slab`,
`refraction`, and `tint`; `roughness` at `prefilter` and `ring`; `ior` at
`refraction`, `ring`, and `glint`. A parameter with more than one stage is why
a device and a stage are not the same thing: the device `refraction` owns the
`ior` slider, and the schema says where else it reaches.

### Interactions

Structural edges between stages, each with a kind and a one-line reason that
names the mechanism:

| Kind | Meaning | Today's edges |
| --- | --- | --- |
| `requires` | The source stage has no visible effect while the target is inert. | `directional-blur` requires `refraction` (jittered taps at ior 1 sample one point, so there is nothing to smear). |
| `attenuates` | The source stage's setting scales the target's visible output without zeroing it. | `refraction` attenuates `prefilter` (the prefilter level is `roughness * clamp(ior * 2 - 2, 0, 1)`, so ior 1 flattens Blur while frosted backdrop still selects the blurred source). |
| `shadows` | The source stage operates downstream of the target on the same carrier and can remove what the target produced. | None today. Enters with film-site saturation (`material-cf32e5` follow-ups), which would grey tint and ring light alike. |

Fringing is deliberately not a `requires` edge. At ior 1 its green and blue
channels still refract (their indices are `ior * (1 + spread)`), so the
renderer does not silence it; prism's niri sink does, by zeroing
`chromatic-aberration` in Refraction's dry entry so that "bypass Refraction"
means no refraction at all. That is a sink policy, and Section 3 derives the
rack's `requires` from the dry table for it rather than asking the schema to
carry a fact that is not the renderer's.

Two facts the matrix makes checkable rather than argued. First, with
saturation at `behind` (before `attenuation`), saturation 0 does not remove
the tint's hue: Beer-Lambert multiplies afterwards, so a grey backdrop still
tints. The first proposal for this design claimed the opposite from memory of
the older order. Second, the whole-window case is not an edge: an opaque
client pixel bypasses every `glass`-coverage stage at once, which is a
property of coverage, and the rack says it once rather than per device.

### What is derivable and what is measured

From the schema alone: which order choices exist (sequence sites with two or
more stages: `behind` today), which placements exist (the stages an optic
has), where a scope change happens when a device moves (a stage with `output`
scope has one value, so no focus split), what a placement covers, its cost
class, and the structural edges. The space a dice button or a sweep may
explore is placements × orders at sequence sites × parameter ranges, minus
what scope forbids.

Not from the schema: whether two surviving effects read as one swamping the
other, how much a placement costs on a given backdrop, and which regions of
the legal space look good. Those are capture results and belong in evidence
documents under niri-material's `docs/materials/`, never in the schema file.

## Section 2: the renderer side (niri-material)

### Tables

`niri-config/src/material/pipeline.rs` holds the data as plain statics:

```rust
pub struct Site { pub id: &'static str, pub carrier: Carrier, pub law: Law,
                  pub coverage: Coverage, pub cost: Cost }
pub struct Stage { pub id: &'static str, pub site: &'static str, pub scope: Scope,
                   pub params: &'static [&'static str], pub optic: Option<&'static str>,
                   pub animated: bool }
pub struct Interaction { pub kind: Kind, pub from: &'static str, pub on: &'static str,
                         pub why: &'static str }
pub static SITES: &[Site] = &[ /* Section 1, in order */ ];
pub static STAGES: &[Stage] = &[ /* Section 1, in order */ ];
pub static INTERACTIONS: &[Interaction] = &[ /* Section 1 */ ];
```

The enums serialize as the lowercase strings of Section 1. `optic` holds the
hook function name (`"noise_behind"`), from which the optic name and hook are
both readable.

### Tests that pin the tables to the code

In niri-config:

- Every `ParamSpec.node` from `all_params()` appears in at least one stage's
  `params`, and every entry of a stage's `params` is a `ParamSpec.node` or one
  of the four global `blur` fields. There is no exemption list.
- Every stage's `site` names an entry of `SITES`; stages are grouped by site
  in site order (no stage of site 4 appears after a stage of site 5).
- Every optic in `ORDER` has exactly one stage whose `optic` names it, and
  those stages appear in `ORDER`.
- Every interaction names two stages; a `requires` edge's target precedes its
  source.

In niri (the renderer crate), beside the existing `OPTICS`-matches-`ORDER`
test:

- For every stage with an `optic`, `main.frag` contains a call to that
  function, and the calls appear in stage order. The test reads the shader
  source the program is assembled from; the existing "one call per used hook"
  rule in `adding-an-optic.md` becomes checked.
- The `post` site has no stage and `main.frag` has no `_post(` call, or both
  exist. The empty reserved site stays visibly empty.

### The generated file

`material_pipeline_schema_matches_the_file` renders `SITES`, `STAGES`, and
`INTERACTIONS` to JSON with `serde_json` (already a workspace dependency) and
compares with `resources/materials/pipeline.json`; `MATERIAL_DOCS_UPDATE=1`
rewrites it. The file carries `"version": 1` and the tables verbatim:

```json
{
  "version": 1,
  "sites": [{"id": "source", "carrier": "texture", "law": "sequence",
             "coverage": "backdrop", "cost": "cached"}, …],
  "stages": [{"id": "noise", "site": "behind", "scope": "material",
              "params": ["noise", "noise type="], "optic": "noise_behind",
              "animated": false}, …],
  "interactions": [{"kind": "requires", "from": "fringing", "on": "refraction",
                    "why": "…"}, …]
}
```

`version` increments only when a field changes meaning or disappears; adding
a site, stage, param, or interaction is not a version change. The schema says
what the pipeline is, so a prism built against version 1 reads any later
version-1 file.

`render-pipeline.md` gains one paragraph pointing at the file and the tables;
`adding-an-optic.md` gains a step: add the optic's stage (and any interaction)
to `pipeline.rs`, then regenerate. Both are documentation of an existing
contract, not new rules.

### Extension rule

A stage enters the schema in the same change as its code. An optic with more
than one implemented hook has one stage per hook, each carrying the same
`optic` name with its hook suffix, and the parameter that selects among them
(`noise site=` in `material-cf32e5`) is listed in `params` of every stage it
selects, with the enum's variants naming those stage ids. Section 5 spells
this out for noise.

## Section 3: the prism side

### The vendored copy and its contract test

`defs/rack/pipeline.json` is a byte copy of niri-material's generated file. It
sits beside `devices.yaml`, one directory below the defs scan, for the same
reason the rack does. `test/pipeline-contract.test.js`:

- Parses the vendored file and checks `version === 1` and the field shapes
  Section 2 defines. A malformed or unknown-version file fails.
- Resolves the niri-material checkout from `NIRI_MATERIAL_DIR` or, when that
  is unset, from the tasks registry entry for `material`. When neither
  resolves, the comparison subtest is skipped with that reason printed; when
  one resolves, the vendored bytes must equal
  `resources/materials/pipeline.json` there. Drift fails the suite on every
  machine that has both checkouts, which is every machine this project is
  developed on.

The copy is refreshed by hand (`cp`) when niri-material regenerates. A
`just`-level helper is not added; the failing test says which direction to
copy.

### The rack file against the schema

`devices.yaml` changes shape:

```yaml
group: Focus
devices:
  - device: backdrop
    label: Backdrop
    stage: prefilter
    mix: Blur
    rows: [Frosted backdrop]
    shared: []
    bypass: glass.bypass.backdrop
  # …
  - device: fringing
    label: Fringing
    stage: fringing
    mix: Fringing
    rows: []
    shared: []
    bypass: glass.bypass.fringing
    requires: refraction
```

`category` is gone; `stage` is new and required. `loadRack(dir, defs)` reads
the vendored schema itself and `validateRack(rack, defs, schema)` adds these
rules to the existing ones:

- `stage` names a stage in the schema. Two devices never name one stage.
- Devices appear in schema stage order. The rack has no order of its own.
- `requires` on device A naming device B is present exactly when one of two
  derivable facts holds: the schema has a `requires` edge from A's stage to
  B's stage, or B's entry in the sink's dry table writes a node that belongs
  to A's stage (Refraction's entry zeroes `chromatic-aberration`, Fringing's
  mix). A rack `requires` neither source explains, or a derivable one the
  rack omits, fails the load. The dry table moves from `render.js` to
  `integrations/niri/dry.yaml`, read by both the sink and `loadRack`, so the
  rule needs no import of sink code. An `attenuates` edge imposes nothing on
  the rack file; the panel rules below say how it shows.
- Every stage whose `params` include a node some prism parameter writes has a
  device, unless the stage is listed in a short `shared:` list at the top of
  the rack file naming stages prism exposes outside the rack (`slab`, `ring`,
  `blur` where it is exposed at all). The list exists so the omission is a
  decision in the file, not an accident.

The last rule needs the prism-key-to-native-node map, which exists today only
inside `integrations/niri/render.js`. Each `binds` entry in
`integrations/niri/manifest.yaml` gains `node: <ParamSpec.node>` for keys
that write a material parameter (`{param: glass.roughness, node: roughness,
liveness: reload}`); keys with no native node (`glass.tintSource`,
`glass.bypass.*`, `compositor.gaps`) carry none. A test in
`test/niri-render.test.js` checks every `node` against the schema's parameter
set, and `validateRack` reads the manifest for the map. This makes a fact the
sink already relies on explicit; it does not change what the sink writes.

### `describe --json` and the panel

Each rack device in the `describe` payload gains `site`, `scope`, and `family`
resolved from the schema; the rack's `group` and `devices` are otherwise
verbatim as today. The whole schema is not carried until a consumer needs
more than that (`prism-be5abe` will, for the legal sites of noise, and adds
it then).

Site families, for color: `source` (`source`), `geometry` (`normal`),
`transmission` (`taps`, `behind`, `attenuation`), `light` (`within`,
`specular`, `emissive`), `post` (`post`). `presentation.luau` replaces
`categoryColors` with `familyColors`; the three existing colors keep their
families (`source` blue, `geometry` purple, `transmission` teal), `post` keeps
orange for the day it has a device, and `light` gets a fifth color chosen in
implementation to stay distinguishable from the others at the light's 12 px
size. Saturation and noise therefore turn teal with the devices they share a
carrier with; aurora and iridescence take the light color.

The panel's silenced light stays as it is for `requires`. An `attenuates` edge
whose source device is bypassed adds one line to the target card's existing
hint row ("Blur is flattened while Refraction is bypassed"), no light change,
because the silence is partial; the 2026-09-08 spec recorded that coupling in
prose and this makes it data.

## Section 4: the interaction matrix

The matrix is a table over the rack's devices plus the shared stages, one
cell per ordered pair, with a cell kind:

| Cell | Source | Content |
| --- | --- | --- |
| structural | the schema's `interactions` | kind, mechanism, and the decision below |
| perceptual | capture evidence | the condition under which one swamps the other, with the evidence document |
| none | the schema (no edge) and no evidence | empty |

Each structural edge carries one decision, recorded in the schema's `why`
suffix as `[expose]`, `[alternative]`, or `[drop]`:

- `expose`: keep both devices and show the interaction in the rack. Both of
  today's edges are `expose`: the `requires` edge already renders as the
  hollow light (as does the sink-derived one on Fringing), and the
  `attenuates` edge renders as the hint line in Section 3.
- `alternative`: the dominated device is kept, and a placement or parameter
  that cooperates is preferred; the schema change that adds the alternative
  names the edge it answers.
- `drop`: the dominated device leaves the rack. None today.

Perceptual cells are owned by niri-material's capture work under
`material-0f225e`; this design defines the cell semantics so those results
have a place to land, and adds no capture task. A perceptual finding that
turns out to be structural (a mechanism explains it) moves to the schema as
an edge.

The matrix for today's pipeline is small: two structural cells from the
schema, one sink coupling, no perceptual ones. It is rendered by a prism test helper from the vendored
schema into `docs/notes/pipeline-interactions.md` under the same update-flag
pattern, so the document is never hand-edited and the decision column is
read from the schema.

## Section 5: how noise placement extends this

`material-cf32e5` adds two stages, `backdrop-grain` (site `source`, scope
`output`, params `noise`, `noise type=`, `noise site=`, optic
`noise_source`) and `film-grain` (site `post`, scope `material`, same params,
optic `noise_post`), and lists `noise site=` on the existing `noise` stage.
The enum's variants are `backdrop`, `glass`, `film` and map to those three
stage ids in that order; the schema's parameter entry for `noise site=` says
which stage each variant selects. The renderer tests from Section 2 then
require a `noise_source` call in the effect-buffer path and a `noise_post`
call after encoding, in order.

`prism-be5abe` adds `glass.noiseSite` bound to `noise site=`, and extends the
rack file so a device may name a `selector` instead of a fixed `stage`: the
device's stage is whichever the selector's current value picks. The panel
draws the card at that stage's position in site order, says "one amount, per
output" when the stage's scope is `output` (and hides the unfocused mix cell
with that reason, instead of dropping it silently), and offers only the
selector's variants as drop zones. The `shadows` edges that film-site grain
and any film-site saturation create are added with those stages.

Neither task changes Section 1's attributes or Section 2's file shape. If one
needs to, the version bumps and this document is revised first.

## Section 6: errors, testing, acceptance

Errors follow the project rule: fail on load, name the device, stage, or
parameter, never guess. A rack naming an unknown stage, a stale vendored
schema, a `requires` the schema does not carry, or a device out of stage
order fails `prism describe` with that message, and the panel shows it in
the contract banner it already has.

niri-material tests: the four table pins in niri-config, the two shader pins
in niri, and the generated-file freshness test, as listed in Section 2.

Prism Node tests:

- `test/pipeline-contract.test.js` as in Section 3.
- `test/rack.test.js`: one case per new rule (unknown stage, duplicate stage,
  out of order, missing `requires`, extra `requires`, stage with bound params
  and no device, `category` present), plus the shipped rack loading against
  the shipped defs and vendored schema with `site`, `scope`, and `family`
  resolved.
- `test/cli.test.js`: `describe --json` carries the three resolved fields per
  device.
- `test/niri-render.test.js`: every manifest `node` is a schema parameter;
  the dry table loads from `dry.yaml` and the golden output is unchanged; the
  dry-table-to-rack cross-check is unchanged.

Lua tests in `plugin_test.lua`: cards keyed by `family`, the five family
colors distinct, the `attenuates` hint line present on Backdrop while
Refraction is bypassed and absent otherwise, existing light states unchanged.

Acceptance is the drift case: with the vendored schema regenerated from a
niri-material tree whose `ORDER` swaps two behind optics, `just test` in
prism fails in the rack test naming the two devices, before any panel is
opened. Desktop acceptance of the recolored lights is a manual look, as for
the original rack.

## Out of scope

- An order control inside a site, and any reordering UI (`prism-542904` stays
  shelved until a second device can move).
- Noise placement itself (`material-cf32e5`, `prism-be5abe`).
- Restructuring the niri sink's dry table around the schema; it moves to a
  file but stays keyed by bypass parameter with the same entries.
- Carrying the whole schema in `describe`, cost numbers, or perceptual
  evidence in the schema file.
- Installing the schema through packaging or IPC; the vendored copy and its
  contract test are the delivery mechanism for now.
- The learned-order and parameter-structure ideas (`material-e2f01a`,
  `material-0c7eed`); they consume the schema and are scoped separately.
