# Rack appearance and deferred behavior brief

## Problem

The device rack should feel tactile and expressive while keeping effect controls easy to read. This pass covers five ideas under `prism-a03862`: analogue styling (`prism-0f73e0`), illuminated bypass indicators (`prism-10729e`), effect banners (`prism-a6edfd`), processing-order controls (`prism-542904`), and focus modulation (`prism-d2b31a`). Recommend one bounded appearance feasibility pass; defer the two changes to the parameter model until their prerequisites have evidence.

## Current behaviour and evidence

The [accepted September 9 screenshot](2026-09-09-device-chain-rack-ui.png) shows eight compact cards with flat category fills and dots. It is a visual reference, not the current layout: `defs/rack/devices.yaml` now has ten devices after iridescence and aurora landed in `033f7af`; `c10a5c1` moved Unfocused to the left.

`integrations/noctalia-plugin/panel.luau` renders a clickable glyph in `lightRow`, category fill in `deviceCard`, and an individual bypass reset inside expanded details. `presentation.luau` distinguishes active, bypassed, and upstream-silenced cards. Existing rack cases in `integrations/noctalia-plugin/plugin_test.lua` exercise these states and controls. `7638d59` limits drag rendering to once per frame, so decorative animation should not be presumed free.

`src/rack.js` validates presentation order and requires dependencies to name earlier devices. `integrations/niri/render.js` emits fixed material fields, with no configurable processing order. It reads separate focused/unfocused scalar keys; `src/resolve.js` resolves each key independently. `defs/glass.yaml` deliberately gives roughness different defaults in the two states. A single depth per device therefore needs a defined treatment for numeric, boolean, and color values, not merely a different control.

## Constraints

The [accepted rack design](../specs/2026-09-08-device-chain-rack-design.md) keeps the bus flat and excludes reordering and modulation. Its eight-device inventory is historical; current code is the evidence for today's devices. Preserve category identity, all three light states, availability, layer feedback, individual reset, and aligned focused/unfocused controls. `prism-77b856` already owns bypass-control simplification; do not duplicate it. `prism-7e4766` owns the narrower inactive-value inheritance decision. Existing sources and parentage remain intact.

`plugin.toml` declares API 22. Current shell support for gradients, shadows, image composition, and asset loading was not verified in this checkout. External renderer tasks `material-5a5fff` and `material-e2f01a` are references from the ideas, not verified evidence that modulation or ordering is available. No existing appearance brief, attached draft design, or overlapping open appearance research task was found locally.

## Alternatives

1. **Static treatment using supported primitives — current lean.** Assess subtle card styling and softer lights; trial a restrained banner only if supported and legible. Keep present controls and semantics.
2. **Asset-led treatment.** Use a small family of static effect images if native styling is insufficient. First prove loading, scaling, contrast, and the space cost on representative cards; defer a complete asset set.
3. **Animated or custom controls.** Pursue only if static samples fail the desired visual direction and a measured capability gap justifies shell work. Knobs remain the separate `prism-686374` idea.

## Unanswered questions

- Which static styling and image primitives work at a supported plugin API, and with what loading constraints? The feasibility task answers from current API evidence and a bounded sample.
- How much texture or artwork improves the rack without obscuring controls? The owner judges a small visual comparison after feasibility; no taste approval is inferred from the old screenshot.
- Can processing order be represented and executed end to end? A verified renderer contract and persisted Prism representation wake `prism-542904`; rearranging cards alone does not satisfy it.
- Is per-device focus depth preferable to retaining independent values? Findings from `prism-7e4766`, or a concrete modulation requirement, wake `prism-d2b31a` for a separate design decision.

## Proposed decomposition

- `prism-569378`: determine feasible static styling for cards, lights, and banners (priority 3, medium size, mid complexity, direct investigation). Compare at most two static treatments on representative cards, record capability limits and a recommendation, and prepare owner visual review where feasible. On completion, add finding notes to `prism-0f73e0`, `prism-10729e`, and `prism-a6edfd` in the same commit. These three remain briefed ideas.
- `prism-542904`: shelved until a supported renderer order contract can be persisted and emitted by Prism.
- `prism-d2b31a`: shelved until the inheritance decision or a concrete modulation requirement supplies the missing design context.

Reuse parent `prism-a03862`. No additional goal, implementation task, or design task is needed before the feasibility finding and visual direction are known.
