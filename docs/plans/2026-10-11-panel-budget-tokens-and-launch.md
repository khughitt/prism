# Panel Budget Tokens and Launch Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Test whether compact metadata tokens reduce cold render cost and answer
the immediate-post-launch rendering question in the same proposed live session.

**Architecture:** Keep exact raw digests in the accepted structure; signatures use
short integer tokens preserved only by exact raw-byte equality. Keep Retain and
queue interfaces and all callback ordering. Compare frozen baseline and candidate
copies through fresh plugin runtimes, in two opposite-order blocks. A scratch-only
read-only launch experiment compares immediate and following-frame renders.

**Tech Stack:** Existing Luau panel, Lua 5.4 fake host and Node suite through
`just test-fast`; scratch Python builders/parsers and the existing Noctalia host.

**Spec:** [2026-10-10-panel-render-budget-design.md](../specs/2026-10-10-panel-render-budget-design.md),
Part 5 approved by owner on 2026-10-11, spec review round 4; reviewed content
commit `9c4a276`. The owner's two plan notes require pilot-derived duration and
reload/identity checks at every implementation swap.

**Status:** approved by owner 2026-10-11, plan review round 1. Three owner-authorized
brief corrections below require no further review round. Preserved execution
method: subagent-driven. This plan adds children of `prism-f15cbf` (original Task 6);
it does not reopen completed Tasks 1–5 or bypass original Tasks 7–8.

## Global Constraints

- "full/cold/profile rebuild medians must be **<15 ms**, and drag, release,
  changed-describe and deferred-render medians must be **≤12 ms**, each with at least
  five in-host samples and zero budget errors."
- "Check these targets separately for each candidate block; pooling cannot hide a failed block."
- "The tree's shape, keys, props, the queue, the refresh cadence, the unchanged-describe
  shortcut, and the one-render-per-frame drag throttle all stay as they are."
- "A full-rebuild median ≥15 ms returns to design before any further production code,
  including a metadata helper refinement."
- "A passing cold result cannot compensate for slow release."
- `endDrag` keeps its existing synchronous corrected render and reconciliation guard.
- Host budget remains 25 ms thread CPU per callback; three consecutive or five
  overruns in 60 seconds disable the runtime. Luau `os.clock` is elapsed time, an
  upper bound, and must not be reported as measured thread CPU or GC duration.
- Work in existing locked `.worktrees/panel-budget`, branch `fix/panel-render-budget`.
  No new worktree, dependency, production module, public export or host patch.
- Repository tests use only `just test-fast`; no `test-one` exists. Scratch-only
  assert-based probe/parser calibration is an experiment, not a replacement suite.
- Each task uses the tasks CLI, `trial-arm` after start, a conventional commit and
  its own implementer/reviewer gate. No AI attribution. `tasks check` must have
  zero errors; report every warning. Do not stage other tasks' records.
- Plan approval permits repository execution, not live desktop use. Each pilot,
  extended run or retry needs permission at that moment. Keep an installed probe
  until explicit owner completion/stop; an estimate is never a cutoff.

## Review Focus

1. A rejected/drag-invalidated describe must not allocate accepted tokens or prune
   retained entries (Task 1: mapping snapshots around existing lifecycle cases).
2. An optimistic close float must invalidate without a new describe digest
   (Task 1: mutate the current accepted value, retain raw digest, compare signatures).
3. A removed/reintroduced entry or a close/reopen cannot alias an old token
   (Task 1: explicit lifecycle checks, current-map bounds and parent-hit reuse).
4. A stale runtime after a plugin swap must never contribute samples
   (Task 2: fake swap/identity assertions; Task 3: per-activation nonce and fresh-state gate).
5. Early completion, an input-changing callback, a failed launch or missing class
   must not yield a false paired result or acceptance
   (Task 2: scripted timelines and numeric boundary fixtures; Task 3: completeness gate).

## Files and task boundaries

Production changes: `integrations/noctalia-plugin/panel.luau` only. Behavioral
coverage: `integrations/noctalia-plugin/plugin_test.lua`, existing encoder fixture
unchanged. Retain, queue, presentation, contracts and manifests keep their APIs.
Documentation: this plan, the existing spec's review status, and the original
plan's continuation pointer. Measurements are copied into task attachments only
through `tasks attach`, with host paths redacted and frozen raw input retained.

