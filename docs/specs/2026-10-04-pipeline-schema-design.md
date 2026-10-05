# Pipeline schema: the renderer's sites, scope, composition law, and coverage as data

**Date:** 2026-10-04
**Status:** draft, revised 2026-10-05 after spec review rounds 1 and 2
(codex); awaiting owner re-review
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
stage is bound to a hook site or a fixed step in `main.frag`. "Order" in this
pipeline means which site a device occupies and, inside a site, the fixed
sequence the shader calls.

A 2026-10-04 review of the first proposal made five objections: a site enum
does not describe order inside a site; a grained backdrop texture is shared by
every window and cannot carry a focus split; "cached is cheaper" is a
hypothesis; the rack misrepresented the order; film grain lands on glass
only, not the window. All five are projections of one structure the renderer
already has. This design writes that structure down as data, owned by the
renderer, pinned to its code by tests, and consumed by prism's rack, sink, and
later exploration tools.

Spec review round 1 (2026-10-05) found six further issues, all fixed below:
composition law was conflated with an order capability; one dependency edge
was false under chromatic aberration; the parameter contract excluded response
fields the ring stage reads; the parameter map mixed ownership with influence;
the promised noise extension could not fit the pinning rules or the JSON
shape; and the panel hint had no data to read. The three smaller
contradictions it named (authored versus derived `requires`, carrier values
outside their enum, test-only versus load-time freshness) are also resolved.
Round 2 corrected two more: `thickness` is owned by `refraction`, whose Depth
row already binds it, with `slab` reading it; and registry order is checked
per `(program, site)`, since one optic may appear at several sites.

## Decisions

- **The schema is renderer-owned data, generated from Rust tables and pinned
  by tests.** niri-material gains static tables for sites, stages, and
  interactions beside its parameter specs, a test that renders them to
  `resources/materials/pipeline.json` under `MATERIAL_DOCS_UPDATE=1` and fails
  when the file is stale (the pattern `material-config.md`'s parameter table
  already uses), and tests that pin the tables to `OPTICS`, `ORDER`, every
  `ParamSpec`, the response block's fields, and the hook calls in each shader
  program.
- **Prism vendors the file and validates against it.** `defs/rack/pipeline.json`
  is a byte copy. Load time checks the copy's version and shape and the rack
  against it; a test compares the copy with the niri-material checkout when
  one is reachable. The rack file keeps only what is presentation.
- **Scope is a stage attribute; carrier, law, coverage, cost, and orderability
  belong to the site.** A per-output texture site can host a per-material
  stage that only selects from it (roughness picks a pyramid level), so scope
  cannot be the site's.
- **Composition law describes; it does not grant.** `law` says whether the
  order of two stages at a site changes the result. `orderable` says whether
  the renderer lets a configuration choose that order. Today every site is
  `orderable: false` and the schema records the fixed call sequence. A
  sequence law is necessary for an order control to mean anything and never
  sufficient; an order control arrives with renderer support and flips the
  flag in the same change.
- **A parameter is owned by one stage and read by many.** `owns` is where a
  parameter's control belongs (what a rack device exposes); `reads` is every
  stage whose code consumes it. Response-block fields are a third list,
  `responses`, validated against their own metadata. Dominance derivation
  uses `reads`; the rack uses `owns`.
- **Optic identity is separate from placement.** A stage names its optic,
  hook, and shader program. An optic may have several stages across programs;
  a stage with a `selector` is active only while an enum parameter picks it.
- **A placement is legal when code exists for it.** The schema describes the
  pipeline as built. Noise at the source or post site enters the schema with
  `material-cf32e5`, not before. The physics-versus-model argument becomes
  moot: a site is legal when the renderer implements it.
- **The rack's category becomes the stage's site family.** `category` leaves
  `devices.yaml`; the panel colors a card by the site family the schema gives
  its stage. "post" on saturation and noise was a second copy of the same
  stale fact.
