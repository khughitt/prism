# Panel render within the host's callback budget

**Date:** 2026-10-10
**Status:** original design approved by owner 2026-10-10 (review round 2: accept); Tasks 1–5 implemented. Part 5 revised and approved by owner 2026-10-11 (review round 4: accept). Task 6 acceptance and Tasks 7–8 remain gated. Plan: [docs/plans/2026-10-10-panel-render-budget.md](../plans/2026-10-10-panel-render-budget.md)
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
  plugin load, or a profile switch that changes most values) stays under 15 ms. Each
  figure is the median of at least five in-host samples of elapsed time (see In-host
  acceptance), and the session adds no budget errors to the host's log.
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
the signature is unchanged. Otherwise it calls `build()` and stores the result.

The retained units are these:

- **Control cell**, one per parameter shown (`controlCell`).
- **Row**: single, matrix and card-head rows (`singleRow`, `matrixRow`, the card's head
  row). Each is built from its retained cells plus its own label, hint and wrapper
  nodes.
- **Card** (`deviceCard`) and **section header** (`sectionHeader`, including its reset
  buttons).

The top rows (title, profile, naming or confirm, wallpaper header, edits row), the
scroll root, separators, and the children lists that assemble the units are rebuilt on
every render. They read panel state that a signature would have to mirror field by
field, and they cost about 40 nodes.

**A signature has two parts: what describe said, and what the panel changed since.**

- *What describe said* is a digest per parameter and per rack device. When a describe
  is accepted, it is the entry as decoded, serialized with `noctalia.json.encode`,
  before `markEdits` adds the panel's own fields. The digest covers every field
  describe sends, not a chosen list. Range, step, display, scale, exponent, unit, select
  values, label, description, `ui.when`, `effective` with its `from`, a device's label,
  family and interactions: a change to any of them changes the digest. If the encoder's
  key order ever differed between two equal entries, the cost is a needless rebuild,
  never a stale node.
- *What the panel changed since* is the short list of fields the panel writes or derives
  between describes. For a parameter that is `value` and `edited`, which drags, writes,
  resets, commits and profile picks set optimistically, plus its derived gate and
  whether it holds keyboard focus. For a cell with an attached color, it is that
  color's digest and value. For a card it is `expanded`, `bypassed`, `silenced`, and
  the ids and digests of the devices in `attenuatedBy`, whose labels the card prints.
  For a section header it is the edited, symmetric and neutral counts, the section's
  color index, and its header toggle's digest and value.

A builder reads a parameter or device only through those two parts. It may read any
describe field, because the digest covers them all, and only the listed panel-side
fields. A builder that needs a new panel-side field adds it to the signature in the
same change. The equivalence test below catches a builder that does not.

Part 5 proposes replacing raw digest payloads in signatures with compact labels backed
by exact equality; the coverage and dynamic inputs above remain binding. That revision
is not implemented or approved yet.

**Signatures are composed bottom-up, and every render computes all of them.** A cell's
signature comes first. A row's signature is its own inputs (label, indent, hidden
state, hint inputs) plus its cells' signatures. A card's signature is its own inputs
plus its rows' signatures. So a change anywhere below a unit changes that unit's
signature, and an unchanged unit is returned whole, its descendants included. The
signature pass is string work over every unit, about 1–1.5k calls per render,
building no nodes.

**Eviction follows the model's structure, not each render.** A parent cache hit skips
its children's `retain` calls, so "unused this render" would wrongly evict descendants
still on screen. Entries are therefore dropped only when a describe is accepted. Any
id that the new structure no longer contains goes: a parameter key, a device id, a
section name or a row label. Within one model the set of ids is fixed. Detail rows of
a collapsed card stay cached, which bounds the memo by the model's size.

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
  These depend only on `range` and `ui`; the existing weak-key cache computes them
  lazily on first use of each accepted parameter table.
- the **lookup indexes** of part 2, the slider walk order for keyboard focus, and the
  **digests** of part 1.

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

### 5. Compact metadata tokens

**Review state:** approved by owner 2026-10-11, review round 4. The continuation
plan was approved in round 1 and its token/probe tasks are implemented and reviewed;
the candidate is not performance-accepted. Parts 1–4 and the original
acceptance targets remain binding. This section replaces the previous speculative
full-rebuild candidates. It selects one small experiment, with a measured keep or
revert decision; it does not claim that the experiment will meet the targets.

**2026-10-12 pilot status:** the first baseline activation was stopped after an
independent wallpaper change invalidated its matched reference. Its exploratory
cold/release samples were 17.959/19.539 ms (one each), with zero budget errors and
one valid launch/control pair. The other three activations and profile class were
not sampled; this supplies no acceptance, keep/revert or causal conclusion. Exact
profile/scratch/raw documents were restored and the latest wallpaper preserved.
The owner now requires automatic rotation paused before each capture and its prior
runtime state restored on completion or abort. The incomplete evidence is recorded
on `prism-4ba651`; no full-session duration can be derived from it.