Scratch work uses a directory created with `mktemp -d -t prism-budget-ab-XXXXXX`.
It holds `baseline-plugin/`, `candidate-plugin/`, `build-probes.py`, `self-check.lua`,
`analyze.py`, `self-check-analysis.py`, `identity.json`, `session.json` and frozen
logs/results. Tasks 2–3 return the actual scratch path in their reports. Do not
commit fresh scripts into the product or copy attachments by hand.

All task-local SDD briefs/reports live in
`.superpowers/sdd/2026-10-11-panel-budget-tokens-and-launch/`; its ledger links the
original `.superpowers/sdd/2026-10-10-panel-render-budget/progress.md`, including
that workspace's outstanding rulings and deferred minor findings. The controller
reads both at final whole-branch review. Neither workspace/worktree is removed here.

### Task 1: Compact exact-equality metadata tokens

**Files:** modify `integrations/noctalia-plugin/panel.luau` and
`integrations/noctalia-plugin/plugin_test.lua`.

**Interfaces:** consume `state.structure.digest`, `.ids`, `validateModel`, accepted
`described` branch, `Retain.keep` and current signature helpers. Produce private
`assignContentTokens(structure)` and `structure.contentToken[key] → integer string`.
No production test accessor: the Lua test host can inspect `onOpen`'s state upvalue.

- [ ] **Step 1: Freeze the baseline before changing code.** Controller records
  `git rev-parse HEAD` as `baselineCommit` in the ledger. That is the last complete
  pre-token implementation, not the main checkout or an old instrumented probe.
  Record hashes of the six production plugin files and preserve their bytes with
  `git archive` or `git show <baselineCommit>:<file>` into scratch during Task 2.
  Do not modify the shared launcher or run the desktop.

- [ ] **Step 2: Add RED token lifecycle cases to `plugin_test.lua`.** Put the helper
  below `renderModel`, and the new block after the retained-tree checks. Use fresh
  copies so `markEdits` never mutates the raw fixture between equal describes.

```lua
local function acceptedStructure()
  local index = 1
  while true do
    local name, value = debug.getupvalue(onOpen, index)
    assert(name ~= nil, "fixture: onOpen has no state upvalue")
    if name == "state" then return value.structure end
    index = index + 1
  end
end

;(function()
  host.copies = true
  renderModel(layeredModel())
  local first = acceptedStructure()
  assert(first.contentToken ~= nil, "accepted structure has compact content tokens")
  local tokens = host.copy(first.contentToken)
  local distinct = {}
  for key, token in pairs(tokens) do
    assert(token:match("^%d+$"), "token is an integer string")
    assert(not distinct[token], "distinct keys have distinct tokens")
    distinct[token] = true
    assert(first.digest[key] ~= nil)
  end
  described(host.describeOk())
  assert(acceptedStructure() ~= first, "new decode produces fresh structure")
  equal(acceptedStructure().contentToken, tokens, "equal raw bytes preserve tokens")

  local original = tokens["glass.ior"]
  model.params[3].budgetProbeMetadata = true
  described(host.describeOk())
  local changed = acceptedStructure().contentToken["glass.ior"]
  assert(changed ~= original, "an arbitrary raw field changes its token")
  model.params[3].budgetProbeMetadata = nil
  described(host.describeOk())
  assert(acceptedStructure().contentToken["glass.ior"] ~= original, "A-B-A allocates anew")

  local removed = table.remove(model.params) -- debug.backdrop, no layout dependency
  local oldRemovedToken = tokens[removed.key]
  described(host.describeOk())
  equal(acceptedStructure().contentToken[removed.key], nil, "removed key leaves current map")
  model.params[#model.params + 1] = removed
  described(host.describeOk())
  assert(acceptedStructure().contentToken[removed.key] ~= oldRemovedToken)
  local count, digestCount = 0, 0
  for _ in pairs(acceptedStructure().contentToken) do count = count + 1 end
  for _ in pairs(acceptedStructure().digest) do digestCount = digestCount + 1 end
  equal(count, digestCount, "token storage is bounded by current entries")

  local retainedTokens = host.copy(acceptedStructure().contentToken)
  package.loaded["./retain.luau"].clear(retainedMemo())
  onKey("F1", true); onKey("F1", true)
  equal(acceptedStructure().contentToken, retainedTokens, "memo clear keeps labels")
  onClose(); onOpen({}); described(host.describeOk())
  equal(acceptedStructure().contentToken, retainedTokens, "close/reopen keeps labels")
  model.params[3].budgetProbeMetadata = "after reopen"
  described(host.describeOk())
  assert(tonumber(acceptedStructure().contentToken["glass.ior"]) > tonumber(changed))
  host.copies = false
end)()
```

