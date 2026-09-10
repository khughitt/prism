# Neutral and symmetric reset modes

**Date:** 2026-09-10
**Status:** implementation in progress on `reset-modes`; desktop acceptance pending.
**Task:** `prism-91edc5`

## Context

The panel has one reset gesture, at two scopes. A row's reset issues `prism
unset` for its parameter; a section header's reset issues one `unset` per
parameter the section holds
([`2026-08-16-prism-noctalia-panel-design.md`](../superpowers/specs/2026-08-16-prism-noctalia-panel-design.md)).
Both remove overrides in the write target, so each parameter falls back to
whatever the layer beneath supplies — often the def default, but a wallpaper
or base value where one is set.

Those defaults are not a level playing field. The focus matrix ships six pairs
whose halves diverge on purpose — `glass.roughness` 0.08 against
`glass.inactive.roughness` 0.5, saturation 1 against 0.85, and so on — because
an unfocused pane is meant to recede
([`2026-09-05-glass-noise-saturation-focus-state-design.md`](2026-09-05-glass-noise-saturation-focus-state-design.md)).
Resetting therefore lands you in a tuned, asymmetric, fully-dressed glass. That
is the right place to *start* from and the wrong place to *learn* from: you
cannot see what one parameter does when eleven others are already doing
something, and you cannot tell a focused change from an unfocused one when the
two halves begin apart.

`prism-91edc5` asks for two more modes beside reset-to-defaults:

- **symmetric** — give focused and unfocused the same settings, so the split
  starts from parity and any later divergence is one you made.
- **neutral** — quiet most parameters, keeping a small curated set at non-zero
  values, so each parameter's effect can be explored as it is brought back in.

The rack already carries a partial answer. Each device has a bypass that
silences its stage while the parameters keep their numbers, and the niri sink
holds the table of what "off" means per device (`DRY` in
[`integrations/niri/render.js`](../../integrations/niri/render.js))
([`2026-09-08-device-chain-rack-design.md`](2026-09-08-device-chain-rack-design.md)).
Bypass isolates whole devices at whatever values they currently hold; it says
nothing about the Glass section, and it cannot give you a parameter you bring
up from zero. It is a good neighbour to this work, not a substitute for it.

## Decisions

- **Neutral is a value in the defs, not a rule.** Every visible def declares
  `neutral:` beside `default:`. A derived rule would be wrong too often to
  trust: saturation's neutral is 1 because 0 is greyscale, refraction's is 1
  because 0 is out of range, tint's is `#ffffff` because white absorbs nothing.
- **Both halves of a matrix row declare the same neutral.** Enforced at load.
  Neutral is then symmetric by construction — you never run one after the
  other — and the focus split stops being a confound while you explore.
- **`glass.focusSplit` is exempt, and says so.** A visible def declares exactly
  one of `neutral: <value>` or `neutralize: false`. Declaring neither is a
  load error, so a visible parameter added later cannot join without a
  decision.
- **Neutral quiets the pane; it does not promise independence.** Effect
  dependencies survive it, and this document records them rather than solving
  them. That is `prism-b315f9`'s subject.
- **All three modes are one CLI verb.** `prism reset <mode>` takes the store
  lock, reads one snapshot, computes and validates the whole mutation against
  it, writes the target and `resolved.json` once, releases, then fans out once.
  The panel issues one command per click.
- **The panel gains no new idiom.** Three ghost glyph buttons per scope, always
  in the tree, opacity carrying state, tooltip explaining, guard in the
  handler — the same bargain every reset in the panel already makes.
- **`describe` gains `neutral` and `heldInTarget`.** The first lets the panel
  count locally; the second fixes a restore-counting bug the batched verb would
  otherwise disagree with (Section 4).
- **No confirmation.** A neutral write lands like every other write in the
  panel. Getting back is undo's job, and undo should be one general mechanism
  rather than a guard bolted to this gesture; filed as `prism-b25061`.

## Section 1: the `neutral` field

### Schema

```yaml
- key: glass.saturation
  type: float
  range: [0, 3]
  default: 1
  neutral: 1
  ui: {group: Focus, control: slider, ...}

- key: glass.focusSplit
  type: bool
  default: true
  neutralize: false
  ui: {group: Focus, control: toggle, header: true, ...}
```

`validateDef` gains four rules:

1. A def with a visible control declares exactly one of `neutral` or
   `neutralize`. Declaring both, or neither, fails.