- **A device's `requires` is derived, never written.** The rack file has no
  `requires` field. `describe` computes it from the schema's `requires` edges
  and from the niri sink's dry table, which moves from `render.js` into
  `integrations/niri/dry.yaml` so the rack loader can read it without
  importing sink code. Fringing's and Directional blur's silence under a
  bypassed Refraction is a sink policy, not a renderer fact, and the schema
  does not carry it.
- **The interaction matrix has two cell kinds, and only one is derived.**
  Structural edges (one stage makes another inert or scales it by
  construction, unconditionally) come from the schema. Perceptual dominance
  (both survive, one swamps the other) and conditional dependencies are
  measured or described, never encoded as edges.
- **Nothing is reserved speculatively.** No placements, order controls, or
  cost numbers appear in the schema before their first consumer.

## Section 1: the model

### Sites

A site is a point in the per-frame computation where a stage can act. Each
has five attributes:

| Attribute | Values | Meaning |
| --- | --- | --- |
| `carrier` | `texture`, `normal`, `linear`, `light`, `encoded` | The value that leaves the site: a per-output offscreen texture; the slab's surface normal; linear-light RGB of the transmitted backdrop; additive linear light; encoded sRGB. A site that changes carrier (the taps turn a normal into linear RGB; encoding turns linear into encoded) is named by what it produces. |
| `law` | `sequence`, `sum`, `product`, `coupled` | Whether the order of two stages at the site changes the result. `sequence`: function composition, order matters. `sum` and `product`: commutative, order is meaningless. `coupled`: the site's stages are one computation (the refraction taps); there is no notion of order among them. |
| `orderable` | `true`, `false` | Whether the renderer lets a configuration choose the order of stages at this site. `false` everywhere today: the shader calls hooks in `OPTICS` order and fixed steps where they are written. |
| `coverage` | `backdrop`, `glass`, `window` | Where the result lands. `backdrop`: the shared texture every glass window samples. `glass`: the slab's translucent pixels and the band outside the window; opaque client pixels bypass the material shader entirely. `window`: the window's area under the client, drawn by the separate background-effect element. |
| `cost` | `cached`, `fragment` | `cached`: recomputed when the backdrop is damaged and reused across frames and windows. `fragment`: evaluated per glass fragment per frame. A cost class frames measurement; it is not a measurement. |

The sites, in pipeline order:

| # | Site | Carrier | Law | Orderable | Coverage | Cost | Where in the renderer |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `source` | texture | sequence | false | backdrop | cached | `effect_buffer.rs`: sharp offscreen, Kawase blur, prefilter pyramids |
| 2 | `normal` | normal | sequence | false | glass | fragment | `main.frag` before the taps; hook `normal` |
| 3 | `taps` | linear | coupled | false | glass | fragment | `tap()` loop in `main.frag` |
| 4 | `behind` | linear | sequence | false | glass | fragment | hook `behind` |
| 5 | `attenuation` | linear | product | false | glass | fragment | Beer-Lambert in `main.frag` |
| 6 | `within` | light | sum | false | glass | fragment | ring beam and hook `within` |
| 7 | `specular` | light | sequence | false | glass | fragment | Fresnel glint and hook `specular` |
| 8 | `emissive` | light | sum | false | glass | fragment | sweeps and hook `emissive` |
| 9 | `encode` | encoded | coupled | false | glass | fragment | `linearToSrgb(transmitted + within + specular + emissive)` |
| 10 | `post` | encoded | sequence | false | glass | fragment | hook `post`, empty today |
| 11 | `background-effect` | encoded | sequence | false | window | fragment | `postprocess.frag` under the window body |

`specular` is a sequence, not a sum, because its hook signature transforms the
glint (`iridescence_specular(specular, …)` hues what it receives) rather than
adding to it. `within` and `emissive` hooks return light that is added.

### Stages

A stage is one named step at a site. Attributes:

| Attribute | Meaning |
| --- | --- |
| `id` | Stable name; prism's rack maps devices to these. |
| `site` | One of the sites above. |
| `scope` | `output` (one value per output, shared by every window), `material` (per material definition, which prism splits into focused and unfocused), `window` (per window rule). |
| `owns` | The parameters whose control belongs to this stage: `ParamSpec.node` strings (`"noise"`, `"noise type="`) and the four global `blur` fields (`"blur passes"`, `"blur offset"`, `"blur noise"`, `"blur saturation"`). Every parameter is owned by exactly one stage. |
| `reads` | Every parameter whose value this stage's code consumes, as a uniform, a CPU-side formula that feeds one, or a sampled texture selected by it. A superset of `owns`. |
| `responses` | Response-block fields the stage reads (`ring-gap`, `accent-tint`, `focus`, …), spelled as the KDL spells them. Validated against `response_fields()` (Section 2). |
| `optic` | Present when the stage is implemented by an entry of `OPTICS`: `{name, hook, program}`. `program` is `material` (`main.frag`), `effect` (the effect-buffer passes), or `postprocess` (`postprocess.frag`). |
| `selector` | Present when the stage is active only while an enum parameter selects it: `{param, variant}`. Absent today. |
| `animated` | True when the stage's uniforms change without a configuration change (`next_change` is not `None`, or the stage reads a signal or jelly state). |

Today's stages, in order. The site order of Section 1 and the call order in
`main.frag` fix this sequence; it is a record, not a choice.

| # | Stage | Site | Scope | Owns | Reads beyond owns | Responses | Optic | Animated | Device |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `blur` | source | output | `blur passes`, `blur offset` | | | | | |
| 2 | `prefilter` | source | material | `backdrop-blur`, `roughness` | `ior` (level = `roughness * clamp(ior*2-2, 0, 1)`) | | | | `backdrop` |
| 3 | `slab` | normal | material | `bevel`, `offset-x`, `offset-y`, `jelly-flex` | `thickness` (chamfer rise) | | | yes (residuals) | |
| 4 | `distortion` | normal | material | `distortion`, `distortion scale=` | | | | | `distortion` |
| 5 | `ripple` | normal | material | `jelly-ripple` | | | | yes | |
| 6 | `refraction` | taps | material | `ior`, `thickness` | `backdrop-blur`, `roughness` (which pyramid levels the taps sample) | | | | `refraction` |
| 7 | `fringing` | taps | material | `chromatic-aberration` | `ior`, `thickness`, `anisotropic-blur` (shared tap loop) | | | | `fringing` |
| 8 | `directional-blur` | taps | material | `anisotropic-blur` | `ior`, `thickness`, `chromatic-aberration` (shared tap loop) | | | | `directionalBlur` |
| 9 | `saturation` | behind | material | `saturation` | `blur saturation`, `backdrop-blur` (the inherit-or-neutral rule) | | `saturation_behind` / material | | `saturation` |
| 10 | `noise` | behind | material | `noise`, `noise type=` | `blur noise`, `backdrop-blur` (same rule) | | `noise_behind` / material | | `noise` |
| 11 | `tint` | attenuation | material | `attenuation-color`, `attenuation-distance` | `thickness` | `accent-tint`, `accent` | | | `tint` |
| 12 | `ring` | within | material | `light-ior` | `ior`, `thickness`, `roughness`, `chromatic-aberration` | `ring-gap`, `ring-width`, `ring-color`, `ring-glow`, `ring-rest`, `ring-accent`, `ring-beam-speed`, `ring-beam-noise`, `ring-beam-noise-hz`, `ring-beam-decay`, `focus`, `accent`, `attention` | | yes (signal) | |
| 13 | `aurora` | within | material | `aurora`, `aurora drift-hz`, `aurora color` | `ior`, `light-ior`, `thickness` (landing point through `lightShift`) | | `aurora_within` / material | yes | `aurora` |
| 14 | `glint` | specular | material | | `ior` | `attention`, `accent` | | yes (signal light) | |
| 15 | `iridescence` | specular | material | `iridescence` | | | `iridescence_specular` / material | | `iridescence` |
| 16 | `sweeps` | emissive | material | | | `ping`, `done`, `error` | | yes | |
| 17 | `encode` | encode | material | | | | | | |
| 18 | `effect-saturation` | background-effect | window | `blur saturation` | | | | | |
| 19 | `effect-noise` | background-effect | window | `blur noise` | | | | | |

