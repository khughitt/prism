---
id: prism-eef38f
title: "Pipeline schema: the renderer's sites, scope, composition law, and coverage as data"
status: done
priority: 2
size: m
complexity: high
process: planned
owner: prism-eef38f
created: 2026-10-05T01:45:24Z
updated: 2026-10-05T12:04:20Z
started: 2026-10-05T01:51:28Z
completed: 2026-10-05T12:04:20Z
depends: []
parent: prism-a03862
tags: [material, bus, cross-project]
model: claude-opus-5-5
agent: claude-code/claude-fable-5-1
spec: docs/specs/2026-10-04-pipeline-schema-design.md
plan: docs/plans/2026-10-05-pipeline-schema.md
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
- 2026-10-05T02:37:20Z (prism-eef38f): Spec revised for review round 1: all six Important findings and the three contradictions addressed (orderable flag separate from law; directional-blur edge removed as conditional under aberration; response_fields() metadata; owns/reads/responses per stage with the missing ior/thickness/light-ior reads; optic {name,hook,program} + selector in the JSON shape; describe carries requires and interactions; requires derived not authored; carriers within the enum; load-time shape check vs test-time freshness)
- 2026-10-05T02:37:20Z (prism-eef38f): parked (waiting on user, review): Re-review docs/specs/2026-10-04-pipeline-schema-design.md (in .worktrees/prism-eef38f), revision after round 1; on acceptance run writing-plans
  provenance: {"harness_session":"claude-code:23285ff0-fcf8-4e52-93eb-5ccb34db3e4c","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-05T02:50:43Z (prism-eef38f): review: spec round 2 — verdict: revise; findings: Important 2; reviewer: codex
- 2026-10-05T02:51:01Z (prism-eef38f): Round 2 details: (1) current rack cannot satisfy the new ownership rule: spec line 162 assigns thickness to slab, line 165 leaves refraction owning only ior, while the shipped Refraction card includes Depth (glass.thickness and glass.inactive.thickness); lines 411-413 reject that card. Prefer assigning thickness ownership to refraction and retaining it in slab reads, preserving current controls. Also include ripple in the top-level shared-stage inventory: glass.jellyRipple is exposed outside the rack. (2) lines 282-284 still pin ORDER across an entire program. Section 5 makes the material optic sequence saturation, noise, aurora, iridescence, noise; unique-name ORDER cannot place noise on both sides. Pin registry order within each (program, site), retaining stage-order checks across sites. Other original findings are resolved; no further design expansion requested. Revise these two points before writing-plans.
- 2026-10-05T02:52:51Z (prism-eef38f): resumed
  provenance: {"harness_session":"claude-code:23285ff0-fcf8-4e52-93eb-5ccb34db3e4c","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-05T02:53:25Z (prism-eef38f): Spec revised for review round 2: thickness ownership moved to refraction with slab reading it; ripple added to the shared-stage list; ORDER checked within each (program, site) so one optic may sit at several sites
- 2026-10-05T02:53:25Z (prism-eef38f): parked (waiting on user, review): Re-review docs/specs/2026-10-04-pipeline-schema-design.md (in .worktrees/prism-eef38f) after round 2 corrections; on acceptance run writing-plans
  provenance: {"harness_session":"claude-code:23285ff0-fcf8-4e52-93eb-5ccb34db3e4c","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-05T09:08:20Z (prism-eef38f): review: spec round 3 — verdict: accept; findings: none; reviewer: codex
- 2026-10-05T09:08:20Z (prism-eef38f): Round 3 scoped re-review of b15978b: both remaining Important findings resolved. Thickness ownership now matches the existing Refraction/Depth controls while slab retains its read; shared includes ripple. Registry pins apply within (program, site), with cross-site call order governed by site order, so the documented multi-site noise extension no longer conflicts with ORDER. Spec accepted for writing-plans; the implementation plan remains subject to its separate review. Controller completed this re-review directly after the delegated renderer reviewer could not run due to model capacity.
- 2026-10-05T09:25:18Z (prism-eef38f): resumed
  provenance: {"harness_session":"claude-code:23285ff0-fcf8-4e52-93eb-5ccb34db3e4c","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-05T09:45:27Z (prism-eef38f): parked (waiting on user, review): Review docs/plans/2026-10-05-pipeline-schema.md (prism, .worktrees/prism-eef38f) and niri-material docs/plans/2026-10-05-pipeline-schema.md (.worktrees/material-a00785 there); on acceptance choose the execution method (recommended: native, this session implements with one whole-branch review at the end), then execute the niri-material plan first and the prism plan from its Task 1
  provenance: {"harness_session":"claude-code:23285ff0-fcf8-4e52-93eb-5ccb34db3e4c","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-05T10:00:34Z (prism-eef38f): review: plan round 1 — verdict: revise; findings: Important 3; reviewer: codex
- 2026-10-05T10:01:06Z (prism-eef38f): Plan review details: (1) lines 1041-1046 resolve every schema edge on edge.from. For attenuates/shadows the affected card is edge.on; current refraction -> prefilter attaches the hint to Refraction referencing Backdrop, reversing the spec and tests. Keep requires dependency semantics separate. (2) synthetic SCHEMA sites alpha/beta at 682-689 are rejected by familyOf (911-914), so happy-path and later validation tests never reach their intended gates. Read-only execution of the proposed snippets reproduced site alpha has no family; after using supported sites it reproduced reversed attenuation. The two-source error at 1060 also omits device while test820 requires it. Correct fixtures/messages and check each expected failure reaches its intended rule. (3) Task4 removes category and returns family before Task5 updates presentation.luau, yet Step6 promises just test-fast passes. Existing integrations/noctalia-plugin/contract.test.mjs exercises real describe through the old panel, whose category validation fails. Land the breaking producer/consumer change atomically without a compatibility layer. Recommend native execution and a fresh whole-branch review per repository after revised plans are accepted; renderer plan has three separately recorded Important findings.
- 2026-10-05T10:13:18Z (prism-eef38f): resumed
  provenance: {"harness_session":"claude-code:23285ff0-fcf8-4e52-93eb-5ccb34db3e4c","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-05T10:15:59Z (prism-eef38f): Plan revised for review round 1: interaction attach rule (requires on the dependent, attenuates on the affected), real site ids in the rack fixtures and device-prefixed two-source message, Tasks 4 and 5 merged so category leaves describe and the panel in one commit (prism-19fa40 dropped, Task 6 renumbered to 5)
- 2026-10-05T10:15:59Z (prism-eef38f): parked (waiting on user, review): Re-review docs/plans/2026-10-05-pipeline-schema.md (.worktrees/prism-eef38f) after round 1 corrections, with the niri-material plan; on acceptance execute natively, renderer plan first
  provenance: {"harness_session":"claude-code:23285ff0-fcf8-4e52-93eb-5ccb34db3e4c","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-05T10:20:57Z (prism-eef38f): review: plan round 2 — verdict: revise; findings: Important 1; reviewer: codex
- 2026-10-05T10:21:15Z (prism-eef38f): Plan round 2 details: original interaction direction, real site ids, two-source diagnostic, and atomic rack/panel changes are resolved. One negative fixture remains wrong at lines807-808: assigning Depth to device one trips ownership before visiting device two, producing invalid rack: device one: r.depth writes depth, which stage two owns, not stage one; the assertion expects row Blur already belongs to one. Reproduced by evaluating the plan snippets in memory. Remove this redundant assertion (the swapped fixture immediately below already covers ownership), or construct a separate duplicate-row fixture that passes ownership on the first device. No broader changes requested.
- 2026-10-05T10:43:10Z (prism-eef38f): resumed
  provenance: {"harness_session":"claude-code:23285ff0-fcf8-4e52-93eb-5ccb34db3e4c","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-05T10:43:11Z (prism-eef38f): Plan revised for review round 2: removed the ownership fixture's unreachable duplicate-row assertion; a separate fixture claims Blur on device three
- 2026-10-05T10:43:11Z (prism-eef38f): parked (waiting on user, review): Re-review the prism plan (.worktrees/prism-eef38f/docs/plans/2026-10-05-pipeline-schema.md) after round 2; on acceptance execute natively, renderer plan first
  provenance: {"harness_session":"claude-code:23285ff0-fcf8-4e52-93eb-5ccb34db3e4c","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-05T10:49:55Z (prism-eef38f): review: plan round 3 — verdict: accept; findings: none; reviewer: codex
- 2026-10-05T10:49:55Z (prism-eef38f): Scoped re-review of a454deb: ownership and duplicate-row fixtures now each reach their intended validation, verified by evaluating the plan snippets in memory. Prior plan findings remain resolved. Accepted for native execution after the renderer plan, with a fresh whole-branch review before integration.
- 2026-10-05T11:49:50Z (prism-eef38f): Spec correction needed before the prism plan's Task 1 vendors pipeline.json: the renderer's implementation review (material-a00785, merged in niri-material 4cdbbe90) found Section 1 rows disagree with glass_signal_inputs. As built: distortion, fringing, directional-blur and tint are animated; distortion, ripple, fringing, directional-blur and ring list responses ping/done/error (flash boosts CA, distortion and the tap count; ripple raises jelly activity, which scales the ring glow); fringing and directional-blur also read backdrop-blur and roughness (every tap samples the prefilter). The niri tables and resources/materials/pipeline.json carry the corrected rows and pin them; Section 1 should match. Pending on the renderer side: material-5b2bc5 adds accent to the sweeps row.
- 2026-10-05T12:04:03Z (prism-eef38f): review: impl round 1 — verdict: revise; findings: Important 3, Minor 5; reviewer: claude-code/claude-fable-5-1
- 2026-10-05T12:04:20Z (prism-eef38f): done
  provenance: {"harness_session":"claude-code:40c5571e-696a-479f-8e0d-8c51560d1299","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-05T12:04:20Z (prism-eef38f): rack validated against the vendored renderer pipeline schema; requires and interactions derived from schema and sink dry tables; describe carries site, scope, family, requires, interactions; panel colors by site family with an attenuates hint; interaction matrix generated in docs/notes
  provenance: {"harness_session":"claude-code:40c5571e-696a-479f-8e0d-8c51560d1299","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