2. `neutralize`, when present, must be `false` — mirroring the existing
   `ui.header must be true when present` rule. There is no `neutralize: true`,
   because that is what declaring a `neutral` already means.
3. `neutral` must pass `validateValue(def, def.neutral)`: in `range` for a
   numeric, a member of `values` for an enum, the right type throughout. This
   has to be explicit at load. `validateDef` checks only that `default` is
   *present*; it is `resolveLayered` that validates the default's value, and
   nothing resolves a neutral.
4. A def with `control: none` declares neither field, the way it already
   declares no `ui.label` and no `ui.order`.

`defs.js` imports `validateValue` from `values.js` for rule 3. There is no
cycle: `values.js` imports only `paths.js`.

`loadDefs` gains one cross-def rule: **both halves of a matrix row declare the
same `neutral`.** Rows are keyed by `(ui.group, ui.row)` across all defs, not
by `ui.row` alone, so Terminal's opacity pair is covered by the same check and
two groups may reuse a row label without colliding. The message names the group,
the row, and the two keys.

Type and range equality between a row's halves is deliberately *not* checked at
load. A twin with a legitimately narrower range should fail loudly at the copy
that would overflow it (Section 3), not be forbidden at definition.

### The contract

`prism describe --json` emits `neutral` for a def that has one and
`neutralize: false` for the exempt def, beside the existing `default`. The
panel's `validateModel` requires exactly one of the two on every visible
parameter, so an older `prism` under a newer panel fails as a named sentence —
the one-sided loud failure the plugin contract already relies on.

## Section 2: the curated set

Three kinds of entry.

### Identities

The value at which a device does nothing. These already exist as `DRY` in the
niri sink; the defs now state them at defs level, and a test pins the two
tables to each other for the keys they share.

| Parameter | neutral |
|---|---|
| `glass.roughness` / `glass.inactive.roughness` (Blur) | `0` |
| `glass.backdropBlur` / `glass.inactive.backdropBlur` | `false` |
| `glass.ior` / `glass.inactive.ior` (Refraction) | `1` |
| `glass.attenuationColor` / `glass.inactive.attenuationColor` (Tint) | `#ffffff` |
| `glass.chromaticAberration` / `glass.inactive.chromaticAberration` (Fringing) | `0` |
| `glass.anisotropicBlur` / `glass.inactive.anisotropicBlur` (Directional blur) | `0` |
| `glass.distortion` / `glass.inactive.distortion` | `0` |
| `glass.noise` / `glass.inactive.noise` | `0` |
| `glass.saturation` / `glass.inactive.saturation` | `1` |
| all eight `glass.bypass.*` | `false` |

The bypasses go to `false` deliberately. A bypass left set would silence the
very device you are bringing back, and the panel would show a slider moving
with nothing happening on screen.

### Zeroable geometry

Directly visible on their own, so zero is a clean floor and dragging one up
explains itself.

| Parameter | neutral |
|---|---|
| `glass.paneLip` (Edge bevel) | `0` |
| `glass.paneShiftX` / `glass.paneShiftY` (Pane offset) | `0` |
| `glass.jellyFlex` (Flex) | `0` |
| `glass.jellyRipple` (Ripple) | `0` |
| `terminal.background.opacity.active` / `.inactive` | `0` |

Terminal opacity is already `0` by default: that is the "only the glass behind
the text" baseline, and it is the right one to look at glass through.

### Enablers and companions

The small non-zero set the task asks for. An enabler is a parameter that scales
another one's effect, so zeroing it would make the thing you re-introduce read
as nothing. A companion has no identity value at all and keeps the shipped
choice.

| Parameter | neutral | why it survives |
|---|---|---|
| `glass.enabled` | `true` | off means there is no glass to explore |
| `compositor.gaps` (Window spacing) | `24` | with no gaps there is no wallpaper between windows for the glass to refract |
| `glass.thickness` / `glass.inactive.thickness` (Depth) | `20` | at 0 there is no volume, so refraction and tint have nothing to act through |
| `glass.attenuationDistance` / `glass.inactive.attenuationDistance` (Tint distance) | `60` | at the 65535 ceiling tint absorbs nothing; at the floor of 1 it goes black at once |
| `glass.distortionScale` / `glass.inactive.distortionScale` (Distortion detail) | `0.5` | at either end of its log range distortion reads as a slow warp or as noise |
| `glass.noiseType` | `fine` | an enum with no identity; the shipped grain (companion, not enabler) |

`glass.focusSplit` is the exempt def: bulk neutral leaves the split as it
found it, and the "already neutral" count ignores it.