`reads` is the direct-input map and formalizes §5 of `render-pipeline.md`
with the rows that table omitted: `ior` reaches the prefilter selection and
the ring, `thickness` reaches the ring, and aurora's landing point reads
`ior`, `light-ior`, and `thickness`. Transitive influence (everything
downstream of a changed carrier) is not recorded; it is the pipeline order
itself. The two background-effect stages own the global `blur` fields that
the behind stages inherit; a window rule's `background-effect` block
overrides them per window, which is what `window` scope records. Prism's
terminal rule pins both neutral.

A parameter with more than one reader is why a device and a stage are not
the same thing: the device `refraction` owns the `ior` and `thickness`
sliders (Refraction and Depth), and `reads` says where else they reach: the
slab's chamfer rise, the tint's optical distance, the ring's and aurora's
landing depth. Ownership follows the control, not the first reader in
pipeline order.

### Interactions

Structural edges between stages, each with a kind and a one-line reason that
names the mechanism. An edge is unconditional: it holds for every value of
every other parameter. A dependency that holds only under a condition is not
an edge; it is recorded in prose in the interaction document (Section 4).

| Kind | Meaning | Today's edges |
| --- | --- | --- |
| `requires` | The source stage has no visible effect while the target is inert, whatever else is set. | None today. |
| `attenuates` | The source stage's setting scales the target's visible output without zeroing it. | `refraction` attenuates `prefilter` (the prefilter level is `roughness * clamp(ior * 2 - 2, 0, 1)`, so ior 1 flattens Blur while frosted backdrop still selects the blurred source). |
| `shadows` | The source stage operates downstream of the target on the same carrier and can remove what the target produced. | None today. Enters with film-site saturation (a `material-cf32e5` follow-up), which would grey tint and ring light alike. |

Neither Fringing nor Directional blur is a `requires` edge, and the first
draft of this design was wrong to list the second. At ior 1 fringing's green
and blue channels still refract (their indices are `ior * (1 + spread)`), and
because those channels are also displaced by the depth jitter, directional
blur still smears them whenever chromatic aberration is above zero. The
renderer silences neither. Prism's niri sink silences both, by zeroing
`chromatic-aberration` and `anisotropic-blur` in Refraction's dry entry so
that "bypass Refraction" means no refraction at all. That is a sink policy,
and Section 3 derives the rack's `requires` from the dry table for it rather
than asking the schema to carry a fact that is not the renderer's.

Two facts the matrix makes checkable rather than argued. First, with
saturation at `behind` (before `attenuation`), saturation 0 does not remove
the tint's hue: Beer-Lambert multiplies afterwards, so a grey backdrop still
tints. The first proposal for this design claimed the opposite from memory of
the older order. Second, the whole-window case is not an edge: an opaque
client pixel bypasses every `glass`-coverage stage at once, which is a
property of coverage, and the rack says it once rather than per device.

### What is derivable and what is measured

From the schema alone: the fixed sequence at every site; which sites could
carry an order control once the renderer offers one (`behind` is the only
sequence site with two stages today, and `orderable` is false there); which
placements exist (the stages an optic has); where a scope change happens when
a device moves (a stage with `output` scope has one value, so no focus
split); what a placement covers; its cost class; and the structural edges.
The space a dice button or a sweep may explore today is parameter ranges
minus what scope forbids; placements and orders join it as the renderer adds
selectors and flips `orderable`.

Not from the schema: whether two surviving effects read as one swamping the
other, how much a placement costs on a given backdrop, which regions of the
legal space look good, and under what conditions a conditional dependency
bites. Those are capture results and belong in evidence documents under
niri-material's `docs/materials/`, never in the schema file.

## Section 2: the renderer side (niri-material)

### Tables

`niri-config/src/material/pipeline.rs` holds the data as plain statics:

