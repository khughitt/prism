# Compositional profiles: scratch edits, deltas above the look, typed commits

**Date:** 2026-09-19
**Status:** draft for review
**Task:** `prism-aec90f`, under goal `prism-2f0b4b`; settles `prism-46035b`,
`prism-bf3ae9`, `prism-ad2b12`, `prism-b8b589`, `prism-8a8eac`, `prism-49a068`,
`prism-b6d7ee` and frames `prism-9298b9` (Section 12)

## Context

The store composes five layers, low to high: defaults, base, wallpaper,
state (reserved), profile
([context layers](2026-09-05-prism-context-layers-design.md)). Every edit
lands in the topmost *explicit* layer: the loaded profile, else the wallpaper
while pinned, else base. A profile is a full snapshot, and edits under a loaded
profile write straight into its file.

Fifteen open tasks circle this arrangement, and they share two roots.

**A profile hides every wallpaper.** A full snapshot above the wallpaper layer
covers every key, so wallpaper tuning is invisible whenever any profile is
loaded. The live store shows the consequence: seven profiles, one loaded
nearly always, and not one wallpaper context. The pin was never worth using.

**Persistence is implicit.** Because a slider write mutates the loaded profile
at once, there is no unsaved state: nothing to mark as edited, nothing to
revert, nothing safe to load another profile over, and no starting point for
New. Reset has to mean three things at once, and neutralizing everything under
a profile needs a special case that clears the profile first (`5a49248`).

The brief of 2026-09-13
([profile editing brief](../notes/2026-09-13-profile-editing-brief.md))
proposed panel-local patches: a once-set marker, a target picker. This design
replaces the arrangement instead, so the controls fall out of the store.

### What prism composes, and what it does not

A terminal window's appearance is a fold over more than prism's layers: a
material, the window's focus state, its familiar identity and state, the
wallpaper's tuning, and any edit on top. Two folds happen at different times
with different owners:

- **Prism folds persisted layers at write time** into one material set and the
  parameters around it. Its output is global, and it has no daemon.
- **The compositor folds live per-window signals at draw time.** Focus,
  urgency (the terminal bell), and familiar's per-project hue and six states
  are already signals in niri-material (its `docs/materials/2026-09-02-material-signals-design.md`).
  Prism never sees a window id.

Prism's contribution to the second group is **response tuning**: how far the
unfocused pane recedes (the inactive matrix), ring and flash strengths. Those
are ordinary parameters in the stack below. Focus reaches prism only as the two
materials it emits, exactly as today.

A niri-material preset is a *material*: the optics subset. A prism *profile* is
wider: every prism parameter, gaps and terminal ids included. A preset imports
as a profile that sets only its optics, and base supplies the rest, which the
resolver already allows. The names stay distinct because the sets are.

## Decisions

- **A layer is a sparse map; the look is a right-biased fold.** Each layer kind
  declares what activates it and whether it takes edits. No kind derives its
  role from another's state.
- **Every edit lands in one place: the scratch layer**, topmost, always active.
  `set`, `unset`, and every reset mode write scratch. A scratch value equal to
  what the layers beneath compose to is not stored.
- **Persistence is a typed commit.** `commit base`, `commit profile`,
  `commit profile <name>` (save as), and `commit wallpaper` fold scratch into
  one destination. A commit never changes an effective value.
- **Revert is one operation at every level**: remove keys from scratch. Row,
  section, and panel-wide resets are the same verb at three scopes.
- **Context deltas sit above the look.** The order becomes defaults, base,
  profile, wallpaper, state, scratch. A wallpaper nudge shows through under
  every profile.
- **The wallpaper hook folds scratch into the wallpaper that leaves.** Edits
  made while a wallpaper showed belong to it. No pin, no save step.
- **Scratch survives a profile switch.** Loading a profile never touches
  scratch and never loses an edit; browsing profiles with a nudge applied is
  the compositional reading of "edits on top".
- **Nothing is ever shadowed.** Scratch is topmost, so the panel's shadow
  machinery goes. A provenance marker tells which rows the wallpaper nudges.