### What neutral does not promise

Neutral is a quiet starting point, not a guarantee that every control now acts
alone. At `ior 1` the depth-jittered refraction taps coincide, so raising
`anisotropicBlur` by itself does nothing and `roughness` reads flattened —
both ride the refraction taps and scale with an index above 1. Fringing is not
in that set: its green and blue channels keep an index above 1 and refract on
their own, which is exactly why the sink's refraction bypass has to zero
fringing explicitly rather than rely on `ior 1` to do it. The reasoning is
recorded at [`integrations/niri/render.js:61`](../../integrations/niri/render.js).

Surfacing those couplings in the panel is `prism-b315f9`. This design states
them and stops there.

### Provisional: `paneLip`

`paneLip 0` with both offsets at 0 produces a bevel of exactly 0, so the slab
stops extending past the window edge. It sits in the zeroable group because it
is directly visible rather than a scaler of something else, but that is a
judgment call. Desktop acceptance (Section 5) raises refraction from the
neutral baseline and confirms it reads; if it does not, `paneLip` moves to the
enablers at its shipped `6`.

## Section 3: `prism reset`

```
prism reset defaults  [--base] [--group <name>]
prism reset symmetric [--base] [--group <name>]
prism reset neutral   [--base] [--group <name>]
```

The mode is positional, like `prism context activate profile <name>`. `--base`
retargets the write to the base layer, exactly as it does on `set` and `unset`.
`--group` is a `ui.group` name and restricts the scope to that group's visible
parameters; without it the scope is every visible parameter.

The usage line becomes
`prism set|unset|get|list|describe|apply|doctor|context|reset`.

### Scope and target

The **write target** is the store's current target, or base under `--base` —
the same `writeTarget(active)` rule `unset` follows.

An unknown `--group`, or one whose parameters are all `control: none`, is an
error naming the groups that do have visible parameters. The panel only ever
sends group names it read from `describe`, so that error means the panel and
the CLI are out of step, which is the failure the plugin contract already wants
to be loud.

### What each mode computes

**`defaults`** — remove every visible key in scope that the write target holds.
This follows `unset`'s existing rules, including deleting a wallpaper context
whose values empty. It is today's section reset, batched.

**`symmetric`** — for each `(ui.group, ui.row)` pair in scope, write the
unfocused half to the focused half's value. What you see is what gets mirrored:
the source is the focused parameter's *resolved* value, read from the same
locked snapshot as every other source in the batch. Under `--base` the source
is instead the focused parameter's base-effective value — its base override if
base holds one, else its def default — because copying a wallpaper's value down
into base is not what `--base` asks for. Pairs whose two values are already
equal are skipped, so no redundant override appears. Keys with no twin are
untouched.

**`neutral`** — write each eligible key in scope to its `neutral`. Eligible
means visible and not `neutralize: false`.

### Skip rules

A mode's skip rule decides which keys are *already* where the mode wants them.

- Ordinary `neutral` compares against each key's **resolved** value, matching
  the count the panel shows and avoiding overrides that would change nothing.
- `neutral --base` compares against each key's **base-effective** value
  instead. An overlay that happens to sit at neutral must not block a base
  change the user explicitly asked for. A higher layer can still shadow the
  result afterwards; that is what `--base` means and the panel already marks
  those rows.
- `symmetric` uses the pair rule stated above, with the same
  resolved-versus-base-effective split.

A skip rule selects a key; it does not prove the write changes anything. The
two are not the same, because the base rule normalizes a value equal to the def
default into a *deletion*. Consider an unpinned wallpaper supplying terminal
opacity `0.5` with base holding nothing and the neutral being the default `0`:
the resolved comparison selects the key, and the base rule then deletes a key
that was never there. Nothing changed, yet a naive implementation would rewrite
`resolved.json` and reload the compositor.

So the no-op test is on **contents, not selection**: build the proposed target
layer in full and compare it with the layer's original contents. Write and fan
out only for a real addition, change, or removal. Section 5 pins that case as a
regression test.

Comparison uses the `isDeepStrictEqual` the store already uses. One consequence
worth naming: a color differing from its neutral only in hex case counts as
differing and is rewritten to the canonical value. That is harmless — the
result is the neutral value either way — and it keeps one comparison rule
across the store rather than a case-folding special case in one place.

All three modes keep `set`'s base rule: a value equal to the def's default is
deleted from the base layer rather than stored.

### Writing