Run `just test-fast`; expected new Lua failure is the missing `contentToken` map.
Save output. Do not fabricate a RED result for existing passing safeguards.

- [ ] **Step 3: Implement the private allocation operation.** Add the counter near
  `memo`, and the helper before `described`. In its successful, non-invalidated
  acceptance branch call the helper immediately before `markEdits(model)`.

```lua
local contentTokenCounter = 0

local function assignContentTokens(structure)
  local previous = state.structure
  local tokens = {}
  local nextToken = contentTokenCounter
  for key, digest in pairs(structure.digest) do
    if previous ~= nil and previous.digest[key] == digest then
      tokens[key] = previous.contentToken[key]
    else
      local before = nextToken
      nextToken = nextToken + 1
      assert(nextToken > before, "content token counter must increase")
      tokens[key] = string.format("%d", nextToken)
    end
  end
  structure.contentToken = tokens
  contentTokenCounter = nextToken
end
```

Replace the two digest payload reads in `cellSignature`, the return in
`deviceDigest` (rename to `deviceToken` and update both callers), and the toggle
payload in `sectionHeaderSignature` with `.contentToken`. Keep raw encoding in
`buildStructure`. Do not change any dynamic signature inputs, order/separators,
`sig(value)`, builder, eviction, handler, queue or render scheduling.

- [ ] **Step 4: Pin rejected and invalidated publication, plus optimistic precision.**
  Extend existing invalidated lifecycle test around `rawDescribed`:

```lua
local previousStructure = acceptedStructure()
local previousTokens = host.copy(previousStructure.contentToken)
rawDescribed(host.describeOk())
assert(acceptedStructure() == previousStructure)
equal(acceptedStructure().contentToken, previousTokens, "mid-drag describe cannot publish tokens")
```

Add a separate malformed-model result after a loaded valid fixture, restore the
raw fixture afterward, and assert the structure object and token map stay identical:

```lua
local validModel = model
local previousStructure = acceptedStructure()
local previousTokens = host.copy(previousStructure.contentToken)
model = { params = {} }
rawDescribed(host.describeOk())
assert(acceptedStructure() == previousStructure)
equal(acceptedStructure().contentToken, previousTokens, "rejected describe keeps token map")
model = validModel
described(host.describeOk())
```

Replace the old precision case that changes the describe with this accepted-value
case inside the existing retained/fresh-equivalence block, after its "expanded rack"
step while that card is expanded. The state helper resolves the current `onOpen`
on every call, so `renderModel` reloads cannot leave it holding an old state:

```lua
local structure = acceptedStructure()
local param = structure.byKey["glass.roughness"]
local rawDigest = structure.digest[param.key]
param.value = 0.1 + 0.2
onKey("F1", true); onKey("F1", true)
local before = retainedMemo().entries["c:" .. param.key].signature
param.value = 0.3
onKey("F1", true); onKey("F1", true)
assert(retainedMemo().entries["c:" .. param.key].signature ~= before)
equal(structure.digest[param.key], rawDigest, "precision change has no new raw digest")
retainedMatchesFresh("optimistic value differs past the fifteenth digit")
```

Extend the existing metadata-case loop: snapshot raw tokens, apply each mutation,
accept, assert the relevant parameter/device token changes, then run its existing
tree-equivalence assertion. Cover attached-color `from`, the attenuating device
label, and order/identity with fresh copied fixtures; reuse the existing current-model
handler, removal, collapse/reexpand and parent-hit reach tests. No counter injection
or artificial exhaustion case. Run `just test-fast`; expected green Node and Lua.

- [ ] **Step 5: Self-review, review and commit the candidate.** `tasks check` and
  `just check` clean; diff only the two production/test files and this child record.
  Close child in its commit: `perf(panel): compact retained metadata signatures`.
  Controller dispatches the independent task reviewer and follows corrective gates.
  Record accepted candidate commit and hashes; this is an unaccepted performance
  candidate, not a Task 6 passing claim.

### Task 2: Build and validate the matched probes and verdict

**Files:** scratch files listed above; task attachments/reports through CLI. No
production changes, live launch, shared pointer mutation or forced GC.