Rejected: auto-capture into the active wallpaper delta with an explicit
"edit the material" mode (the material mutates directly again inside that
mode, which is today's dirty-marker problem); a remembered scope selector with
no scratch (every reset and marker question stays as ambiguous as it is);
relative deltas, so a wallpaper nudge tuned over one profile transfers as an
offset (a real operator question, deferred to `material-764d8c`; absolute
deltas are acceptable to start and the algebra has room for it).

## Section 1: the layer stack

| rank | kind | file | activated by | takes edits | contents |
|---|---|---|---|---|---|
| 1 | `default` | defs | always | no | shipped defaults |
| 2 | `base` | `~/.config/prism/values.yaml` | always | by commit | the unnamed look, sparse over defaults |
| 3 | `profile` | `~/.config/prism/contexts/profile/<name>.yaml` | `context activate profile` | by commit | a named look; full when saved by prism, sparse when imported |
| 4 | `wallpaper` | `~/.config/prism/contexts/wallpaper/<id>.yaml` | the wallpaper hook | by commit or fold | the delta for one wallpaper |
| 5 | `state` | reserved | a hook, later | by commit or fold | the delta for one reported state |
| 6 | `scratch` | `~/.local/state/prism/scratch.yaml` | always | yes | every edit not yet committed |

`RESOLUTION_ORDER` becomes `['default', 'base', 'profile', 'wallpaper',
'state', 'scratch']` and `LAYER_ORDER` (the context kinds) becomes
`['profile', 'wallpaper', 'state']`. The resolver is unchanged: it folds base,
then the active context layers in order, then scratch, validating every layer
in full.

Ranks 2 and 3 together are the **look**: the profile when one is loaded, else
base. Ranks 4 and 5 are **context deltas**: sparse, hook-activated, keyed by a
context value. The rule for adding a delta kind is in Section 3.

Scratch is flat YAML with no `_source`, kept in the state directory because
it is runtime state, not configuration. A missing file is an empty layer.
`doctor` reports an orphan or invalid key in it the way it does for any
layer.

A profile still layers over base rather than replacing it. For a profile prism
saved this is a distinction without a difference, since the snapshot covers
every key. For an imported preset it is the point: the optics come from the
preset and everything else from base.

## Section 2: scratch and commits

### Writing

`prism set <key> <value>` writes scratch. The value is normalized: when it
equals what the layers beneath scratch compose to for that key, the key is
removed from scratch instead of stored. Dragging a slider back to where it
started therefore leaves no edit behind.

`prism unset <key>` removes the key from scratch. A key scratch does not hold
is an error, `<key>: not edited`, as the panel never offers it.

`--base` on `set`, `unset`, and `reset` stays as the scripting path that
writes base directly, bypassing scratch. It is the only way a value reaches a
layer without a commit, and the panel never uses it.

### Commits

```
prism commit base                # fold scratch into the unnamed look
prism commit profile             # fold scratch into the loaded profile
prism commit profile <name>      # save what is on screen as <name>, then load it
prism commit wallpaper <id>      # fold scratch into the wallpaper on screen
```

The three merging commits refuse empty scratch with `nothing to commit`; the
panel guards their buttons on the count, so reaching the error means the two
are out of step. Save-as is exempt: naming the Default look or duplicating an
unchanged profile is a snapshot, and needs no edit to be worth taking.

**`commit base`** merges scratch into base under base's existing rule (a
value equal to the def default is dropped). It is refused while a profile is
loaded, `profile <name> is loaded; commit profile, or deactivate it first`,
because the merged values would be covered by the profile and the screen would
change.

**`commit profile`** merges scratch into the loaded profile's file. It is
refused with no profile loaded. It merges rather than snapshots, so an
imported sparse profile stays sparse.

**`commit profile <name>`** writes a full snapshot of **what is on screen**:
every parameter as it resolves through the whole stack, context deltas
included. Save-as is what-you-see-is-what-you-save. The alternative, a
snapshot of the look plus scratch with the deltas stripped out, was rejected
because it silently loses intent: `set` and `neutral` both skip a value the
fold already shows, so a key the wallpaper delta holds at the wanted value
never reaches scratch, and a snapshot without the delta would store the
profile's old value instead. A neutral profile made under a wallpaper that
already quiets one key would not be neutral. Including the deltas costs
nothing: the wallpaper keeps its delta, whose values equal the snapshot's for
those keys. It replaces an existing file, which the panel asks about first, as
today. Scratch is cleared and the new profile is activated in the same locked
step. `commit profile <name>` with `<name>` equal to the loaded profile is
`commit profile`, refusals included; the panel closes the name field without
a command in that case when there is nothing to commit.