```rust
pub struct Site { pub id: &'static str, pub carrier: Carrier, pub law: Law,
                  pub orderable: bool, pub coverage: Coverage, pub cost: Cost }
pub struct OpticRef { pub name: &'static str, pub hook: &'static str,
                      pub program: Program }
pub struct Selector { pub param: &'static str, pub variant: &'static str }
pub struct Stage { pub id: &'static str, pub site: &'static str, pub scope: Scope,
                   pub owns: &'static [&'static str], pub reads: &'static [&'static str],
                   pub responses: &'static [&'static str], pub optic: Option<OpticRef>,
                   pub selector: Option<Selector>, pub animated: bool }
pub struct Interaction { pub kind: Kind, pub from: &'static str, pub on: &'static str,
                         pub why: &'static str }
pub static SITES: &[Site] = &[ /* Section 1, in order */ ];
pub static STAGES: &[Stage] = &[ /* Section 1, in order */ ];
pub static INTERACTIONS: &[Interaction] = &[ /* Section 1 */ ];
```

The enums serialize as the lowercase strings of Section 1. Beside
`all_params()`, niri-config gains `response_fields() -> &[&str]`, the KDL
names of every `Response` field, kept next to the struct so a new field is
added in one place and the test below notices when it is not.

### Tests that pin the tables to the code

In niri-config:

- Ownership: the union of every stage's `owns` equals the set of
  `all_params()` nodes plus the four global `blur` fields, with no node owned
  twice. Every `reads` entry is in that same set and includes the stage's own
  `owns`. Every `responses` entry is in `response_fields()`.
- Every stage's `site` names an entry of `SITES`; stages are grouped by site
  in site order (no stage of site 4 appears after a stage of site 5).
- Every optic in `ORDER` has at least one stage whose `optic.name` is it; no
  two stages share an `(optic.name, optic.hook)` pair. Within each
  `(program, site)`, optic stages appear in `ORDER` relative to one another;
  across sites, site order governs, and `ORDER` says nothing. An optic with
  stages at several sites (noise after Section 5: source, behind, post) is
  therefore legal with one registry name.
- A `selector` names an `Enum` `ParamSpec` and one of its variants; every
  variant of a selector parameter selects exactly one stage, and all those
  stages belong to one optic. A stage with a selector has it listed in
  `owns` or `reads`.
- Every interaction names two stages; an `attenuates` or `requires` edge's
  source and target are distinct.

In niri (the renderer crate), beside the existing `OPTICS`-matches-`ORDER`
test:

- For every stage whose `optic.program` is `material`, `main.frag` contains a
  call to `<name>_<hook>(`, and those calls appear in stage order (which is
  site order, then `ORDER` within a site). For
  `effect` and `postprocess`, the named shader source for that program
  contains the call. The "one call per used hook" rule in `adding-an-optic.md`
  becomes checked, per program.
- The `post` site has no stage and `main.frag` has no `_post(` call, or both
  exist. The empty reserved site stays visibly empty.
- `reads` for optic stages is checked against the optic's `UNIFORMS`: every
  uniform named `mat_<param>` or listed in a small uniform-to-node table
  (`mat_scatter` is `roughness` and `ior`) must correspond to a `reads`
  entry. Core stages in `main.frag` have no such pin; their `reads` are
  hand-maintained and reviewed together with `render-pipeline.md`, and the
  design says so rather than pretending a test covers them.

### The generated file

`material_pipeline_schema_matches_the_file` renders `SITES`, `STAGES`, and
`INTERACTIONS` to JSON with `serde_json` (already a workspace dependency) and
compares with `resources/materials/pipeline.json`; `MATERIAL_DOCS_UPDATE=1`
rewrites it. The file carries `"version": 1` and the tables verbatim; absent
optional fields are omitted, not null:

