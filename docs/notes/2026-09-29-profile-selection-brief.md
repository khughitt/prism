# Profile selection after wallpaper rotation

## Problem

Explicitly choosing a look should reveal that look without unexpectedly saving
settings for the wallpaper currently showing. This briefs prism-aab172 under
the existing profile goal prism-2f0b4b. The same scoping pass reviewed state
activation, unloaded-profile management, and open-panel refresh.

## Current behaviour and evidence

At `8ccb348`, [changeSlots](../../src/context-cli.js) saves all scratch to the
outgoing look–wallpaper pair on explicit profile selection, then clears scratch.
Wallpaper rotation instead carries visible values into scratch without saving a
pair. Thus values from Aurora/W1 can be carried onto W2 and saved as Aurora/W2
when Dark is selected. The [rotation design](../specs/2026-09-27-rotation-keeps-edits-design.md)
explicitly records this consequence; it is current intended behavior, not a new defect.
The pair cutover landed in `adeeebd`.

The open panel already refreshes `describe` every two seconds (`164c5ff`,
prism-03f1ee), coalescing reads during drags and queued writes. The stale-panel
sentence in the rotation design is outdated. `just test-fast` on 2026-09-29 passed
490 Node tests and the Lua plugin checks; this pass did not run a desktop check.
Inactive rename/delete already works through the CLI; only the panel requires
loading the target. `state` appears in resolution order but `assertKind` rejects
it, and `loadLayers` only loads profile and wallpaper layers.

## Constraints

The [pairs design](../specs/2026-09-20-profile-wallpaper-pairs-design.md) requires
a selected look to load with zero pending edits and prevents edits following the
user into another look. Rotation's carry rule must remain intact. Recovery from
a broken outgoing look and deleting an active profile preserve scratch deliberately.
Keep for wallpaper and Keep in look already provide explicit persistence controls.
Preserve stale-selection checks, queued-write ordering, and validation before writes.

The [earlier profile-editing brief](2026-09-13-profile-editing-brief.md) and its
dropped design task prism-e37618 were superseded by compositional profiles; do not
revive their panel-local edited marker. No open research task covers this decision.
The existing prism-8a8e7b selector-reselection task must follow the eventual same-look
rule. No current implementation behavior is changed by this brief.

## Alternatives

1. Keep autosave: preserves adjustments and clean loads, but profile management or
   selection can silently create a pair from values carried from another wallpaper.
2. Discard on selection: the smallest store change and still a clean load, but loses
   pending work without an explicit choice.
3. Ask save/discard/cancel only when edits are pending: retains clean loads and
   intentional persistence, with an extra interaction and a CLI contract to settle.

Lean toward the third option. Carrying scratch into the selected look conflicts
with the established clean-load requirement and is not the recommended default.

## Unanswered questions

The user and design review must settle whether the extra interaction is worthwhile,
what saving targets, and whether selecting the current look should share the rule.
The design task must settle noninteractive CLI behavior, no-wallpaper selection,
queued changes, and recovery exceptions against the existing tests. No measurement
is needed to establish the autosave behavior; the unresolved issue is intended use.

State activation needs a concrete hook and adjustment mapping before designing
stacking. Unloaded-profile management needs recurring evidence that activation's
reload or autosave side effects justify another panel control. These are wake
conditions, not prerequisites for the selection design.

## Proposed decomposition

- **prism-092855**: Design explicit profile selection from this brief (P2, small,
  high complexity, planned), under prism-2f0b4b. Produce a reviewed transition table
  and acceptance cases; completion must note **prism-aab172** so it can be scoped again.
- **prism-aab172**: briefed; remains an idea until that decision is reviewed.
- **prism-9298b9**: shelved until a concrete hook state and its appearance changes
  are identified. Its existing parent remains unchanged.
- **prism-920f31**: shelved until recurring unloaded-profile management makes
  activation side effects disruptive; reuse the existing inactive CLI operations.
- **prism-b6d7ee**: proposed drop as covered by `164c5ff` and prism-03f1ee;
  remains an idea pending that disposition. No replacement implementation task.