**`commit wallpaper <id>`** merges scratch into the delta of the wallpaper on
screen, creating the file with `_source` on first write. The id is the one the
caller believes is on screen: the verb is refused as `wallpaper <id> is not on
screen` when it is not the active one, so a panel drawn before a rotation
cannot commit edits to the wrong wallpaper. It is refused with no active
wallpaper.

### The invariant

A commit never changes an effective value. Before, the values came from
scratch; after, from the destination. For `commit wallpaper` that holds by
construction. For a commit to the look it does not hold on its own: a key that
scratch and the active wallpaper delta both hold would show the delta's value
once scratch is gone, and save-as is no exception, since its snapshot carries
scratch's value for such a key while the delta still carries its own. So **a
commit removes scratch's keys from every active delta above its
destination**, deleting a delta file that empties. For a commit to the look
that is every active delta; for `commit wallpaper` it is only a state delta,
once one exists. The user set that key while the wallpaper showed, so the
wallpaper's own tuning for it is now the look's value. Keys scratch does not
hold stay in the delta, which is why save-as leaves a wallpaper's untouched
nudges where they were. Inactive deltas are untouched and show their nudges
when they return.

Because the fold is unchanged, a commit writes no `resolved.json` and fans out
to nothing. Only `describe` sees it.

### Lifecycle

- **Profile activate and deactivate** leave scratch alone. The screen shows
  the new look with the same deltas and the same edits on top.
- **A wallpaper leaving** folds scratch into that wallpaper's delta and clears
  scratch. This is the rule behind the hook (Section 3). Every wallpaper slot
  change that moves away from a wallpaper folds: the hook, `activate
  wallpaper`, and `deactivate wallpaper`. With no wallpaper active, an edit
  is about nothing in particular and scratch simply persists.
- **Delete of the active wallpaper** clears the slot and leaves scratch: the
  file that would receive the fold is the one being removed.
- **Revert** (`prism reset revert`, Section 4) clears scratch in scope.

The one pitfall is stated rather than guarded: a profile edit left
uncommitted through a wallpaper rotation becomes that wallpaper's nudge. The
edits row's count and commit buttons make the state visible, and a rotation
is fifteen minutes here. Recovering is `context show wallpaper <id>` and a
commit to the look by hand; a "promote" verb is not designed until the
pitfall is met in practice.

## Section 3: context deltas

A context delta kind is defined by three things: a kind name in
`LAYER_ORDER`, a key source (what value names the active context), and an
entry point the hook calls. The wallpaper kind is the first instance:

- kind `wallpaper`, key `sha256(canonical path)[0:8]`, entry
  `prism context wallpaper <path>`.

The entry point, under the store lock: canonicalise, derive the id; if it
equals the active id, do nothing. Otherwise compute the whole next state
first: the leaving wallpaper's delta merged with scratch, an empty scratch,
and the new slot. Validate the merged delta as a layer, and resolve the next
state, which validates the incoming wallpaper's delta if it has one. Only
then write, in the order Section 8 fixes: the merged delta, the cleared
scratch, the slot, `resolved.json`; then diff against the previous effective
values and fan out the changed keys. An invalid incoming delta therefore
fails before anything is written, edits stay in scratch, and the old
wallpaper stays active, exactly as `changeSlots` refuses today. The fold and
the switch are one locked step, so a panel drag interleaving with a rotation
lands either in the leaving wallpaper's delta or in fresh scratch under the
new one, never between.

```
prism context clear wallpaper <id>    # remove the on-screen wallpaper's delta; the slot stays
```

`clear` deletes the delta file and leaves the slot, so the wallpaper is active
and untuned. The effective values change, so it resolves and fans out. Like
`commit wallpaper`, it names the wallpaper it acts on and is refused as
`wallpaper <id> is not on screen` when that is not the active one, so a stale
panel cannot delete another wallpaper's tuning. It is refused with no active
wallpaper, and refused as `wallpaper <id>: untuned` when there is no delta,
the way `unset` refuses a key it would not remove.

