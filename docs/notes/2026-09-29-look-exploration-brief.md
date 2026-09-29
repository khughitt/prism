# Look exploration and feedback capture

## Problem

Make it easy to try glass looks, record what works for a wallpaper, and eventually
explain interactions and rendering cost. This connects randomization (`prism-284a61`),
wallpaper/nudge data (`prism-3e59b5`), ratings (`prism-cafffa`), interaction hints
(`prism-b315f9`), and cost guidance (`prism-d54be4`). Recommend designing a small
capture and exploration loop first, with the two guidance ideas awaiting evidence.

## Current behaviour and evidence

At `d105d27`, `src/cli.js` writes ordinary edits to scratch. `describe` returns
resolved parameters, definitions, active look/wallpaper, and layer provenance;
`src/commands.js` has no randomization or rating verb. Definitions include numeric
ranges, steps, nonlinear slider scales, and focus pairs, but do not establish useful
random sampling distributions or measured costs.

`integrations/noctalia-plugin/panel.luau` sends intermediate drag samples and a final
write through `queue.luau`, which coalesces pending samples. Counting commands would
therefore count neither gestures nor preferences reliably. Pair storage landed in
`adeeebd`; `13f684c` made wallpaper rotation carry visible values into scratch without
saving them. A scratch difference is not necessarily a nudge for the current image.
`integrations/niri/palette.js` also reads external Noctalia color state, so resolved
Prism values alone do not fully describe the displayed look.

The cost idea reports one hardware-specific aurora power result from
`material-265eb0`; its original measurements were not inspected here. The local
Dulling [spike report](2026-09-07-glass-noise-dulling-spike-results.md) leaves
incremental cost unresolved. Neither establishes a general per-slider estimator.
The Mindful source `a476e6bcd1fd4297b70824758235d821` was unavailable through the local
CLI; the preserved task bodies and notes supply the source context for this pass.

## Constraints

Preserve the [rotation rule](../specs/2026-09-27-rotation-keeps-edits-design.md),
validation, queue ordering, and explicit persistence controls. Coordinate with
`prism-092855` on selection semantics, `prism-84d308` on keyboard randomization,
and `prism-b25061` on general undo. A roll needs a deliberate recovery rule.

Existing task records assign adaptive learning to `ops-be8b06`, interaction modeling
to `material-0c7eed`, and cost measurement to `material-31074f` under
`material-5d6b2c`. Reuse those; `prism-ed6be0` already owns the narrower slow-draw
investigation. No overlapping local capture design, research task, brief, or attached
draft spec was found. Wali's property and rating API was not inspected; the older
idea's claim that it is unregistered is superseded by the current project catalog.

## Alternatives

1. **Explicit snapshots plus bounded rolls — current lean.** Establish what a rating
   means and which parameters a roll may change. Preserve implicit capture and image
   precomputation as later increments if they are not needed for a useful first loop.
2. **Capture every completed gesture immediately.** Supplies more observations, but
   requires gesture boundaries, writer identity, transition attribution, and a clear
   distinction between a change and a positive label.
3. **Build the full adaptive pipeline first.** Adds property extraction, interaction
   models, and cost estimates before the evaluation loop has been validated. Defer
   this until the smaller loop demonstrates useful records.

## Unanswered questions

- Which parameters, ranges, and group/focus scopes make useful rolls, and how is a
  roll recovered? The design task settles the contract; the owner judges visual utility.
- What snapshot identifies what was actually evaluated, including wallpaper, look,
  palette, queued writes, automatic rotation, and failed applies? The design task
  separates requested state from applied appearance and explicit from implicit labels.
- Where should capture and image properties live, and must every CLI change count?
  The design task checks the current Prism/wali boundary and records any deferred scope.
- Which interaction hints and cost warnings are justified? Findings from the existing
  material tasks answer this; one validated interaction or reusable estimate can wake
  a bounded consumer without waiting for a complete learned model.

## Proposed decomposition

- `prism-179840` groups these previously unparented Prism ideas and the design follow-up;
  the existing cross-project adaptive goal and all source references remain intact.
- `prism-6aca8a`: design look exploration and feedback capture (P2, medium, high
  complexity, planned). Produce reviewed design and implementation artifacts with
  acceptance cases for rolls, drags, ratings after queued writes, rotation races, and
  apply failures. Completion must add finding notes to `prism-284a61`, `prism-3e59b5`,
  and `prism-cafffa` in the same commit and update this brief. They remain briefed ideas.
- `prism-b315f9`: shelved until `material-0c7eed` or a documented, validated interaction
  supplies a concrete hint and its applicability. Then unshelve and scope that consumer.
- `prism-d54be4`: shelved until `material-31074f` supplies a reusable estimate with
  hardware/workload provenance, uncertainty, and focus-state coverage. Then unshelve
  and scope the warning or range consumer. No duplicate measurement task is filed.
