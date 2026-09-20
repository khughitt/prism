# Profile editing and reset brief

## Problem

Make it clear what editing a loaded profile changes, manage another profile without
loading its look, and make reset's destination understandable. This pass covers
prism-b8b589, prism-920f31, prism-ad2b12, prism-8a8eac, and prism-49a068; the last two
already defer their New/default presentation decisions until reset and autosave settle.

## Current behaviour and evidence

At `6941146`, [writeTarget](../../src/layers.js) routes edits to the loaded profile,
else a pinned wallpaper, else base. Profiles save a full effective snapshot, then
capture edits directly. [panel.luau](../../integrations/noctalia-plugin/panel.luau)
has no edited marker; optimistic profile selection can precede queued write completion.

[context-cli.js](../../src/context-cli.js) already renames/deletes inactive profiles
without activation or sink fan-out; [context-cli.test.js](../../test/context-cli.test.js)
covers both. The panel alone restricts their target to the loaded name. Its shared
name/question row and native selector are established controls. Commit `4ccdf11`
provided the focused name field, submit button, and fresh slot per naming mode.

[reset.js](../../src/reset.js) removes target overrides for `defaults` and writes
neutral values for `neutral`; these are different operations. Commit `5a49248`
clears the profile before panel-wide neutralization; section neutral still edits it.
The [plugin contract](noctalia-plugin-contract.md) explains why `-` is not a base-only
view: an unpinned wallpaper can still shadow base. Both cited commits are ancestors.

## Constraints

Preserve the [context-layer contract](../specs/2026-09-05-prism-context-layers-design.md)
and [reset modes](../specs/2026-09-10-reset-modes-design.md) until a replacement design
is reviewed. Keep deletion confirmation and explicit rename collision errors.
prism-bf3ae9 already owns the reset decision; prism-46035b owns autosave and its
todo child prism-e08ee6 is context only. No existing brief, attached draft, or open
research duplicates this handoff; all open records were checked, including related
ideas outside the batch. Existing parents, sources, and capture prose are retained.

## Alternatives

Prefer a panel-local, once-set edited-since-load marker and a target picker in the
existing management row. This keeps current persistence and reuses the inactive
rename/delete API. A snapshot comparison could clear the marker on return to the
loaded values; explicit save would change the persistence contract much more broadly.
Neither is justified by the current capture alone.

For reset, lean toward keeping row remove-override and separating it from bulk neutral.
A neutral-only button at every level loses layer inheritance; equating defaults with
neutrals also changes the shipped appearance. Settle that choice in prism-bf3ae9.

## Unanswered questions

The profile-control design must settle marker lifetime across reopen, rename, failed
writes, and rapid queued profile switches, plus the management target's presentation.
The reset decision must retain a deliberate way to remove an override. Autosave must
establish when base remains reachable before New's starting values or default naming
are chosen. The two deferred ideas retain their 2026-11-10 review date in prose.

The capture source `mindful:thought:1e2513d2f5ea48609022559f3c687d01` is unavailable:
after verifying CLI help, `mindful --json show` returned “no thought matching”. The
user or a recovered source can establish any missing intent; no preference was inferred.

## Proposed decomposition

Goal prism-3415ef holds previously unparented prism-ad2b12 and the two shelved ideas;
prism-b8b589/prism-920f31 retain prism-2f0b4b. New design task prism-e37618 frames the
two profile controls and must note both waiting ideas with its findings when complete.
Reuse prism-bf3ae9 for reset; its result should note prism-ad2b12 and update this brief.
No research task is needed for behavior already established in code and tests.

Verdicts: prism-b8b589, prism-920f31, and prism-ad2b12 are **briefed**, still ideas.
prism-8a8eac and prism-49a068 are **shelved** until reset and autosave settle; then
unshelve and reconsider their recorded review. No implementation was committed by scoping.

## Outcome (2026-09-19)

The [compositional profiles design](../specs/2026-09-19-compositional-profiles-design.md)
answers this brief by changing the store rather than the controls: edits land in a
scratch layer, the edited count is derived from describe's `held`, the panel-wide
neutral no longer clears the profile, save-as is New, and a profile is never emptied
by a reset. Managing an unloaded profile from the panel stays an idea (prism-920f31);
loading one first now costs a compositor reload and no lost work.
