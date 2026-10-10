# Panel render within the host's callback budget

**Date:** 2026-10-10
**Status:** draft, awaiting owner review
**Task:** `prism-dac509` (absorbs the dropped `prism-5172ea`)
**Builds on:** `prism-dfbd7f` (one drag render per frame tick) and `prism-831604`
(`refresh` never renders; an unchanged describe is skipped), both recorded in
[the plugin contract](../notes/noctalia-plugin-contract.md).

## Intent

The Prism panel is disabled by the Noctalia host whenever its callbacks overrun the
per-callback CPU budget. With rack cards expanded, a single render now sits at or over
that budget, so ordinary slider work disables the panel within a minute. This change
makes a render's cost scale with **what changed** rather than with the size of the
whole tree, and keeps the heavy work of a changed describe out of the callback that
renders.

Success:

- In the running shell, with every rack card expanded, each of these callbacks costs at
  most 12 ms of thread CPU (under half the 25 ms budget): a drag's frame-tick render, a
  slider's `onDragEnd`, a describe that reports a changed model, and the render that
  follows it. A render that rebuilds nearly everything (the first describe after a
  plugin load, or a profile switch that changes most values) stays under 15 ms.
- The suite fails when render cost grows past a recorded ceiling, measured on real
  `prism describe` output.
- The panel looks and behaves exactly as before. Every rendered tree is identical to the
  tree a from-scratch render would produce.

## What the host does

These facts come from the Noctalia checkout the shell runs, read on 2026-10-10. The
budget code matches upstream.

- **Budget.** Each callback gets 25 ms of thread CPU (`CLOCK_THREAD_CPUTIME_ID`).
  That covers the whole `lua_pcall`, including time spent in bindings: `json.decode`
  and `panel.render`'s tree readback. Three consecutive overruns, or five within 60 s,
  mark the runtime unhealthy. From then on every event is dropped until the plugin is
  reloaded. The budget has no per-plugin setting. (`src/scripting/script_runtime.cpp`,
  `src/scripting/luau_host.cpp`.)
- **Metering overhead.** The budget interrupt reads the thread clock on every Luau call,
  return and loop back-edge. That syscall is why an in-host render costs about seven
  times what plain `lua` measures (`prism-831604`). Lua-side work is therefore what to
  cut, counted in calls and iterations.
- **`ui.*` constructors** are plain Luau that return `{type, props, children}` tables.
  **`panel.render`** walks the whole Lua tree inside the callback and copies every prop
  into a C++ node tree. That readback is roughly 1 ms for today's tree (`prism-831604`).
  The host then reconciles controls by `(type, key)` on the main thread, outside the
  budget.
- **No partial update exists.** Every `panel.render` replaces the whole tree. Nothing in
  the API patches one node or retains a subtree.
- **Deferral exists.** Each event gets a fresh budget. A panel can move work into the
  next `onFrameTick` (with `setNeedsFrameTick(true)`), and nothing else is needed.
- **A disabled plugin is reported once.** The host posts a "Plugin disabled"
  notification and logs a warning. The panel's last tree stays on screen and stops
  answering. Lua gets no flag or callback.

## Where the cost goes today

These are offline counts from the live describe (71 KB, 83 parameters, 12 rack devices),
taken with `debug.sethook` in Lua 5.4:

| Callback | Lua calls | ui nodes |
| --- | --- | --- |
| render, cards collapsed | 7.1k | 458 |
| render, every card expanded | 8.5k | 741 |
| drag frame tick / `onDragEnd` (expanded) | 8.5k | 741 |
| changed describe (expanded): validate + render | 12.0k | 741 |

On 2026-09-30 a render of about 5.6k calls measured 10–14 ms in-host. Today's renders
are 27–52% larger than that, which matches the observed overruns. A changed describe
adds the decode of 71 KB (it was 54 KB on 2026-09-30) and `validateModel` to a full
render, all in one callback. The last overrun before the 12:11 disable hit inside
`json.decode`.

Every render rebuilds every row, card and section, even when only one slider moved.
It also recomputes per-model facts that cannot have changed: the section and rack
structure, and per-slider metadata such as `stepPrecision`, `display` and the track
bounds. Those helpers alone are about 1.5k of the 8.5k calls.

## Approaches