**Interfaces:** consume frozen `baselineCommit`, reviewed `candidateCommit`, approved
spec, existing test encoder and saved-model fixture. Produce isolated plugin copies,
unique `(variant, sourceCommit, sourceHash, activationNonce, block, phase)` identities,
one event schema, a saved fake-host self-check, `analyze.py` with `decide` and
`estimate_minutes(pilot)`, and phase timestamps. Task 3 reuses that single estimator.

- [ ] **Step 1: Build two copies from exact commits with identical instrumentation.**
  Builder inputs are `--baseline`, `--candidate`, `--cli` (explicit worktree bin),
  `--output` and unique activation nonce; it reads files with `git show` and asserts
  each transformation anchor occurs once. Hash uninstrumented bytes in `identity.json`.
  Both copies receive the same probe patch apart from their source and identity.
  Preserve a transform diff. Refuse any `getfenv`/`setfenv`, UI-constructor wrapping,
  trace observer, heap sampling or host API-table mutation. Existing source modules
  remain byte-identical. A transient start control disappears before the first
  measured tree; no diagnostic control or prop appears in any selected sample.

  Use direct assignment of callback globals and explicit private wrappers. Instrument
  the successful describe-acceptance branch with an acceptance flag/generation;
  record unchanged/rejected/invalidated results separately. Record profile generation
  at the existing profile handler; its deferred render gets `profileRender`, while
  ordinary accepted changed responses get `deferredRender`. Cold setup tags its
  nested describe as `coldSetup`, never an ordinary changed describe. Dirty drag
  samples require a real render; idle ticks/loading trees cannot fill classes.

  Time callback totals and render totals for target classes, plus native launch
  for launch pairs. In `run`, time only the `noctalia.runAsync` call after
  constructing its command; the outer `launchMs` below also includes helper work
  and is reported separately as run-helper elapsed time.
  Buffer timing/metadata until after the timed region and flush outside it in a
  separate diagnostic callback; record flushing as observer overhead, not target data.
  Callback-id zero and incomplete spans are excluded explicitly, never paired by guess.
  Preserve the original callback return values and original release/correction path.

  Token baseline uses the normal private raw signature path; candidate uses tokens.
  Every command uses the explicit worktree CLI path in scratch copies; do not change
  host PATH, launcher, services or shared includes. For an argv, copy before replacing
  its first element with the builder's CLI path so queue data cannot be mutated.

- [ ] **Step 2: Install scratch-only cold and paired-launch actions.** Cold action
  snapshots `state.shownStdout`, clears the memo **and clears `state.shownStdout`**
  before passing the saved output to `described` in a setup callback. This bypasses
  the unchanged-output shortcut so it decodes, validates and accepts fresh entries.
  It renders only in the next frame. Repeat
  five pairs for full measurement, one for pilot. Require fresh decoded table identity;
  no metadata prewarming, no extra UI nodes and no writes. Finish before starting
  another class. Stop the sequence with a diagnostic failure if input changes.

  The earlier key-triggered cold probe did not capture its key action. Use one
  visible scratch-only "Sample diagnostics" button during readiness. Its click hides
  the control, then requests the next callback; never run a measured render in the
  removal callback. An automatic finite sequence first collects cold pairs, then
  launch/control pairs if enabled for this activation. It leaves controls hidden
  for manual releases/profile work. A reload supplies the next activation's button.
  The measured tree must equal the production tree after removal. Alternate launch
  and no-launch trials, reverse their order between variants, and start each pair
  in a separate callback only after the preceding command and frame are complete.
  Both immediate and following-frame samples therefore use frame callbacks; the
  no-launch frame/frame control matches that source. Actual releases/completions
  retain their normal native event sources. The launch operation calls the existing
  `run` helper. Its core order is:

