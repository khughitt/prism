---
id: prism-eef38f
title: "Pipeline schema: the renderer's sites, scope, composition law, and coverage as data"
status: doing
priority: 2
size: m
complexity: high
process: planned
owner: prism-eef38f
created: 2026-10-05T01:45:24Z
updated: 2026-10-05T02:31:33Z
started: 2026-10-05T01:51:28Z
depends: []
parent: prism-a03862
tags: [material, bus, cross-project]
agent: claude-code/claude-fable-5-1
spec: docs/specs/2026-10-04-pipeline-schema-design.md
---

Design task for goal prism-a03862, spanning prism and niri-material. Make the material pipeline's structure explicit as renderer-owned data, so the rack, the niri sink, and later exploration are derived from it instead of restating it by hand.

## Why now

The rack already drifted: niri-material moved saturation and noise to the behind hook on 2026-09-18 (its docs/specs/2026-09-12-material-render-order-design.md), nine days after defs/rack/devices.yaml was written, so the rack shows them last while main.frag runs them before tint. The first reorderable device (noise before frost) needs a contract for what "order" means in a pipeline that has no list to permute: stages are bound to hook sites, and blur is a source selection, not a pass.

## The model the spec must settle

A short ordered list of sites, each with four attributes:

- carrier: the value type flowing through it. Per-output texture (source), surface normal (normal), linear RGB per fragment (behind), additive light (within, specular, emissive), encoded sRGB (post/film).
- scope: where a parameter at that site can vary. Per output (source textures are shared by every window), per material (uniforms, so per focus state), per frame (animated).
- composition law: how two devices at one site combine, and whether it commutes. Additive light commutes (ring vs aurora order is meaningless); function composition on RGB does not (saturation then noise differs from noise then saturation); attenuation commutes with itself.
- coverage: what the result lands on. Everything in the material shader is glass only (opaque client pixels bypass it); the background-effect element covers the window area.

Each optic declares, per site it can be written for, its signature on that carrier and the parameters it takes. Noise: texture, linear RGB, encoded RGB. Saturation: linear, encoded. Distortion: normal only. Refraction consumes the normal and yields RGB, so it is the boundary between sites, not a device inside one.

Consequences that become lookups: order is a parameter exactly at non-commutative sites; a device at a per-output site has no focus split and its card must say so rather than drop a slider; film grain covers glass only; legal drop zones are the carriers an optic has code for; cost class per site (source work cached per backdrop damage, fragment work per frame) frames measurement without replacing it. The explorable space is placements x orders at non-commutative sites x parameter ranges, minus what scope forbids: the legal space for the dice button, profiles, and the adaptive lane (material-e2f01a).

## Dominance and synergy (owner's question, 2026-10-04)

The spec also records which transformations dominate others under the schema: pairs where one setting makes another invisible or inert (heavy roughness erasing source-site grain; refraction bypass silencing fringing and directional blur; saturation 0 removing tint hue; opaque windows hiding every fragment-site effect). Represent it as an interaction matrix over devices and sites, derived where the schema allows and measured where it does not. For each dominating transformation decide: keep and expose the interaction in the rack (an upstream-silenced style light), prefer a cooperative alternative, or drop the dominated device.

## Where it lives

The renderer owns the truth: a checked-in schema file in niri-material with a test pinning it to the OPTICS registry (src/render_helpers/material/optics/mod.rs) and the hook calls in main.frag, after the dry-table cross-check pattern. Prism's loadRack validates devices.yaml against it; the rack file keeps only presentation (labels, categories, mix rows). First slice is the schema for today's pipeline with no behaviour change; its rack test fails on the stale order and the fix lands with it.

## Deliverables

Spec under docs/specs/, reviewed; then a plan whose steps become children here and in niri-material (schema + test; prism validation + stale-order fix; contract test between the two). The noise placement tasks depend on this design.

Related: prism-542904 (shelved reorder; this is its contract), material-e2f01a (shelved learnable order), material-3aa1f2 (layers lane), prism-569378 (rack appearance; independent).

## Notes

- 2026-10-05T01:51:28Z (main): started
  provenance: {"harness_session":"claude-code:23285ff0-fcf8-4e52-93eb-5ccb34db3e4c","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-05T01:51:29Z (prism-eef38f): resumed
  provenance: {"harness_session":"claude-code:23285ff0-fcf8-4e52-93eb-5ccb34db3e4c","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-05T01:58:28Z (prism-eef38f): parked (waiting on user, review): Review docs/specs/2026-10-04-pipeline-schema-design.md (in .worktrees/prism-eef38f); on acceptance, writing-plans produces the implementation plan with niri-material and prism steps
  provenance: {"harness_session":"claude-code:23285ff0-fcf8-4e52-93eb-5ccb34db3e4c","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-05T02:21:43Z (prism-eef38f): review: spec round 1 — verdict: revise; findings: Important 6; reviewer: codex
- 2026-10-05T02:22:13Z (prism-eef38f): Spec review details: (1) lines 57-60/196-202 confuse sequence law with implemented order capability; describe current fixed order and defer selectable orders until renderer support exists. (2) line 174 directional-blur requires refraction is false at ior=1 with chromatic aberration: jittered thickness still displaces G/B; keep the combined bypass dependency in sink policy or state the condition. (3) lines 147/236-238 cannot validate ring-* via all_params(), which excludes Response fields; choose explicit response metadata or a narrower parameter contract. (4) lines 137-165 omit direct dependencies: ior affects prefilter/ring; thickness affects ring; ior/light-ior/thickness affect aurora. Define params ownership versus direct/transitive influence and complete the chosen map. (5) lines 241-252/288-293/434-454 conflict: one stage per optic and main.frag-only pins cannot cover multiple hooks/programs; selector variant-to-stage metadata has no field in the proposed JSON. (6) lines 375-395 omit attenuates from describe despite requiring a data-driven panel hint; specify minimal resolved interactions. Also reconcile derived-never-written requires with YAML/validation at 339/348-353, invalid carrier values in the site table, and test-only freshness versus describe-time freshness claims. Recommendation: revise spec before writing-plans; renderer-owned data and stage-level scope remain sound.
- 2026-10-05T02:31:33Z (prism-eef38f): resumed
  provenance: {"harness_session":"claude-code:23285ff0-fcf8-4e52-93eb-5ccb34db3e4c","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