**Chosen: a retained tree on the Lua side.** The panel keeps the subtree it built for
each row, card and section header. Each subtree carries a signature of the inputs that
shaped it, and is rebuilt only when that signature changes. A drag then rebuilds one
cell, its row, its section header and the edits row. The rest of the tree is the
previous render's tables, handed to `panel.render` again. The readback still walks the
whole tree, but in C++, without the interrupt. This is the only option that removes the
dependence on tree size, and the tree grows with every rack device.

**Rejected as the main fix: shrinking the tree and caching derivations alone.** Fewer
wrapper nodes per cell and a per-model structure cache would cut perhaps 25–35%. That
recovers today's margin but not the trend: the rack and the parameter set keep growing,
and every render would still pay for every row. The derivation cache is kept below as a
supporting part, because the cold render still needs it.

**Rejected: asking upstream to meter more cheaply.** Upstream could drop the clock read
on every safepoint, or let a plugin learn that it was disabled. That is worth reporting,
but it is not in Prism's hands. It is filed separately, prepared and not posted
(see Follow-ups).

## Design

### 1. Retained subtrees keyed by signature

A small memo module (`integrations/noctalia-plugin/retain.luau`) holds a map
`id → {signature, node}`. `retain(id, signature, build)` returns the stored node when
the signature is unchanged. Otherwise it calls `build()` and stores the result. Every
render also marks the ids it used, and ids a render did not use are dropped afterwards.
A card that leaves the rack, or a row that leaves the panel, therefore does not keep its
node.

The retained units are these:

- **Control cell**, one per parameter shown (`controlCell`).
- **Row**: single, matrix and card-head rows (`singleRow`, `matrixRow`, the card's head
  row). Each is built from its retained cells plus its own label, hint and wrapper
  nodes.
- **Card** (`deviceCard`) and **section header** (`sectionHeader`, including its reset
  buttons).
- **Top rows**: title, profile, wallpaper header, edits row.

The scroll root, separators and the children lists that assemble those units are
rebuilt on every render. They cost a few dozen nodes.

**A signature is a string built from the exact inputs the builder reads.** For a
control cell, that is the parameter's key, value, edited flag, `effectiveDrag`, gate,
attached color (key and effective value), effective color, and whether the cell holds
keyboard focus. A row combines its cells' signatures with its label, indent, hint
inputs (`fromWallpaper`, `effectiveDrag`) and hidden state. A card adds `expanded`,
`bypassed`, `silenced` and `attenuatedBy`. A section header adds the edited, symmetric
and neutral counts. Each builder and its signature function live side by side, so a new
input is added to both in one place.

Signatures compare content, not table identity. A describe therefore reuses every
subtree whose inputs it did not change, even though the decode produced fresh parameter
tables.

### 2. Handlers act on the current model, never on captured tables

A reused subtree can hold closures created against an earlier model. Today's handlers
capture parameter tables (`writeParam(param, …)`, `unsetParam(param)`, `resetAction`'s
list, `lightRow`'s `card.bypass`, `cardHead`'s `card`). After a describe, those tables
are stale.

Every handler therefore captures only identities, which are a parameter key, a device id
or a section name. It looks up the current object when it runs. The lookups go through a
per-model index (`byKey`, `cardById`, `sectionByName`) built when the model is accepted.
`beginDrag` already resolves by key this way. Values a handler would otherwise close
over, such as `expanded` in `cardHead`, are read from state at call time.

### 3. Per-model structure, computed once

When a describe is accepted, the panel computes and stores the following, and `render`
reads them:

- the **sections** and the **rack structure**: cards, row and key claims, `requires`
  links, interactions. `validateModel` already builds these to validate them, and
  today `render` builds them a second time.
- the **slider metadata** per parameter: bounds, step, precision, display and scale.
  These depend only on `range` and `ui`.
- the **lookup indexes** of part 2, and the slider walk order for keyboard focus.

Values change between describes (drags, toggles, resets), so the facts that depend on
values are recomputed on every render. Those are gates, attached swatches,
`bypassed`/`silenced`/`attenuatedBy` and the counts, and they are O(parameters).

Keyboard focus order is no longer collected as a side effect of building cells, because
a reused cell does not run its builder. It is derived from the structure and the gates:
visible sliders in render order, skipping hidden rows and collapsed cards' detail rows.

### 4. A changed describe renders in the next callback

