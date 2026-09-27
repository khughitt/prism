# Profile loading and wallpaper-specific tweaks

**Date:** 2026-09-20
**Status:** implemented in the worktree with outgoing-pair auto-save; all five [implementation steps](../plans/2026-09-20-profile-wallpaper-pairs.md) passed scoped review. Whole-branch review and its scoped fix review passed; desktop acceptance remains pending. The Rotate and First wallpaper activation rows are amended by [rotation keeps edits](2026-09-27-rotation-keeps-edits-design.md): rotation no longer saves the outgoing pair.
**Parent:** `prism-aec90f`
**Amends:** [compositional profiles](2026-09-19-compositional-profiles-design.md), particularly Sections 2, 3, 6, 7 and 9.

## Intent and acceptance feedback

Loading a profile should show that profile plus adjustments previously saved for
that profile and wallpaper, with **0 pending edits**. Adjustments made under one
profile must not follow the user into another profile. Default is a look with the
same rules as a named profile.

The separate report of an incorrect count until closing and reopening the panel
is a UI defect. Fixing it does not approve or implement this model change.

## Proposed behavior

The fold remains defaults, base, loaded profile, wallpaper adjustment, reserved
state, scratch. The wallpaper adjustment is now selected by **both the look and
the wallpaper**, rather than the wallpaper alone. Scratch still contains pending
edits, normalized against the complete fold beneath it.

| Action | Outgoing edits | Incoming appearance | Pending count |
|---|---|---|---|
| Select a profile or Default with a wallpaper active | Save to the outgoing look–wallpaper pair | Selected look plus its saved adjustments for the current wallpaper | 0 |
| Rotate the wallpaper | Save to the outgoing look–wallpaper pair | Same look plus its saved adjustments for the incoming wallpaper | 0 |
| Select the already loaded look | Save to the current pair | Same appearance | 0 |
| Select a look with no wallpaper active | Discard pending edits | Selected look | 0 |
| First wallpaper activation, with no wallpaper leaving | Keep pending edits, as today | Current look plus the incoming pair and scratch | Unchanged |
| Select a valid look to recover from a missing/broken outgoing named profile | Preserve pending edits when the outgoing look/pair cannot be read or validated | Selected look plus its current wallpaper pair and preserved scratch | Unchanged |
| Delete the active profile | Preserve pending edits; remove the profile and all its pairs | Default plus its current wallpaper pair and preserved scratch | Unchanged |

Saving to the outgoing pair is the recommendation: it preserves work without
carrying it into another profile. Discarding every outgoing edit would also give
zero on load, but would lose adjustments that the user may want when returning.
With no wallpaper there is no pair to receive them; explicit selection discards
pending edits rather than silently changing the saved profile. Recovery from a
missing/broken named profile and deletion of the active profile are the explicit
scratch-preserving exceptions below.

For example: under Aurora and image W, edit roughness. Select Dark: Dark plus
Dark/W loads, with zero pending edits. Select Aurora again: Aurora/W restores the
roughness adjustment, still with zero pending edits. Aurora's saved settings have
not been overwritten.

## Counts and controls

- The edits row keeps its existing visible-control scope and counts pending
  scratch keys only. Transitions still save every scratch key, including CLI-only
  keys. A saved profile's difference
  from Default is never an edit. Saved pair adjustments are not pending edits.
- The wallpaper header counts saved visible adjustment keys for the active pair. It must
  identify that these belong to this look and wallpaper.
- Revert removes pending edits and reveals the saved pair and profile. Clear
  wallpaper tuning removes only the active pair, exposing the saved profile.
- Keep for wallpaper saves scratch to the active pair. Keep in look commits to
  the loaded profile or Default and removes those keys from the active pair so
  the visible result does not change. Other pairs are untouched.
- Neutral and symmetric still write scratch; they do not overwrite a saved look.
- Save As still snapshots the visible appearance into the destination profile,
  clears scratch, and loads it without changing the screen. Its current-wallpaper
  pair must not override that snapshot; other destination pairs are preserved.

