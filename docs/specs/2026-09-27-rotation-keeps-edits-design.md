# Wallpaper rotation keeps the screen and pending edits

**Date:** 2026-09-27
**Status:** implemented 2026-09-27 (merged to main). Live check: a wali rotation with and without pending edits kept the screen and wrote no pair; the palette template renders. A rotation onto a saved pair and a colorscheme-driven ring are covered by tests, not yet seen live (the ring source is familiar).
**Task:** `prism-5f6046` (parent `prism-2f0b4b`)
**Amends:** [profile loading and wallpaper-specific tweaks](2026-09-20-profile-wallpaper-pairs-design.md), the
"Rotate the wallpaper" and "First wallpaper activation" rows of its transition table.

## Intent

Wali's `wali-rotate.timer` picks a new wallpaper every 15 minutes (Noctalia's own timed
rotation is off). Wali sets it through Noctalia, whose `wallpaper_changed` hook runs
`prism context wallpaper <path>` (dotfiles `noctalia/config.toml`). Today that
transition saves pending edits into the outgoing look–wallpaper pair, clears scratch, and
re-resolves the look plus the incoming pair. On screen, unsaved work vanishes and the
profile reloads at every rotation. The saved copy lands in a pair the user never asked
for, and those silent saves are why the store holds about seventy pairs.

What the user wants: a rotation changes the wallpaper and Noctalia's colorscheme, which
Noctalia already owns. Prism settings change only when the incoming wallpaper has saved
parameters for the current look.

## The rule

A wallpaper transition changes only the keys the incoming pair sets. Every other visible
value stays where it was.

Concretely, when the wallpaper slot changes (a different id, a first activation, or a
deactivation), with the look unchanged:

1. `previous` is the full fold before the transition: defaults, base, look, outgoing pair,
   scratch.
2. `beneath` is the fold after it without scratch: defaults, base, look, incoming pair (none
   when there is no incoming pair or no wallpaper).
3. The new scratch holds, for every key, `previous[key]` wherever that differs from
   `beneath[key]`, except for keys the incoming pair sets, which take the pair's value
   and carry no scratch entry.

Nothing is written to any pair or look. Normalization is the same one `prism set`
already applies: a scratch value equal to the fold beneath it is no edit.

## Transition table (replaces the two amended rows)

| Action | Outgoing edits | Incoming appearance | Pending count |
|---|---|---|---|
| Rotate between two wallpapers without pairs | Kept in scratch | Unchanged | Unchanged |
| Rotate onto a wallpaper with a pair for this look | Kept, except keys the pair sets | Unchanged except the pair's keys, which show the pair's values | Drops by the pending keys the pair overrides |
| Rotate away from a wallpaper with a pair | Kept; the outgoing pair's values that differ from the new fold join scratch | Unchanged, except keys the incoming pair (if any) sets | Rises by the carried pair keys |
| First wallpaper activation (no wallpaper leaving) | Kept, except keys the incoming pair sets | As rotation | As rotation |
| Deactivate the wallpaper (`context deactivate wallpaper`) | Kept; outgoing pair values carried | Unchanged | Rises by the carried pair keys |
| The hook fires again for the wallpaper already active | Untouched (no-op, as today) | Unchanged | Unchanged |

In the first-activation row, the incoming pair now wins over pending edits for its keys.
Previously scratch sat above it. This makes first activation the same rule as rotation.

## What stays as it is

- Profile selection, selecting the loaded look, look recovery, and active-profile deletion
  keep their rows in the 2026-09-20 table, including the save to the outgoing pair on an
  explicit profile selection.
- **Clear wallpaper tuning** (`context clear wallpaper`, the `without` path) keeps the
  wallpaper slot. It is not a rotation and carries nothing: it still removes the active
  pair and reveals the profile.
- **Deleting the active wallpaper's pair** (`context delete wallpaper <id>`) empties the
  slot, as today. It is not a rotation either: the deleted pair's values are not carried,
  and scratch is left as it was.
- No wallpaper transition writes a pair. Pairs are written by **Keep for wallpaper**, and
  still by the save to the outgoing pair on an explicit profile selection (see
  Consequences). **Keep in look**, **Revert**, **Neutral**, and **Save As** are unchanged.
- Existing pairs are kept as they are. There is no migration. Unwanted ones are removed
  with Clear wallpaper tuning or `prism context delete`.
- Fan-out still reports and applies only the keys whose resolved value changed. A rotation
  between two unpaired wallpapers therefore changes no resolved key and reaches no sink
  through that path. What such a rotation changes is the palette, and the ring follows
  it through the separate path in the next section.

## Ring color follows the palette, not the rotation

The ring's `noctalia` color source (`glass.ring.colorSource`) is not a prism value. The
niri sink reads the accent from a Noctalia palette file each time it renders
(`integrations/niri/palette.js`). A palette change therefore reaches the ring only when
something runs the niri sink after the palette is written. Three things break that
today, and this change would make the first one routine:

1. Fan-out runs a sink only for changed keys. A rotation that changes no prism value
   runs no sink. That already happens today when scratch is empty and neither wallpaper
   has a pair; under this design it is the common case.