```lua
local pair -- scratch-only state, not part of rendered inputs
local function beginLaunchPair(id, control)
  assert(pair == nil and state.drag == nil)
  assert(state.queue.inFlight == nil and not describeRunning)
  pair = {id = id, control = control, pending = not control, frameDone = false,
    model = state.model, enqueued = state.enqueued}
  if not control then
    local started = os.clock()
    local ok = run({"prism", "describe", "--json"}, function(result)
      pair.pending = false
      -- Record result/identity and await frame; never decode or accept stdout.
      if pair.frameDone then pair = nil end
    end)
    local launchMs = (os.clock() - started) * 1000
    -- Queue launchMs after the timer; failed launch invalidates this pair.
    if not ok then pair = nil; return end
  end
  render() -- timed immediate render, after run returns in this same callback
  panel.setNeedsFrameTick(true)
end
```

  In the diagnostic `onFrameTick` wrapper perform exactly one timed pair render
  before ordinary no-op tick work, record whether completion is pending, and mark
  `frameDone`. Clear the pair only when both the frame and command callback finish;
  a control has no completion to await. Restore normal frame-tick needs using
  `syncFrameTick`. Refuse overlapping pairs. Never render before launch in the same
  callback. Completion failure, launch failure, malformed metadata or interference
  invalidates the pair; preserve raw records and reason. Capture all render-input
  change callbacks (including rejected describes/error state, input focus and ticks
  that launch a refresh); model-reference/enqueue equality alone is insufficient.
  Cold/ordinary samples are isolated from unfinished diagnostic commands.

- [ ] **Step 3: Write RED fake-host timeline assertions, then calibrate the probe.**
  Reuse the scratch host from saved launch/cold self-checks with runtime paths
  passed as arguments, not hardcoded host paths. Both variants must produce trees
  deeply equal to their corresponding uninstrumented render ignoring functions.
  Assert the key action produces this ordering, with one command and no model/queue
  changes:

```lua
local decodesBefore, enqueuedBefore = decodes, state.enqueued
local function sameTimeline(expected)
  assert(#timeline == #expected)
  for index, event in ipairs(expected) do assert(timeline[index] == event) end
end
sameTimeline({"comparison-launch", "render"}) -- immediate callback
env.onFrameTick(16)
sameTimeline({"comparison-launch", "render", "render"})
assert(decodes == decodesBefore) -- comparison stdout is never accepted
assert(state.enqueued == enqueuedBefore)
```

  Script both completion-before-frame and completion-after-frame; a no-launch pair;
  failed launch; failed completion; an intervening changed/unchanged/error describe;
  a focus, expansion or optimistic-value change; and attempted overlap. Assert only
  valid, same-input pairs survive and pending/done states are separate. Cold checks
  require five separate setup/render callbacks, five fresh model tables, no setup
  render, and exactly production-equivalent expanded trees. Assert that replaying the
  exact previously shown output still increments decode/accept counts, replaces the
  model and structure with fresh tables, and rebuilds retained units from the empty
  memo; a mere timestamp or done marker is insufficient. In the saved 12-card fixture
  the test-only trace must record all 142 cold units. Verify original `endDrag`
  function body and queue ordering are unchanged by the transform.

  Fake activation test feeds an old nonce, wrong variant/hash, then a new valid nonce.
  Parser must refuse the first two; a new runtime must have empty memo and initial
  model/enqueued/drag/queue state before the first describe. Closing/opening without
  disable/enable is deliberately not a reset and must fail the activation test.
  Run saved scratch self-check commands; use lint on each copy without loading it
  into the live desktop. Reports include exact commands and results.

- [ ] **Step 4: Implement numeric verdict functions and their assertions.** Normalized
  event JSON stores activation identity, callback id, class, elapsed ms, rendered,
  accepted, pair id, pending state, interference and monotonic timestamp. Parser
  rejects malformed/duplicate records; groups by activation/block/variant/class and
  never pools blocks. Preserve all samples, exclusions and completion-state groups.
  The core numerical rules are:

```python
from statistics import median

CLASSES = ("coldRender", "dragTick", "release", "changedDescribe",
           "deferredRender", "profileRender")

def spread_limit(values):
    center = median(values)
    return max(1.0, median(abs(x - center) for x in values))

def decide(blocks, budget_errors, correct=True):
    if len(blocks) != 2 or any(
        len(block.get(v, {}).get(k, [])) < 5
        for block in blocks for v in ("baseline", "candidate") for k in CLASSES
    ):
        return {"comparison": "inconclusive", "accepted": False, "return_to_design": True}
    gain = all(
        median(b["baseline"]["coldRender"]) - median(b["candidate"]["coldRender"])
        > spread_limit(b["baseline"]["coldRender"])
        for b in blocks
    )
    regression = any(
        median(b["candidate"][k]) - median(b["baseline"][k])
        > spread_limit(b["baseline"][k])
        for b in blocks for k in CLASSES if k != "coldRender"
    )
    keep = gain and not regression and correct and budget_errors == 0
    absolute = all(
        median(b["candidate"][k]) < 15.0 if k in ("coldRender", "profileRender")
        else median(b["candidate"][k]) <= 12.0
        for b in blocks for k in CLASSES
    )
    return {"comparison": "keep" if keep else "revert",
            "accepted": keep and absolute,
            "return_to_design": not (keep and absolute)}
```

  Assertions use complete two-block fixtures: constant baseline 20/candidate 18
  cold yields keep (strict gain 2>1); candidate 19 at equality yields revert;
  `[18,19,20,21,22]` has threshold 1; `[16,18,20,22,24]` has threshold 2;
  gain equality at 2 reverts; gain in only one block reverts. A non-cold median
  rise exactly at threshold passes no-regression, above threshold reverts. Missing
  any class/block is inconclusive **and `return_to_design=True`**; any budget error or correctness failure cannot
  keep. Median cold/profile exactly 15 fails; the other classes exactly 12 pass;
  one good block cannot hide another failing block. A maximum outlier without a
  changed median does not decide keep. Keep with cold 18 is still unaccepted.

  Pair fixtures assert five valid pairs in the same frame-completion state, paired
  subtraction using actual sample ids, separate controls, and incomplete/inconsistent
  identities rejected. Five pairs split between two states have no primary aggregate.
  Fake rotated logs reconstructed from a saved offset plus next segment must reproduce
  exact events, including first sample and final drain. Use Task 3 Step 3
  as the exact pilot-time schema/function/fixture; the controller supplies that
  focused cross-task excerpt as `pilot-timing-contract.md` for the Task 2 worker.

- [ ] **Step 5: Review and preserve readiness artifacts.** Attach the builder,
  calibration/parser scripts, identity/transform manifest and portable readiness
  report through the CLI. Independent reviewer checks pair ordering, flush overhead,
  classification, numeric boundary cases, fresh runtime evidence and no host side
  effects. Close child with `test(panel): validate matched budget probe protocol`.
  No live pointer changes or timing verdict. Controller owns fresh permission.

### Task 3: Pilot, measure both blocks and restore live state

**Files:** scratch session manifest, raw logs and parsed results; task attachments and
task notes through CLI; spec/plan evidence status after results. Only a required
candidate revert may change production, with a fix subagent and green suite.

**Interfaces:** consume reviewed Task 2 readiness artifacts and approved source
commits and Task 2's `estimate_minutes(pilot)` function. The controller owns desktop
permission, owner prompts, swaps/restoration
and live capture; the Task 3 implementer owns frozen analysis/artifacts, with no
independent host mutation. Produce pilot pace/estimate, four independently verified activations,
two block comparisons, paired launch/control reports, restoration evidence and an
explicit keep/revert/inconclusive plus accepted/unaccepted result. Completion of
this measurement child does not automatically close original Task 6.

- [ ] **Step 1: Prepare without taking the desktop.** Check for an existing suitable
  nested Noctalia plugin host; the Lua fake host alone is not in-host acceptance.
  Verify CLI path with `command -v`, use the explicit worktree bin for probe commands,
  and inspect original plugin link. Prepare snapshots of exact runtime/scratch,
  active profile, raw profile document bytes and canonical values under the existing
  store lock. Preserve any newer independent wallpaper on restoration. Pick two
  existing profiles P/Q with materially different canonical values; verify that both
  directions change most values. If none qualify, report scope limitation before
  requesting a run; cold memo clearing is not a substitute.

  Save owner-held scratch exactly, clear only with the explicitly approved test
  setup, and choose unedited sliders from the fresh snapshot. Do not reuse the old
  list of edited keys from a prior session. Never restore redundant scratch using
  CLI set: it normalizes them. Use guarded existing runtime read/write functions
  under lock, byte-equal profile guards and exact scratch assertions. CLI writes and
  profile switches drain before snapshot comparisons or pointer changes.

- [ ] **Step 2: Request a fresh pilot and run the smallest complete protocol.**
  Request approximately ten minutes initially, explicitly as a pilot estimate:
  four reload/expansion activations, one cold pair, one two-second drag/release and
  restore, and one P→Q→P cycle per activation; one launch/control pair per variant;
  analysis and exact restoration. Owner approval is required at this moment. If
  declined, park with the prepared next action; do not use the previous probe's yes.

  Run pilot B1→C1→C2→B2, following the swap checklist below each time, including
  C1→C2's fresh reload. This exercises reverse order and every collection gate.
  Pilot report must say insufficient samples/inconclusive, never acceptance: its
  n=1 cases do not relax the original n≥5 rule. Parser boundary fixtures supply the
  numerical verdict-path calibration. Read the completed pilot before requesting
  an extended run. A refusal/abort/budget error is analyzed before a retry; restore
  state, record it, and request fresh permission rather than continuing automatically.