**2026-10-13 stabilized pilot status:** all four n=1 activations completed with
rotation paused and prior host state restored. B1/C1/C2 records are complete, but
C2 lacks its Q deferred profile render. B2 lost 1,096 records through collector
inode reuse; preserved fragments cannot establish complete evidence. Actual
desktop occupancy was 95.976 minutes. The collector fix and incomplete disposition
are independently reviewed: `accepted=false`, `return_to_design=true`, with no
complete full-session estimate. Original performance thresholds and keep/revert
rules remain binding. The [capture-recovery design](2026-10-13-panel-budget-capture-recovery-design.md)
is proposed for written owner review before another protocol is planned or run.

#### Evidence prompting the revision

The latest diagnostic, run `1791735860`, measured production-equivalent trees
with all 12 cards expanded. Cold setup/decode ran in separate callbacks from
five cold renders; the diagnostic button disappeared before measurement. Five
actual slider releases and ten write completions were also captured. There were
zero budget/error-level log lines. The original plugin was restored; the active
profile, exact scratch, all 23 profile documents and canonical values were verified
unchanged, with no restoration write needed.

| Callback | Samples | Median / maximum elapsed ms |
| --- | ---: | ---: |
| Cold render | 5 | 19.869 / 22.271 |
| Dirty drag tick | 182 | 7.969 / 11.060 |
| Release | 5 | 20.661 / 24.007 |
| Write completion | 10 | 20.6045 / 23.514 |
| Changed describe | 11 | 8.657 / 10.389 |
| Deferred render | 11 | 8.532 / 9.567 |

The last two classes are ordinary post-cold responses selected by callback type
and duration; they are not assigned one-to-one to a particular write. Profile
switching remains unmeasured. Luau os.clock measures elapsed time, an upper bound
on thread CPU. Timing/heap instrumentation still adds observer overhead, so this
is diagnostic evidence rather than clean-production acceptance.

Cold assembly median was 15.479 ms, versus 1.491 ms in native tree readback.
The long release interval moved between the top, presentation and assembly phases.
All releases had positive net heap deltas of 295–298 KB; cold deltas included both
increases and decreases. Net heap change does not measure allocation throughput
or GC duration, and these figures do not identify a CPU, GC, allocator or
scheduling cause.

A saved-model Lua 5.4 profile counted 9,742 cold calls and 3,514 warm calls;
warm and release renders had zero retained misses and similar call volume.
Signatures currently copy full JSON digests through cells, rows, card heads,
cards and headers on every render. That source-visible work is the first target.
The warm button/frame comparison found no consistent button penalty. A read-only
launch comparison rendered before launch and in a later frame, leaving immediate
same-callback post-launch rendering and actual write/apply effects unresolved.

The frozen report, all samples, portable log and reproducible parser are attached
to `prism-f15cbf`:
[latest report](../../tasks/files/prism-f15cbf/cold-release-1791735860-report.md),
[offline call profile](../../tasks/files/prism-f15cbf/offline-call-profile-report.md).
Earlier diagnostics remain task evidence; they do not establish acceptance.

#### Two separate performance questions

The token experiment targets **cold construction**, whose 19.869-ms median misses
<15 ms and whose assembly dominates the measured cost. It is not the proposed
solution for slow release or write completion. Tokens also shorten warm signatures,
but no evidence shows that this explains or removes their additional elapsed time.
Do not attribute the entire 295–298 KB net heap increase to signatures.

Release and completion had similar retained-render work to fast warm/drag renders,
yet their callbacks took about 20.7/20.6 ms. Native tree readback also increased:
release median 3.240 ms and completion 2.9195 ms, versus cold 1.491 ms. Tokens do
not change that C++ traversal. In the current source, `endDrag` can enqueue and
launch before rendering; `finishWrite` can launch the next write, or a drained
refresh, before rendering. A post-launch effect extending through multiple phases
is a plausible separate hypothesis, not a measured cause. The next proposed live
session must answer the immediate-post-launch question alongside the cold token
comparison, rather than postponing it until after token acceptance.

#### Decision and alternatives

**Selected: compact tokens backed by exact raw-digest equality.** Keep the current
string signatures and Retain interface. Replace only their metadata digest payloads
with short tokens allocated when accepted content changes. Test their effect on
cold construction without adding another equality engine. Release/completion
remain a separate measurement question in the same proposed live session.