2. `wallpaper_changed` is the wrong moment. Noctalia fires it right after it starts
   regenerating the theme (`application_services.cpp`, the wallpaper change callback),
   so an apply from that hook can read the previous palette.
3. The file is dead. `~/.config/noctalia/colors.json` is a Noctalia 4 template output.
   Noctalia 5 no longer writes it; the working desktop's copy was last written on 2026-08-19, so
   today the ring rests on a month-old accent whatever the rotation does.

Design:

- **Source.** Prism ships a Noctalia 5 user template that renders the palette's primary
  color into a prism-owned file: `noctalia-palette.json` in prism's state directory (`stateDir()`), holding
  `{"primary": "#rrggbb"}`. `noctaliaColorsPath()` points at it, and
  `PRISM_NOCTALIA_COLORS` still overrides it. The reader's contract is unchanged: a
  missing file means the manual color, and a malformed one fails the apply. Further palette
  fields (the surface tone `prism-b5cb1e` needs) are added by that task, not here.
- **Trigger.** Noctalia's `colors_changed` hook runs `prism apply niri`. Noctalia fires it
  after the palette is resolved and the templates are written, and only when the palette
  actually changed. Ordering against the file write is therefore guaranteed, and an
  unchanged palette costs no apply. `wallpaper_changed` keeps only
  `prism context wallpaper` (and wali's `observe`).
- **Concurrency.** A rotation can run both hooks close together: the transition's
  fan-out, and the `colors_changed` apply. Whichever niri render finishes last must read
  the current palette. Niri renders are serialized, and each reads the palette inside
  its turn. The one that starts after the template write therefore always sees the new
  accent, whatever order the two hooks run in. The plan verifies whether fan-out and
  `prism apply` already share a per-sink lock, and adds one if they do not.
- **Where it lives.** The template file and its documentation are prism's
  (`integrations/niri/`). Registering the template and the `colors_changed` hook is a
  change to the dotfiles Noctalia config, filed as `dots-632c20`, which this task depends
  on for desktop acceptance.
- The `familiar` and `manual` color sources are unaffected.

## Consequences to be aware of

- **Carried values look like edits.** After you leave a tuned wallpaper, its values show
  as pending edits under the next one. This is intended: they are not saved for the
  wallpaper now showing. Keep for wallpaper saves them there, and Revert drops them back
  to the look.
- **Profile selection still autosaves.** An explicit profile selection saves scratch to
  the outgoing pair (unchanged row), so values carried from an earlier wallpaper are
  saved to the current wallpaper's pair when you switch profiles. This is out of scope
  here; a follow-up idea records whether profile selection should stop autosaving too.
- **The Glass master toggle** (`prism-6d1d72`): a pending `glass.enabled: false` now
  survives rotation and is no longer written into a pair. It is still overridden when an
  incoming pair sets `glass.enabled` itself, so that task's design question stays open,
  narrowed to that case.
- **An open panel** still goes stale across a rotation (`prism-b6d7ee`). This change
  reduces how much goes stale, since most rotations now change no prism value.

## Failure handling

The validation order of `changeSlots` is kept: the runtime, base, scratch, the outgoing
fold and the incoming look/pair are all resolved before any write. A malformed incoming
pair leaves the old selection and scratch untouched. The transition writes only the
runtime file (slots and scratch together, atomically), so an interruption before that
write changes nothing, and one after it is completed by `prism apply`, as today. The
outgoing-pair write disappears from this path, which removes one interruption point.

When the outgoing fold cannot be resolved on a wallpaper transition (a broken active
look), the transition fails as it does today. The incoming fold uses the same look, so it
could not succeed either.

## Acceptance

1. Under a look with no pairs for W1 or W2, edit two values on W1 and rotate to W2. The
   screen does not change, the pending count stays 2, and no pair file is written.
2. Save a pair for W3 that sets roughness. With a pending roughness edit and a pending
   saturation edit on W2, rotate to W3. Roughness shows W3's value, saturation keeps the
   edit, and the pending count is 1.
3. Rotate from W3 to W4 (no pair). Nothing on screen changes. W3's roughness is now a
   pending edit, and Keep for wallpaper saves it into the W4 pair.
4. Clear wallpaper tuning on W3 still reveals the look and carries nothing into scratch.
5. The hook firing twice for the same wallpaper is a no-op.
6. Turn Glass off from the panel, then rotate through an unpaired wallpaper. Glass stays
   off, and no pair gains `glass.enabled`.
7. A malformed incoming pair fails the transition before any write; scratch and slots are
   unchanged.
8. Rotate between two unpaired wallpapers whose palettes differ. The ring takes the new
   primary once Noctalia's templates are written, with no prism value changing. A
   rotation that leaves the palette unchanged runs no `colors_changed` apply.
9. With the palette file missing, the ring rests on the manual color. With it malformed,
   `prism apply niri` fails and says which file.
10. The 2026-09-20 acceptance items for profile selection still pass. Its item 3
   ("rotating away and back restores each pair") changes. Going from W1 (pair A) to W2
   (pair B) and back shows A's values for A's keys again. Keys only B sets stay pending,
   because leaving W2 carries them forward. The old item held only because every
   rotation reloaded the look.