The whole mutation is computed and validated before anything is written.
Symmetric runs `validateValue(unfocusedDef, value)` on each copied value —
equal neutrals do not guarantee that a row's two halves share a type or a
range. Any failure rejects the entire command with a message naming the key,
and nothing is written: no partial batch.

A no-op leaves the target untouched, does not write `resolved.json`, and fans
out to nothing; it exits 0. It still reads the resolved values, since that is
how it establishes there is nothing to do. Otherwise: one mutation of the
target layer, one `writeResolved`, and one `fanOut` over the union of keys
written or removed, so each affected sink runs at most once — several affected
sinks mean several runner calls, one each. Today's section reset takes the store lock, resolves, and
reloads the compositor once per overridden key — around twenty-five times for
the Focus rack. Same button, one reload. The result is the same except where
Section 4's counting fix applies: a hidden override in the target is now
removed too, which is the point of that fix.

Success prints nothing, like `set` and `unset`.

## Section 4: the panel

### First, a counting fix

`markLayers` defines `overridden` as `param.layer == model.target`
([`panel.luau:176`](../../integrations/noctalia-plugin/panel.luau)). That is
"the value comes from where a write would land", which is not the same question
as "does the target hold this key". A base override hidden by a wallpaper
answers no to the first and yes to the second: today it is neither counted by
the section reset nor offered a live row reset, yet `prism reset defaults`
would remove it.

`describe` therefore emits **`heldInTarget`** per parameter — true when the
write-target layer holds the key — and the panel uses it for every reset count
and guard. `layer` and the shadow rules are untouched: a hidden base override
becomes both *shadowed* and *overridden*, its row reset lights up, and the
shadow hint still says where the visible value comes from. That is a behaviour
change to the per-row reset as well as the section one, and it gets its own
test.

`updateParam`'s companion guard goes with it. It currently marks a row
overridden only when the row is not shadowed, on the reasoning that a write
under a shadow lands somewhere nothing can see. Under `heldInTarget` that is
simply false: the write does land in the target, and the target does now hold
the key. A write marks the row overridden unconditionally, and the plugin
contract note's sentence to the contrary is corrected with it.

### The three buttons

Each section header carries them beside its existing controls; a panel-wide row
carries the same three under the wallpaper header, above the first section.

| Button | counts | full strength when | tooltip |
|---|---|---|---|
| restore | keys the target holds | count > 0 | `Reset section (N); values fall back to the layer beneath` |
| symmetric | pairs whose halves differ | count > 0 | `Mirror focused onto unfocused (N)` |
| neutral | eligible keys not at neutral | count > 0 | `Neutralize section (N)` |

Inert tooltips name the reason: `No overrides in this section`, `Focused and
unfocused already match`, `Section is already neutral`. The panel-wide row
draws the same three buttons with the same counts taken over every visible
parameter, and says `everything` where a section's tooltip says `section`. The restore tooltip
says "fall back to the layer beneath" rather than "to defaults" because
removing an override in a profile can reveal a wallpaper or base value, not the
def default.

The symmetric button renders only on sections that have matrix rows, so the
Glass section never draws one. That is structural — it depends on the defs, not
on any value — so it does not violate the rule that nothing appears or
disappears as a value crosses its default.

The panel-wide row is an ordinary button row. `prism-284a61`'s dice will sit in
it when it arrives; no placeholder and no extension mechanism now.

Glyph names for the two new buttons are checked against Noctalia's icon set
before they are written. `restore` is known good; the other two are not
guessed.

### Row identity in the panel

Section 1 lets two groups reuse a row label. `Presentation.sections` does not:
it keys `rowsByName` on `param.ui.row` alone and raises `row X spans sections A
and B` on reuse ([`presentation.luau:179`](../../integrations/noctalia-plugin/presentation.luau)).
Left alone, the defs would accept a model the panel then rejects, and a
defs-only test would not catch it. `sections` keys rows on `(group, row)` to
match. The `row X spans sections A and B` error then becomes unreachable — two
groups sharing a label now build two independent rows — and goes, along with
the `row.section` bookkeeping that fed it. The case it guarded against is still
caught: each of those rows must carry both states or trip the existing `row X
has no focused parameter`. `M.rack` needs no change: it
filters to the rack's group before building its `rows` table, so it is already
group-scoped. Section 5 covers this with a rendering and counting test, not a
defs test.

### Plumbing