`pin` and `unpin` are removed, with the `pinned` field of the slot. Since the
slot file is runtime state and no host holds a pinned entry, `readActive`
rejects the field like any other unknown one and nothing migrates.

The `state` kind stays reserved. When `prism-9298b9` scopes it, it adds a
kind whose key is the reported value (`theme/dark`, `power/battery`) and an
entry `prism context state <name> <value>`, and gets the fold rule for free.
Composition among deltas is fixed by `LAYER_ORDER`; a state delta ranks above
the wallpaper's because it is the more transient of the two. Whether deltas
of one kind can stack (several states at once) is decided there, not here.

## Section 4: reset

```
prism reset revert    [--base] [--group <name>]   # was: defaults
prism reset symmetric [--base] [--group <name>]
prism reset neutral   [--base] [--group <name>]
```

All three write scratch. `revert` removes every visible key in scope that
scratch holds; the mode is renamed because "defaults" no longer describes
what it reveals. `symmetric` and `neutral` compute as they do today
([reset modes](2026-09-10-reset-modes-design.md), Section 3), with the
resolved values as the comparison and the writes normalized like `set`. The
no-op rule on contents stays.

What this settles:

- **`prism-bf3ae9`**, restore under a loaded profile: revert removes edits and
  the profile shows through, unchanged. A profile is never emptied by a reset.
- **`prism-ad2b12`**, one reset per level: revert and neutral both remain,
  because they answer different questions (undo my edits; quiet the pane),
  and both are now safe at every level since neither touches a persisted
  layer. The row reset is revert; the section and panel-wide rows offer all
  three.
- The special case that deactivated the profile before a panel-wide neutral
  (`5a49248`) goes: neutral lands in scratch above the profile.

`--base` keeps its meaning on all three modes: the target is base, the skip
rules compare against base-effective values, and `reset revert --base` is the
way back to the shipped defaults for base. The panel does not offer it.

## Section 5: the CLI surface

```
prism set   [--base] <key> <value>
prism unset [--base] <key>
prism reset revert|symmetric|neutral [--base] [--group <name>]
prism commit base | profile [<name>] | wallpaper <id>
prism get | list | describe --json | apply | doctor           # unchanged
prism context list | show <kind> <name>
prism context activate <kind> <name> | deactivate <kind>
prism context rename profile <old> <new> | delete <kind> <name>
prism context clear wallpaper <id>
prism context wallpaper <path>
```

Removed: `context save` (its job is `commit profile <name>`), `context pin`,
`context unpin`. `context list` prints scratch's key count on its own line
when it is non-empty and drops the `(pinned)` suffix.

## Section 6: the describe contract

`prism describe --json` changes shape as follows.

Top level: `layers` is the new `RESOLUTION_ORDER`. `target` is removed; the
target is always scratch. `active.wallpaper` carries `id` and `path` only.
`active`, `profiles`, and `rack` are otherwise unchanged.

Per parameter: `heldInTarget` is replaced by **`held`**, the list of layers
that hold the key, in resolution order (`["base", "wallpaper",
"scratch"]`). `default` never appears in it, since every key has a default;
an empty list means the value is the shipped one. The panel derives *edited* (`scratch` in `held`), the wallpaper
header's count (`wallpaper` in `held`), and every reset count from it.
`layer` and `fallback` stay; `fallback` is what revert would reveal, which is
the fold beneath scratch when scratch holds the key and the value itself
otherwise.

```json
{
  "active": { "wallpaper": { "id": "3f9a1c2e", "path": "/path/to/wall.jpg" }, "profile": "dark" },
  "profiles": ["dark", "dusk"],
  "layers": ["default", "base", "profile", "wallpaper", "state", "scratch"],
  "params": [
    { "key": "glass.ior", "value": 1.4, "layer": "scratch", "fallback": 1.3,
      "held": ["profile", "wallpaper", "scratch"] }
  ]
}
```