Immutable signature snapshots could remove more concatenation, but require new
vector comparisons, allocation and lifetime rules. They are deferred until the
smaller payload change has been measured. Command/render reordering and staged
construction are also deferred: their effects are unproved, and they introduce
new ordering, failure and interleaving behavior. The queue and synchronous release
correction retain their existing order.

#### Exact token algorithm and lifecycle

Keep `structure.digest` as the full raw-string map encoded before `markEdits`.
Add `structure.contentToken`, plus a private monotonically increasing token
counter that lives as long as the panel runtime. For an accepted candidate:

1. Validate and encode the model exactly as today. Rejected or drag-invalidated
   describes leave the live token map and retained entries untouched.
2. For each candidate digest key, compare its full raw bytes with the same key in
   the previous accepted structure. Reuse its token exactly when the bytes match,
   regardless of decoded table identity.
3. Otherwise allocate a distinct compact token string from the next integer,
   formatted as an integer with `%d`. Distinct keys receive distinct tokens even
   when their content matches. Tokens contain no signature delimiters. There is
   no hash, metadata whitelist, truncation or table-identity comparison.
4. Build the candidate map and next counter locally. Publish them only after the
   complete operation succeeds, before swapping the accepted model. Tokens are
   never recycled or reset. A single assertion that the next integer is greater
   than the current counter is sufficient; there is no overflow recovery protocol,
   injectable counter or exhaustion test seam. A failed construction leaves the
   previous accepted model, map, memo and counter intact.
5. Keep only the current candidate's keys. Do not intern historical digests or
   recycle tokens on removal, memo clearing, close/reopen or model replacement.
   Removed and reintroduced keys get new tokens. A → B → A can also get a new
   token: historical node reuse is not promised.

Use tokens in `cellSignature` for parameters and attached colors, in device
signature inputs including `attenuatedBy`, and in `sectionHeaderSignature` for its
toggle. Keep every current panel-side input, field order and separator unchanged,
including `sig(value)`'s 17-digit numeric precision. Equal raw bytes preserve
retention; a changed arbitrary metadata field changes the token. Encoder key-order
changes can still cause a harmless rebuild, never a stale hit.

`Retain.keep(memo, structure.ids)` still runs only at accepted-model replacement.
Parent hits keep descendants, including collapsed detail rows. Persistent token
storage is bounded by the current structure, with no describe-history dictionary.
Retain and queue APIs, handlers, exports, manifests and host configuration do not
change. Full encoding and signature traversal still occur; this proposal reduces
payload size rather than promising fewer calls or a particular millisecond gain.

#### Correctness and scope

Production changes are confined to `integrations/noctalia-plugin/panel.luau`;
behavioral tests extend `plugin_test.lua`. The existing encoder fixture and real
model harness remain the reference. Documentation and the implementation plan
are updated through their review gates. No new dependency or module is needed.

Tests must demonstrate retained/fresh tree equivalence, current-model handlers,
unchanged FIFO and refresh behavior, and exactly the existing synchronous release
correction. Add cases for equal fresh entries; arbitrary metadata changes;
attached-color and attenuating-device identity; reordered children; removal and
reintroduction; A → B → A; rejected/invalidated describes; collapse/reexpand;
close/reopen and memo clear; distinct integer token formatting. No artificial
counter-exhaustion scenario is required.
The numeric-signature regression must change an optimistic value after acceptance,
so a changed describe digest cannot conceal lost precision. Use the repository's
`just test-fast` front door and retain all existing queue/lifecycle coverage.

#### One live session, two measurements

Implement and review the token change alone after the written spec and plan are
approved. A saved-model comparison of signature sizes and builder misses checks
the mechanism; offline timings and call counts do not establish live acceptance.

Before an extended live run, pilot both the cold comparison and post-launch pair
through parsing and a verdict. Obtain fresh live-desktop permission at that moment,
naming both measurements and their expected duration. Use matched baseline and
candidate inputs, minimal callback timing and production-equivalent measured trees;
keep phase/heap tracing in separate diagnostics. Preserve exact saved state and
restore the original plugin before ending the approved session.

Run **two matched baseline/candidate blocks in that session**, baseline then
candidate in block 1 and candidate then baseline in block 2. Each implementation
gets at least five cold samples per block: fresh parameter tables and an empty
memo, separate setup/decode callbacks, no metadata prewarming, identical expanded
cards and model content. Record the sample lists, medians, maxima and block order.
Do not use the earlier instrumented diagnostic as the matched baseline.

Also collect the original target classes, including actual slider releases, changed
describes, deferred renders and real profile switches that change most values,
with at least five samples per class per implementation in each block. A same-model
memo clear does not substitute for a profile switch. Write completions and native
release-correction behavior are additional diagnostics. Record interference and
budget errors; incomplete classes cannot establish acceptance.