## Persistence and lifecycle requirements

A saved pair comprises a look identity (Default or a named profile), wallpaper
id/source path, and a sparse absolute parameter map. A missing pair means no
adjustments. There is no fallback to another look's pair, no new layer rank, and
no relative-value arithmetic.

The implementation plan must choose the smallest file layout that satisfies the
existing locking, validation, and interruption guarantees. In particular, it must
account for these operations before any implementation starts:

- Profile rename carries its pair adjustments with it; deleting a profile removes
  its pairs. Deleting the active profile selects Default and preserves pending
  scratch; it is distinct from ordinary explicit selection. Renaming does not
  change the visible appearance.
- Normal switching validates the incoming look and pair and the outgoing fold
  before its first write. A malformed incoming pair leaves the old selection and
  edits untouched. Retry after interruption must neither lose nor misattribute edits.
- Explicit profile selection can recover from a missing, unreadable, or malformed
  active named profile or its outgoing pair by selecting a valid named look or
  Default; `context deactivate profile` remains doctor's recovery command. If that
  outgoing look cannot safely receive edits, preserve scratch and save no outgoing
  pair. Validate runtime, base, scratch, and incoming look/pair before any write;
  do not hide failures in those inputs. When the previous appearance is unavailable,
  retain the existing fan-out of every bound key. The pre-write source may remain
  unresolvable; the atomic selection write completes recovery with the valid
  incoming look plus preserved scratch. Retry before that write, and use
  `prism apply` after it if interrupted before bus/sink application. Repeating the selection command
  after completed recovery is a new action with ordinary save/discard semantics.
- Wallpaper hooks, CLI activation/deactivation and panel selection use the same
  transition. The panel never writes wallpaper observations into the store.
- Pair mutations from a stale panel must name and verify both the expected look
  and wallpaper, so a queued click cannot commit to or clear another pair.
- List, show, doctor, parameter migration and backup/restore cover every pair,
  including those for inactive looks. Ordinary display reads remain read-only.

Existing wallpaper deltas have no recorded profile ownership. The proposed
one-time, explicit migration backs them up and copies their values to Default
and each existing profile's pair. This preserves their prior effect without
inventing historical attribution; subsequent pair edits are independent, and
new profiles start without inherited pairs. No shared-delta compatibility layer
remains. The migration report names the copies it creates. Each modifying attempt
backs up all changed/removed originals before mutation, retains earlier backups, writes
all look destinations and runtime before deleting old sources, and reruns from
current files. Equal existing copies are safe; conflicting hand edits are refused
and preserved rather than overwritten.

## Acceptance

1. Select two profiles that differ on many sliders with empty scratch. The edits
   count stays zero, including immediately after selection and while open.
2. Edit two values under Aurora/W, then select Dark. Dark/W loads with zero
   pending edits and receives neither adjustment. Return to Aurora: both saved
   adjustments return, with zero pending edits and two wallpaper adjustments.
3. Tune Aurora/W and Dark/W differently; rotating away and back restores each
   pair independently. Profile selection and wallpaper rotation commute when
   there are no pending edits.
4. Keep in look updates the selected saved look without a visible jump or changes
   to another pair. Clear wallpaper tuning affects only the active pair.
5. Revert restores the saved profile-plus-pair appearance; Neutral then Revert
   leaves the saved profile and pair unchanged.
6. Rename a profile and verify its pair adjustments follow it. Reject a malformed
   incoming pair before writing. Inject interruption at transition write points
   and verify retry preserves the outgoing edits and incoming selection. Exercise
   doctor's missing/broken-profile remedy with nonempty scratch, including its
   completed-runtime-write boundary and `prism apply` recovery.

The original acceptance item requiring scratch to survive a profile switch is
superseded by this approved amendment. The branch remains unmerged
until the amended implementation and desktop acceptance are complete.