`validateModel` requires `held` on every parameter and stops requiring
`target`. The loud failure stays one-sided: an older CLI under this panel
fails as `<key> has no held layers`.

## Section 7: the panel

### The look row

Today's profile row. The selector's index 0 reads **`Default`** instead of
`-`, naming the unnamed look; it is truthful now, because the wallpaper delta
shows on top of Default exactly as it does on top of any profile. The save
button opens the name field and issues `commit profile <name>`: save-as is
the whole of New, because a fresh profile starts from what is on screen, and
"start from neutral" is a panel-wide neutral followed by save-as, which
Section 2's snapshot rule makes exact. Rename and
delete act on the loaded profile, as today; loading another to manage it now
costs a compositor reload and nothing else, since scratch survives the
switch. The replace and delete questions stay.

### The edits row

Replaces the panel-wide reset row under the wallpaper header. It carries the
edited count and five ghost buttons in the panel's existing reset idiom:
always in the tree, opacity carrying state, tooltip explaining, handler
guarding.

| button | command | full strength when | tooltip |
|---|---|---|---|
| keep in look | `commit profile` or `commit base` | edited > 0 | `Keep N edits in profile dark` / `Keep N edits in Default` |
| keep for wallpaper | `commit wallpaper <id>` | edited > 0 and a wallpaper is active | `Keep N edits for this wallpaper` |
| revert | `reset revert` | edited > 0 | `Revert N edits` |
| symmetric | `reset symmetric` | differing pairs > 0 | as today |
| neutral | `reset neutral` | eligible keys > 0 | as today |

The edited marker is the count itself, derived from `held` on every render.
It needs no panel-side lifetime rules: a failed write leaves the count where
describe says it is, a rapid profile switch leaves scratch alone, and reopening
the panel reads the truth.

Section headers keep revert, symmetric, and neutral with per-section counts.
The row reset is revert for one key, full strength when the key is edited,
showing `fallback` until describe reconciles.

### The wallpaper header

Replaces the row from `prism-3b7c07`. With a wallpaper active it shows a
glyph lit when the delta holds any visible key, the count (`N for this
wallpaper`), and a clear button that issues `context clear wallpaper <id>`
with the id from the model. The basename moves into the tooltip. No pin. With
no wallpaper there is no row.

### Following the rotation

The panel runs describe on open and after its own writes, so a rotation while
it is open would leave the header naming wallpaper A while the store has moved
to B, the edits row advertising edits the hook has already folded, and a clear
aimed at A. The id on the wallpaper verbs makes the last of those a loud
refusal; the first two need the panel to notice. Noctalia has no plugin-side
wallpaper event, so while the panel is open it polls
`noctalia.wallpaperPath(output)` for the widget's output on a one-second tick,
separate from the drag tick, and compares it with the value it read at its
last describe. On a change it requests a describe through the existing
stale-and-replay path, so a drag or a queued write is never interrupted, and
keeps the change pending until a describe comes back whose active wallpaper
differs from the one before. If ten ticks pass without that, the panel shows
`the wallpaper changed but prism did not follow; check the wallpaper_changed
hook` in its error banner, since the two are then out of step. Closing the
panel stops the tick. The API's name and the output argument are checked
against the installed Noctalia before they are written, as every host prop
is. This absorbs `prism-b6d7ee`.

### Provenance instead of shadow

`isShadowed`, `shadowHint`, `layerRanks`, and every dimming rule go: nothing
sits above the write target. In their place, a row whose value comes from the
wallpaper delta carries a faint `wallpaper` marker in the marker slot, after
`Unavailable` and before `Live` in the existing precedence, so the user can
see which rows a wallpaper nudges. A row whose value comes from scratch
carries none: the reset at full strength already says it.

### Plumbing

`Queue.argvFor` gains `commit` (destination, optional name) and `clear`, and
drops `pin` and `save`; `activateAfter` goes with `save`, since `commit
profile <name>` activates in the same command. Every one of these affects the
model and forces a refresh. The keyboard vocabulary (`prism-84d308`) is
untouched: digits still activate profiles, and doing so with edits pending
is now safe.

## Section 8: errors, concurrency, migration

Errors, one line each, no partial writes:

- a merging `commit` with empty scratch; `commit base` under a loaded
  profile; `commit profile` with none loaded; `commit wallpaper` and `clear
  wallpaper` with no active wallpaper or with an id that is not the active
  one; `clear wallpaper` with no delta;
- `unset` of a key scratch does not hold;
- an unknown field in the wallpaper slot, `pinned` included;
- an invalid or orphan key in `scratch.yaml`, reported by every verb that
  resolves, with `doctor` naming the file.

Every verb that touches scratch, a context file, or the slots runs under the
store lock with the atomic temp-and-rename helpers. The fold in the wallpaper
entry point is inside the same critical section as the slot write.

### Multi-file writes

A lock and per-file atomic renames do not make several files one
transaction, so every verb that writes more than one file follows two rules.
First, it computes and validates its whole next state before the first
write, the way `changeSlots` does today: nothing is written that the resolve
has not accepted. Second, it writes in an order where **every prefix of the
sequence is a valid store with the same effective values as before the
verb**, up to the one step that is meant to be visible, and where re-running
the verb completes an interrupted one because each step is idempotent.

| verb | write order | why each prefix holds |
|---|---|---|
| hook, `activate wallpaper`, `deactivate wallpaper` | merged delta, cleared scratch, slot, `resolved.json` | scratch still supplies the values after step 1; the delta supplies the same ones after step 2; step 3 is the visible switch |
| `commit base`, `commit profile` | destination, stripped deltas, cleared scratch | scratch stays on top until the last step |
| `commit profile <name>` | snapshot, stripped deltas, cleared scratch, slot | as above; the snapshot equals the screen, so activating it is invisible |
| `commit wallpaper <id>` | merged delta, stripped state delta, cleared scratch | as above |
| `clear wallpaper <id>` | delta file, `resolved.json` | one file, then the bus |

A crash between the last store write and `resolved.json` leaves the bus
stale, which is the existing `prism-ebbd33` condition and is recovered by
`prism apply`; this design does not widen it. A merge repeated on re-run
merges the same keys again, a strip removes keys already gone, and a cleared
scratch folds nothing, so re-running the hook or the commit after an
interruption finishes it.

Migration: `values.yaml` and every profile file are unchanged. An existing
wallpaper delta file stays valid and simply ranks above the profile now.
`scratch.yaml` appears on the first edit. The dotfiles note that names the pin
(`noctalia/noctalia.md`) needs one paragraph rewritten; that is a `dots` task
filed from the plan.

## Section 9: testing

Node, through the existing harnesses:

- `test/layers.test.js`: the new order; `held` derivation; `fallback` with and
  without a scratch key; a profile above base and a wallpaper above both.
- `test/cli.test.js`: `set` normalizing away a value equal to the fold
  beneath; `unset` of an unedited key; each reset mode writing scratch;
  `revert --base`; the panel-wide neutral under a loaded profile leaving the
  profile file byte-identical.
- `test/context-cli.test.js`: `commit` to each destination; the invariant
  (resolved values identical before and after every commit, `resolved.json`
  untouched, runner uncalled); a commit to the look dropping the committed
  keys from the active delta and deleting an emptied file; save-as
  snapshotting the screen with the delta's values included, stripping only
  scratch's keys from the delta, and activating; save-as with empty scratch
  succeeding; the reviewer's case, profile roughness `0.5` under a wallpaper
  delta of `0`, neutral then save-as yielding a profile at `0`; each refusal,
  the wrong-id refusals included; the fold on hook, `activate wallpaper`, and
  `deactivate wallpaper`; the hook refusing an invalid incoming delta with
  scratch, the leaving delta, and the slot byte-identical; scratch surviving
  profile activate and deactivate; delete of the active wallpaper leaving
  scratch; `clear wallpaper` fan-out and its refusals; `pin` rejected as an
  unknown verb and `pinned` rejected in the slot; and, with an injected
  failure after each write of every multi-file verb, the store resolving to
  the same effective values and a re-run completing the verb.
- `test/reset.test.js`: the `revert` mode name.
- `integrations/noctalia-plugin/contract.test.mjs`: real describe output
  carries `held` on every parameter and no `target`, and still renders.