`described` keeps the decode, the validation, `markEdits` and the model swap. It no
longer renders. It sets `state.renderPending` and requests a frame tick. `onFrameTick`
renders when a drag is dirty **or** a render is pending, and turns frame ticks off once
neither a drag nor a pending render remains. The decode and the render therefore never
share a budget. The describe error path also renders through the pending flag.

All other callbacks keep rendering synchronously: clicks, keys, `onDragEnd`, `onOpen`
and `finishWrite`. With retained subtrees each of these costs a handful of rebuilt
units, and keeping them synchronous preserves the slider-correction handshake in
`endDrag` and the existing tests' expectations.

### 5. A full rebuild, if it is still too dear

Retention does nothing for a render in which every signature changes. Part 3 is
expected to bring a full expanded rebuild from 8.5k calls to about 6.5k, near
the 5.6k that measured 10–14 ms in-host on 2026-09-30. The plan's first
measurement decides whether more is needed. If a full expanded rebuild measures over
15 ms in-host, the rebuild is spread over frame ticks. `render` runs as a coroutine that
yields after every few retained units, and `onFrameTick` resumes it. The previous tree
stays on screen, and its handlers stay live by part 2, until `panel.render` hands over
the finished one. Below 15 ms, this part is not built.

### 6. What does not change

The tree's shape, keys, props, the queue, the refresh cadence, the unchanged-describe
shortcut, and the one-render-per-frame drag throttle all stay as they are. No host or
API change is assumed.

## Testing

- **Equivalence.** A test helper renders twice, once retained and once after clearing
  the memo. It asserts the two trees are deeply equal, ignoring function identity. It
  runs after each scenario that changes inputs:
  - a drag and its release, a toggle, a select and a color write;
  - a revert, the three reset modes, a commit, a profile pick;
  - a gate opening and closing;
  - expanding and collapsing a card, focus moving, help toggled;
  - a describe changing one value, and a describe replacing the model with different
    structure.

  This catches a signature that misses an input.
- **Stale handlers.** After a describe replaces the model, the test invokes handlers
  from reused subtrees: a reset button, a toggle, a card light, a section reset. It
  asserts each acts on the current model's tables and enqueues the expected command.
- **Deferred describe render.** A changed describe performs no `panel.render`, and the
  next `onFrameTick` performs exactly one. With no drag and nothing pending, the frame
  tick is switched off. An error describe also reaches the screen on the next tick.
- **Cost ceiling, on real describe output.** `contract.test.mjs` already spawns
  `prism describe --json` against a temporary store and hands it to `panel.luau`. A new
  case does the same with every card expanded and counts Lua calls with `debug.sethook`
  for each scenario: cold render, drag frame tick, `onDragEnd`, a changed describe's
  validate, and its deferred render. It asserts each count is under a recorded ceiling,
  set at about 1.25× the measured count once the implementation lands. A new parameter
  or rack device that pushes a render past its ceiling fails the suite. Whoever raises a
  ceiling does so in the test, deliberately, with the in-host figure beside it.
- **In-host acceptance.** This repeats the `prism-831604` probe: a scratch copy of the
  plugin with `os.clock` + `noctalia.log` around each callback, the
  `~/.local/share/noctalia/plugins/prism` symlink pointed at the copy, and every card
  expanded. It measures a cold render, drag ticks, `onDragEnd`, a changed describe and
  its deferred render, and the render after a profile switch, and records the figures
  on the task. This step uses the live desktop, so it is asked for when it is reached.
  The symlink repoint is noted on the task and restored before the task is parked or
  closed.

## Error handling

A builder that raises still raises in the callback, exactly as today. The memo never
stores a node whose build failed. A describe that fails validation keeps the previous
model and its retained tree, and renders the error label on the next tick.

## Follow-ups (filed, not part of this change)

- **Upstream Noctalia:** check the upstream tracker first. Then prepare, but do not
  post, an issue covering two points: the per-safepoint `clock_gettime` makes interrupt
  metering a large multiple of the work it meters; and a plugin has no way to learn
  that it was disabled. Posting is the owner's call.
- **Panel notice of a stall:** the host's one-time notification is easy to miss. A
  panel-side heartbeat could tell the user to reload, but it cannot run while the
  runtime is disabled. Recorded as an idea only.