- [ ] **Step 3: Derive the full-session duration from the pilot.** Save monotonic
  phase timestamps, including user action/settling time, reload/expansion, pair waits,
  analysis and restoration. The estimate covers at least 20 real releases plus their
  restores, 24 real profile switches (three P→Q→P cycles per activation), 20 cold
  renders, ten launch pairs and ten no-launch controls, four activation checks and
  exact setup/restoration. Diagnostic pair timers include command-completion waits.

Task 2 implements this function once in its scratch analysis module; Task 3 calls
that implementation with the recorded pilot JSON, rather than copying the formula.

```python
from math import ceil
from statistics import median

def estimate_minutes(pilot):
    seconds = pilot["setupSeconds"] + pilot["restoreSeconds"] + pilot["analysisSeconds"]
    for activation in pilot["activations"]:  # measured B1,C1,C2,B2
        seconds += activation["reloadExpandSeconds"]
        seconds += 5 * activation["coldPairSeconds"]
        seconds += 5 * activation["releaseRestoreSeconds"]
        seconds += 3 * activation["profileRoundTripSeconds"]
    seconds += 10 * median(pilot["launchPairSeconds"])
    seconds += 10 * median(pilot["controlPairSeconds"])
    return ceil(seconds * 1.25 / 60)  # named 25% settling/recollection allowance
```

  Fixture: setup=30, restore=30, analysis=30; each of four activations has
  reloadExpand=10, coldPair=2, releaseRestore=6, profileRoundTrip=8; launchPair=2,
  controlPair=1 → 520 seconds with allowance → 9 minutes. Report the actual pilot
  measured total and resulting estimate, not this illustrative fixture. Split user
  hands time from total desktop occupancy. Permission request names all phases,
  their counts, plugin/profile changes, the pilot and its verdict, and the computed
  duration. A larger estimate is not silently replaced with "about fifteen minutes".