Lua (`plugin_test.lua`, `test/plugin-presentation.test.js`,
`test/plugin-panel-lifecycle.test.js`):

- edited, wallpaper, and per-section counts from `held`; the edits row's five
  states; the look row's `Default` label; the wallpaper header with and
  without a delta; the provenance marker's precedence; `argvFor` for `commit`
  with each destination and for `clear`, both carrying the model's wallpaper
  id; the validator requiring `held` and accepting a model without `target`;
  no shadow state anywhere; the rotation tick requesting a describe on a
  path change, holding the request through a drag, keeping it pending until
  the active wallpaper changes, and raising the banner at the bound.

Desktop acceptance, manual, on the worktree's plugin symlink:

1. nudge two sliders under a loaded profile, watch the edits row count, and
   switch profiles with the digits: the nudges stay on top;
2. keep for wallpaper, rotate the wallpaper by hand, rotate back: the nudge
   returns and the header counts it;
3. nudge, rotate without keeping: the leaving wallpaper's header shows the
   count when it returns;
4. keep in look under a profile while the wallpaper holds the same key: no
   visible change, and `context show` confirms the delta lost the key;
5. neutralize panel-wide under a profile, then revert: the profile's look
   returns and its file is unchanged;
6. with the panel open, rotate the wallpaper by hand: the header follows
   within a second or two and the edits row empties.

## Section 10: documentation

- README: the configuration layout gains `scratch.yaml`, the resolution
  order and the write rule are rewritten, the verb list follows Section 5.
- [`docs/notes/noctalia-plugin-contract.md`](../notes/noctalia-plugin-contract.md):
  the verb list, the look row, the edits row, the wallpaper header, the
  provenance marker, `held` in the describe shape, and the removal of the
  shadow rules.
- [context layers](2026-09-05-prism-context-layers-design.md) and
  [reset modes](2026-09-10-reset-modes-design.md): a status line pointing
  here for the order, the write target, and the mode rename.
- The [profile editing brief](../notes/2026-09-13-profile-editing-brief.md):
  a closing paragraph recording that this design answers it.

## Section 11: out of scope

- **Per-window state.** Focus, urgency, and familiar identity are compositor
  signals. Prism holds their response tuning as ordinary parameters.
- **Relative or blended deltas** (`material-764d8c`).
- **Undo history** (`prism-b25061`). Revert is not undo: it forgets every edit
  since the last commit, not the last gesture.
- **Managing an unloaded profile from the panel** (`prism-920f31`). The cost
  of loading one first is now a compositor reload, not lost work; a picker
  can be added when that reload proves worth removing.
- **Promoting a wallpaper delta into the look** by verb; see the pitfall in
  Section 2.
- **The `state` kind's sources and stacking** (`prism-9298b9`,
  `prism-d1fcd9`).

## Section 12: task map

Proposed reorganization once this spec is approved; applied with the plan.

| task | disposition |
|---|---|
| `prism-aec90f` | this design; the plan attaches here and its steps become children |
| `prism-46035b`, `prism-18fd65`, `prism-e08ee6` | superseded: the fold rule, the pin removal, and the wallpaper header are steps of the plan; drop with a pointer |
| `prism-bf3ae9` | done by Section 4; close with the verdict |
| `prism-ad2b12` | done by Section 4; close with the verdict |
| `prism-b8b589` | done by Section 7 (the edits count); close |
| `prism-49a068` | unshelve, close: `Default` in the selector, `reset revert --base` on the CLI |
| `prism-8a8eac` | unshelve, close: save-as is New |
| `prism-e37618` | drop: superseded by this design |
| `prism-3415ef` | closes when its children do |
| `prism-920f31` | stays an idea, reframed as in Section 11 |
| `prism-9298b9` | stays an idea, reframed to "add a delta kind" per Section 3 |
| `prism-d1fcd9` | stays an idea; depends on `prism-9298b9` |
| `prism-b6d7ee` | done by Section 7 (following the rotation); close |
| `prism-3e59b5`, `prism-cafffa`, `prism-fc791c` | unchanged |
| `prism-2f0b4b` | stays open until the plan lands; its body gains one paragraph pointing here |
| dots | one task: rewrite the pin paragraph in `noctalia/noctalia.md` |