```json
{
  "version": 1,
  "sites": [{"id": "source", "carrier": "texture", "law": "sequence",
             "orderable": false, "coverage": "backdrop", "cost": "cached"}, …],
  "stages": [{"id": "noise", "site": "behind", "scope": "material",
              "owns": ["noise", "noise type="],
              "reads": ["noise", "noise type=", "blur noise", "backdrop-blur"],
              "responses": [],
              "optic": {"name": "noise", "hook": "behind", "program": "material"},
              "animated": false}, …],
  "interactions": [{"kind": "attenuates", "from": "refraction", "on": "prefilter",
                    "why": "…"}]
}
```

`version` increments only when a field changes meaning or disappears; adding
a site, stage, parameter, selector, or interaction is not a version change.
A prism built against version 1 reads any later version-1 file.

`render-pipeline.md` gains one paragraph pointing at the file and the tables;
`adding-an-optic.md` gains a step: add the optic's stage, its `reads`, and
any interaction to `pipeline.rs`, then regenerate. Both document an existing
contract.

### Extension rule

A stage enters the schema in the same change as its code. An optic with more
than one implemented hook has one stage per hook, each naming the same
`optic.name` with its own `hook` and `program`. When an enum parameter picks
which of those stages runs, each such stage carries a `selector`, and the
parameter is listed in every one of them. Section 5 spells this out for noise.

## Section 3: the prism side

### The vendored copy and its contract test

`defs/rack/pipeline.json` is a byte copy of niri-material's generated file. It
sits beside `devices.yaml`, one directory below the defs scan, for the same
reason the rack does. Two checks, with different timing:

- **At load.** `loadRack` reads the vendored file and fails on a version
  other than 1 or a shape that departs from Section 2 (a missing field, an
  unknown enum value, a stage naming an unknown site). This runs in `prism
  describe` and therefore in the panel.
- **In the suite.** `test/pipeline-contract.test.js` resolves the
  niri-material checkout from `NIRI_MATERIAL_DIR` or, when that is unset,
  from the tasks registry entry for `material`. When one resolves, the
  vendored bytes must equal `resources/materials/pipeline.json` there; when
  neither does, that subtest is skipped with the reason printed. Freshness
  against the renderer is test-time only; `describe` cannot know what the
  installed renderer was built from, and this design does not pretend
  otherwise.

The copy is refreshed by hand (`cp`) when niri-material regenerates; the
failing test says which direction to copy.

### The rack file against the schema

`devices.yaml` changes shape:

```yaml
group: Focus
shared: [slab, ripple, ring]
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
```

`category` and `requires` are gone; `stage` is new and required; the
top-level `shared` list names stages prism exposes outside the rack: the
slab frame, pane motion, and ripple in the Glass section, the ring in its own.
`loadRack(dir, defs)` reads the vendored schema and the sink's dry file
itself, and `validateRack(rack, defs, schema, dry)` adds these rules to the
existing ones:

- `stage` names a stage in the schema. Two devices never name one stage.
- Devices appear in schema stage order. The rack has no order of its own.
- A `requires` key on a device is an error: it is derived (below).
- Every stage whose `owns` include a node some prism parameter writes has a
  device or is listed in the top-level `shared` list. The list exists so the
  omission is a decision in the file, not an accident.
- Every key a device lists (`mix`, `rows`, `shared`, both states) that binds
  to a native node is owned by the device's stage. A key with no node
  (`glass.tintSource`, `glass.bypass.*`) is exempt.

The last two rules need the prism-key-to-native-node map, which exists today
only inside `integrations/niri/render.js`. Each `binds` entry in
`integrations/niri/manifest.yaml` gains `node: <ParamSpec.node>` for keys
that write a material parameter (`{param: glass.roughness, node: roughness,
liveness: reload}`); keys with no native node carry none. A test in
`test/niri-render.test.js` checks every `node` against the schema's owned
set, and `validateRack` reads the manifest for the map. This makes a fact the
sink already relies on explicit; it does not change what the sink writes.

### The dry file

`DRY` in `render.js` moves verbatim to `integrations/niri/dry.yaml`, keyed by
bypass parameter as today, with the same entries. `render.js` loads it; the
dry-table-to-rack cross-check in `test/niri-render.test.js` is unchanged; the
golden output is unchanged.