**Post-launch comparison, during the same session:** collect at least five valid
pairs on both baseline and candidate. In one callback launch a read-only
`describe --json` through the existing process helper, then render immediately
before returning; request one identical render on the next frame. Do not also
render before launch in that callback. The diagnostic completion callback does
not accept stdout or change the production queue/model. Include matched no-launch
callback/frame pairs as the control, so an ordinary callback/frame difference is
not mistaken for a launch effect. Measure the native launch separately from each
render total, and record whether completion was pending or had already occurred
at the frame. Require five valid pairs with the same completion state for a primary
aggregate; report the other state separately. Finish the read-only command callback
before starting another pair or a cold comparison, so diagnostic launches cannot
contaminate those later measurements.

Use the same retained memo and all render inputs within a pair. Verify production
shape and input equality in the scratch-host self-check; record intervening describe,
write, model/value, focus, expansion or other render-input changes and exclude
contaminated pairs from paired aggregates while retaining their raw records. Never
force GC, postpone normal queue work or alter production release/completion ordering.
If fewer than five valid pairs survive, mark the launch question inconclusive rather
than inferring a result from unmatched medians. Actual writes/apply and pointer
release remain separate contexts even if a read-only launch reproduces the delay.

Report immediate-minus-frame render differences for each valid pair, their median
and maximum, alongside the no-launch controls. A repeated post-launch excess with
fast next-frame/control renders supports a scheduling investigation. It does not
prove thread CPU cost, isolate the process mechanism or authorize a queue change.
A negative read-only result leaves the actual write/release question unresolved;
report that limitation in this session's results rather than treating tokens as
its solution. A supported deferral proposal needs a revised written design and
plan that preserve FIFO and the synchronous `endDrag` correction handshake; simply
deferring the complete release render would violate that existing constraint.

#### Numeric keep/revert rule and original acceptance gate

For each matched block, define the baseline spread as **MAD**:
`median(abs(sample - baselineMedian))`, in milliseconds. The minimum meaningful
gain is `max(1.0 ms, baselineMAD)`. Keep the token candidate only when its **cold
callback median is lower by strictly more than that gain in both blocks**.
Correctness and builder reach must also remain unchanged, with zero new budget
errors. Signature/heap shrinkage alone never satisfies the rule.

For each other measured target class, use its own baseline MAD and the same
1.0-ms floor. A candidate median higher than baseline by more than that threshold
in either matched block fails the no-regression condition. The recorded maximum
alone does not decide regression. If any required class/block is incomplete,
report the comparison as inconclusive and return to design; do not declare the
candidate retained on performance grounds. If the two complete cold comparisons
fail the gain rule, or any complete target comparison fails no-regression, revert
the token experiment before further production changes.

Keeping a useful candidate is **not** Task 6 acceptance. The original gate stays
strict: full/cold/profile rebuild medians must be **<15 ms**, and drag, release,
changed-describe and deferred-render medians must be **≤12 ms**, each with at least
five in-host samples and zero budget errors. Check these targets separately for
each candidate block; pooling cannot hide a failed block. A full-rebuild median
≥15 ms returns to design before any further production code, including a metadata
helper refinement. A passing cold result cannot compensate for slow release.
Use the same-session launch evidence when drafting the separate release/completion
revision if needed. Tasks 7–8 and offline ceilings remain gated.

Flattening repeated slider metadata getters is a possible later revision: cold
profiling counted 552 metadata getter calls and 244 display wrappers, while warm
rendering called none. It could address cold construction but cannot explain the
slow warm release. It is not included in this implementation experiment; it needs
new evidence and the written review gates if the token experiment fails.

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
    structure;
  - describes that change only metadata with every value unchanged: a slider's range,
    step, display, scale and unit; a select's values; a label and a description; an
    effective color's `from`; a device's label, family and interactions.

  This catches a signature that misses an input. Test hosts get a deterministic
  `json.encode`.
- **Retention reach.** Two unchanged renders run no builder on the second. A drag on
  one cell then runs exactly the builders on its path: that cell, its row, its card
  when it is in the rack, and its section header only if a count changed. A third
  render after the drag hits for every sibling row and cell of that card, which proves
  a parent hit did not evict its descendants.
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
  on the task. In Luau, `os.clock` is elapsed monotonic time, not the thread CPU time
  the host meters, so each figure is an upper bound. The targets apply to the median of
  at least five samples per callback, with the maximum recorded beside it. The host's
  own meter is the authority: the session must add no "exceeded its CPU budget" lines.
  The cold render runs on freshly decoded entries with an empty memo, so it includes
  the per-entry metadata work. This gate runs before the offline ceilings are recorded. This step uses the live desktop, so it is asked for when it is reached.
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