`Queue.argvFor` gains `reset`, carrying `mode` and an optional `group`;
`affectsParams` is true for it, so the model is re-read once the batch drains,
like every other parameter write. One click is one queued command.
`validateModel` gains the checks in Section 1's contract note.

## Section 5: errors, testing, acceptance

Errors follow the existing rule: fail at load, name the def or the group, never
guess.

Node tests:

- `test/defs.test.js` — one case per rule in Section 1: both fields, neither
  field, `neutralize: true`, a `neutral` out of range, a `neutral` of the wrong
  type, an enum `neutral` outside `values`, a row whose halves disagree, and a
  row label reused across two groups loading cleanly.
- `test/glass-defs.test.js` — the curated table pinned value by value. The
  table is the design; a change to it should be a change to this test.
- `test/niri-render.test.js` — the sink's `DRY` agrees with the defs. Its
  entries name optics without a prefix, so each `<optic>: <value>` is checked
  against the `neutral` of both `glass.<optic>` and `glass.inactive.<optic>`.
  The check covers the keys `DRY` names; the enablers it deliberately says
  nothing about — `thickness`, `attenuationDistance`, `distortionScale` — are
  absent from it and stay that way.
- `test/cli.test.js` — the three modes; `--group` and its absence; `--base`
  beneath an overlay; an unknown group and a visible-parameter-free group; a
  no-op writing nothing and fanning out to nothing; the contents no-op from
  Section 3 — an unpinned wallpaper at `0.5`, base empty, neutral `0` — leaving
  `resolved.json` untouched and the runner uncalled; a symmetric copy rejected
  by the unfocused def's range leaving no partial write; a target that holds a
  shadowed override having it removed by `defaults`; and, via the injected
  `runner`, each affected sink called at most once per invocation.
- `integrations/noctalia-plugin/contract.test.mjs` — `describe` carries
  `neutral` or `neutralize` on every visible parameter and `heldInTarget` on
  all of them, and the real payload still renders.

Lua tests:

- `test/plugin-presentation.test.js` and `plugin_test.lua` — the three counts
  and their units, including a shadowed held override counting toward restore;
  the symmetric button absent from a section with no matrix rows; the panel-wide
  counts spanning groups; `neutralize: false` excluded from the neutral count;
  `Queue.argvFor` for `reset` with and without a group; and a model reusing one
  row label across two groups rendering and counting correctly, with the
  duplicate-label-within-one-group error preserved.

Docs: the plugin contract note
([`docs/notes/noctalia-plugin-contract.md`](../notes/noctalia-plugin-contract.md))
gains `reset` in its closed verb list, the section-header and panel-wide rows,
`neutral`/`neutralize`/`heldInTarget` in the describe shape, and the corrected
definition of "overridden".

Desktop acceptance is manual, as it was for the rack: repoint the plugin
symlink at the worktree, reload the plugin, then

1. neutralize **panel-wide**, not just the Focus section, and confirm the pane
   goes quiet with the survivors intact. Panel-wide is what takes the Glass
   section's `paneLip` and offsets to zero, and therefore the bevel with them;
   neutralizing Focus alone leaves the geometry tuned and cannot decide
   anything about it;
2. confirm the geometry did reach zero, then raise Refraction from that
   baseline and confirm it reads. This is the `paneLip` decision in Section 2:
   if refraction does not read against a zero bevel, `paneLip` moves to the
   enablers at its shipped `6`;
3. neutralize panel-wide again — step 2 has already raised refraction — then
   raise Blur and Directional blur and confirm they behave as Section 2
   predicts at `ior 1`, since they ride the refraction taps;
4. mirror a section with divergent halves and confirm parity;
5. reset a section to defaults with a wallpaper pinned and confirm one reload
   rather than a visible cascade.

## Out of scope

- **Undo.** No confirmation guards the neutral write; a general undo mechanism
  is `prism-b25061`.
- **Surfacing parameter interactions** in the panel: `prism-b315f9`.
- **Inherit-from-focused** for unset `glass.inactive.*`: `prism-7e4766`. It
  stays compatible — if it lands, symmetric's writes remain correct, merely
  redundant for the five level pairs.
- **Neutral as a layer or shipped context** you enter and leave. Considered and
  rejected: a one-shot write into the current target keeps the store's layer
  rules untouched and needs no answer to where an exploratory edit lands.
- **Bypass as the neutral mechanism.** It isolates whole devices at their
  current values, reaches no parameter outside the rack, and cannot give you a
  parameter brought up from zero.
- **A dice button** for randomization: `prism-284a61`.