### Derived `requires` and resolved interactions

`describe` computes, per device:

- `requires`: device B, when the schema has a `requires` edge from A's stage
  to B's stage, or when B's dry entry writes a native field whose node is
  owned by A's stage (Refraction's entry zeroes `chromatic-aberration` and
  `anisotropic-blur`, the mixes of Fringing and Directional blur). At most one
  device may result; two is a load error until a consumer needs more.
- `interactions`: every schema edge whose source and target stages are both
  devices, resolved as `{kind, device, why}` on the target device, plus the
  dry-derived `requires` in the same form with `why` naming the dry entry.

The panel's silenced light reads `requires` exactly as today. An
`attenuates` entry whose named device is bypassed adds one line to the card's
existing hint row ("Blur is flattened while Refraction is bypassed"), no light
change, because the silence is partial; the 2026-09-08 spec recorded that
coupling in prose, and this makes it data the panel reads rather than knows.

### `describe --json` and the panel

Each rack device in the `describe` payload gains `site`, `scope`, `family`,
`requires`, and `interactions`; the rack's `group` and `devices` are otherwise
verbatim. The whole schema is not carried until a consumer needs more than
that (`prism-be5abe` will, for the legal placements of noise, and adds it
then).

Site families, for color: `source` (`source`), `geometry` (`normal`),
`transmission` (`taps`, `behind`, `attenuation`), `light` (`within`,
`specular`, `emissive`), `post` (`post`). `presentation.luau` replaces
`categoryColors` with `familyColors`; the three existing colors keep their
families (`source` blue, `geometry` purple, `transmission` teal), `post` keeps
orange for the day it has a device, and `light` gets a fifth color chosen in
implementation to stay distinguishable from the others at the light's 12 px
size. Saturation and noise therefore turn teal with the devices they share a
carrier with; aurora and iridescence take the light color.

## Section 4: the interaction matrix

The matrix is a table over the rack's devices plus the shared stages, one
cell per ordered pair, with a cell kind:

| Cell | Source | Content |
| --- | --- | --- |
| structural | the schema's `interactions`, and the sink's dry couplings | kind, mechanism, and the decision below |
| conditional | prose in this document | the dependency and the condition under which it holds (Directional blur has nothing to smear at ior 1 only while chromatic aberration is 0) |
| perceptual | capture evidence | the condition under which one swamps the other, with the evidence document |
| none | the schema (no edge) and no evidence | empty |

Each structural edge carries one decision, recorded in the schema's `why`
suffix as `[expose]`, `[alternative]`, or `[drop]`:

- `expose`: keep both devices and show the interaction in the rack. Today's
  edge and both dry couplings are `expose`: the couplings already render as
  the hollow light, and the `attenuates` edge renders as the hint line in
  Section 3.
- `alternative`: the dominated device is kept, and a placement or parameter
  that cooperates is preferred; the schema change that adds the alternative
  names the edge it answers.
- `drop`: the dominated device leaves the rack. None today.

Perceptual cells are owned by niri-material's capture work under
`material-0f225e`; this design defines the cell semantics so those results
have a place to land, and adds no capture task. A perceptual or conditional
finding that turns out to be unconditional (a mechanism explains it for every
setting) moves to the schema as an edge.

The matrix for today's pipeline is small: one structural edge from the
schema, two sink couplings, one conditional dependency, no perceptual cells.
It is rendered by a prism test helper from the vendored schema and the dry
file into `docs/notes/pipeline-interactions.md` under the same update-flag
pattern, with the conditional rows kept in a hand-written block the helper
preserves, so the structural part is never hand-edited.

## Section 5: how noise placement extends this

`material-cf32e5` adds two stages and one parameter. The parameter is `noise
site=`, an `Enum` with variants `backdrop`, `glass`, `film`. The stages:

| Stage | Site | Scope | Owns | Optic | Selector |
| --- | --- | --- | --- | --- | --- |
| `backdrop-grain` | source | output | | `{noise, source, effect}` | `{noise site=, backdrop}` |
| `noise` (existing) | behind | material | `noise`, `noise type=`, `noise site=` | `{noise, behind, material}` | `{noise site=, glass}` |
| `film-grain` | post | material | | `{noise, post, material}` | `{noise site=, film}` |

The existing stage keeps ownership of the three parameters; the new stages
read them. The renderer tests then require a `noise_source` call in the
effect-buffer program and a `noise_post` call after encoding in `main.frag`,
each under its program's pin. The `post` site stops being empty.

`prism-be5abe` adds `glass.noiseSite` bound to `node: "noise site="`, and
extends the rack file so a device may name a `selector` parameter instead of
a fixed `stage`: the device's stage is whichever the selector's current value
picks, and `validateRack` checks that every variant's stage is owned by the
same optic. The panel draws the card at that stage's position in site order,
says "one amount, per output" when the stage's scope is `output` (and hides
the unfocused mix cell with that reason, instead of dropping it silently),
and offers only the selector's variants as drop zones. The `shadows` edges
that film-site grain and any film-site saturation create are added with those
stages, and `describe` carries the schema's `stages` for the noise optic so
the panel knows the variants' sites.

Neither task changes Section 1's attributes or Section 2's file shape; both
use fields this document defines. If one needs more, the version bumps and
this document is revised first.

## Section 6: errors, testing, acceptance

Errors follow the project rule: fail on load, name the device, stage, or
parameter, never guess. A rack naming an unknown stage, a vendored schema of
the wrong version or shape, an authored `requires`, a device out of stage
order, or a device key owned by another stage fails `prism describe` with that
message, and the panel shows it in the contract banner it already has.

niri-material tests: the five table pins in niri-config, the three shader
pins in niri, and the generated-file freshness test, as listed in Section 2.

Prism Node tests:

- `test/pipeline-contract.test.js` as in Section 3: shape and version on
  the vendored file; byte equality with the checkout when reachable.
- `test/rack.test.js`: one case per new rule (unknown stage, duplicate stage,
  out of order, authored `requires`, `category` present, stage with owned
  bound params and no device and not in `shared`, device key owned by
  another stage), plus the shipped rack loading against the shipped defs,
  vendored schema, and dry file with `site`, `scope`, `family`, `requires`,
  and `interactions` resolved: Fringing and Directional blur require
  Refraction from the dry file; Backdrop carries the `attenuates` entry from
  Refraction.
- `test/cli.test.js`: `describe --json` carries the five resolved fields per
  device.
- `test/niri-render.test.js`: every manifest `node` is an owned parameter in
  the schema; the dry table loads from `dry.yaml` and the golden output is
  unchanged; the dry-table-to-rack cross-check is unchanged.

Lua tests in `plugin_test.lua`: cards keyed by `family`, the five family
colors distinct, the `attenuates` hint line present on Backdrop while
Refraction is bypassed and absent otherwise, existing light states unchanged
including the hollow light on Fringing and Directional blur.

Acceptance is the drift case: with the vendored schema regenerated from a
niri-material tree whose `ORDER` swaps the two behind optics, `just test` in
prism fails in the rack test naming the two devices, before any panel is
opened. Desktop acceptance of the recolored lights is a manual look, as for
the original rack.

## Out of scope

- An order control inside a site, and any reordering UI (`prism-542904` stays
  shelved until a second device can move); `orderable` stays false until the
  renderer offers one.
- Noise placement itself (`material-cf32e5`, `prism-be5abe`).
- Restructuring the dry table's semantics; it moves to a file but stays keyed
  by bypass parameter with the same entries.
- Carrying the whole schema in `describe`, cost numbers, or perceptual or
  conditional evidence in the schema file.
- Installing the schema through packaging or IPC; the vendored copy and its
  contract test are the delivery mechanism for now.
- The learned-order and parameter-structure ideas (`material-e2f01a`,
  `material-0c7eed`); they consume the schema and are scoped separately.