- [ ] **Step 4: Apply the swap checklist at every activation.** It is mandatory
  even for consecutive activations of the same implementation:

  1. Wait for `queueIdle=true`, `describeRunning=false`, no drag or pending pair, all
     comparison callbacks complete, log buffers flushed, and restored test slider.
     Return to P with empty test scratch. Save/freeze the outgoing activation's log
     and phase boundaries. A failed drain stops sampling; no pointer change first.
  2. Close panel and disable `khughitt/prism`; changing a symlink or close/open alone
     does not prove a new Luau runtime. Record what/from/to/restore in the task note
     at each pointer mutation. Preserve the original link throughout the session.
     The controller uses the established CLI commands, only after fresh host approval:

     ```bash
     noctalia msg plugins panel-close khughitt/prism
     noctalia msg plugins disable khughitt/prism
     # Controller performs and records the approved scratch-pointer swap here.
     noctalia msg plugins enable khughitt/prism
     # Wait for enable/export readiness before opening; marker verification follows.
     noctalia msg plugins panel-open khughitt/prism
     ```

  3. Build/install the selected scratch copy with a fresh activation nonce and
     expected variant/commit/source hash in its startup marker. Change only the
     already approved plugin link, enable the plugin, await enable completion, then
     open panel. Never repoint a shared CLI launcher to the worktree.
  4. Verify `readlink -f` resolves to this copy, its manifest hashes match the frozen
     source, and the new log marker names the expected nonce/variant/commit/hash.
     At module initialization marker must report memo empty, no accepted model,
     zero enqueued writes, empty queue, no drag/pending pair or pending render.
     Reject any sample with an old/missing nonce or mismatched identity. Record the
     initial marker separately; runtime state naturally changes during opening.
  5. Wait for controls, owner expands every rack card, verify all 12 device ids (or
     fresh snapshot's exact ids) expanded, P active, canonical starting values and
     scratch match the block reference, then emit readiness/start boundary. Memo
     may now be warm; explicit cold action creates fresh entries/empty memo. Only
     after this readiness gate may target-class samples contribute.

  Warm-up/loading, identity checks and expansion clicks are never cold samples.
  Do not reuse memo, structures, tokens, pending writes or callbacks across runtimes.
  Restore P, test scratch and canonical reference before the next activation. If
  independent wallpaper/profile changes alter the reference, mark interference;
  do not silently absorb it into only one implementation's data.

- [ ] **Step 5: Run the freshly approved extended session.** Obtain the Step 3
  permission, then take fresh snapshots/offsets and use four activation phases:

  | Block | Order | Per activation | Additional paired diagnostic |
  | --- | --- | --- | --- |
  | 1 | baseline → candidate | five colds; five two-second release/restores; three P→Q→P cycles | five launch pairs and five controls on each variant |
  | 2 | candidate → baseline | five colds; five two-second release/restores; three P→Q→P cycles | no additional pairs needed if Block 1 groups are complete |

  Each class has its own window/ids. Collect ≥5 accepted changed describes and ≥5
  following non-profile deferred renders per activation from actual write/restores;
  cold nested describes are excluded. If the actual writes do not supply enough,
  identify the short class and ask for fresh permission for additional actual
  release/restore actions while that activation remains valid, or report inconclusive.
  Extra actions are not authorized merely by the 25% timing allowance. Classify profile-activation
  changed describes explicitly; never mislabel their deferred profile render as
  an ordinary deferred render. Record release corrections and write completions.

  Require five valid pairs in one completion-state group for each variant and its
  corresponding controls. Invalid pairs retain raw records/reason. A short group
  needs fresh permission before recollection; keep the current probe installed while
  asking, and do not swap or close it based on the estimate. An extension/retry also
  needs fresh permission. Log rotation is tracked by inode/offset and archived
  segments; never use a fixed-length tail. Preserve first samples and every startup
  marker. Owner confirms each phase before its pointer is changed; a time estimate
  cannot cause early closure. Report pace/status while the owner has the desktop.

- [ ] **Step 6: Freeze, check completeness, drain and restore before parking.**
  After explicit completion/stop, parse while the probe can still report its final
  drain. If data are short, report the exact missing classes/states, without another
  automatic run. Wait all real writes, describes and diagnostic commands complete.
  Close/disable, restore original pointer, enable main plugin, verify link/reload
  and exact saved profile/scratch/raw profile documents/canonical values, preserving
  latest independent wallpaper. Never overwrite unrelated concurrent profile edits;
  stop with the specific conflict for the controller/owner. Record all restoration
  checks and `host-load --section session`; no detached child is left running.
  Redact machine paths in attachable logs, asserting measurement/identity records
  unchanged; keep original raw files. Attach frozen input, scripts, JSON and report.

- [ ] **Step 7: Apply verdict, review evidence and record disposition.** Use Task 2
  rules and report each block's sample lists, MAD/threshold, medians/maxima, keep and
  absolute targets. Report the launch pairs/controls separately, with exclusions,
  completion state and limitations. Tokens cannot receive credit for an unresolved
  command-adjacent effect. A supported scheduling hypothesis needs a new design;
  never defer the entire release render or change queue order under this plan.

  Complete gain/no-regression failure requires reverting the isolated token commit
  with a fix subagent, `just test-fast`, `just check` and a scoped independent review;
  record the revert commit. Incomplete evidence is inconclusive, with candidate
  explicitly unaccepted and parent still open **with `return_to_design=True`**;
  the controller prepares the next evidence-grounded design revision before any
  further production code or another owner review gate. Useful retained candidate plus a
  failed absolute target returns to design before further production code. Controller
  drafts the next evidence-grounded revision before an owner review gate, rather
  than parking agent-owned design work as if it awaited the user.

  Close this measurement child with the actual result after its evidence review,
  in the evidence commit. Original `prism-f15cbf` closes only when `accepted=true`,
  the required launch/control groups and identity checks are complete, and exact
  restoration is verified. That unlocks Tasks 7–8 of the original plan. Continue original SDD and final whole-branch
  review, including original ledger findings; no merge/push/PR is authorized here.

## Self-review and handoff

All approved Part 5 requirements map to Tasks 1–3; the owner notes map to Task 3
Steps 3–4. Review Focus cases map to explicit test/fixture steps. No acceptance
ceilings, host implementation change or speculative scheduling fix is included.
Owner plan approval is recorded; controller resumes in the existing worktree, creates
SDD task briefs from this plan, and dispatches Task 1 with its baseline frozen.
User execution choice remains subagent-driven; do not ask them to choose it again.
