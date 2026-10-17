# Panel Budget Capture Recovery Implementation Plan

**Status:** superseded 2026-10-17. The owner closed the panel-budget pilot with one short in-host comparison instead (prism-f15cbf, attachment short-comparison-report.md); its Task 6 and Task 7 were dropped with prism-111a3f, and its run state deleted. The text below is the record as it stood.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The owner selected subagent-driven execution earlier; preserve that choice.

**Goal:** Obtain trustworthy staged cold/launch evidence before spending owner time on full panel acceptance.

**Architecture:** Extend the reviewed scratch probe and parser, not production rendering. One incremental collector runs in an isolated named tmux server, independent of Codex command lifetime. The controller owns the headless turn-boundary rehearsal and all permission, pointer, profile and rotation actions; workers prepare and analyze immutable artifacts.

**Tech Stack:** Python 3 standard library, existing fake-host calibration with installed Lua/luac5.5.1, Luau scratch plugin, bash/tmux 3.8, existing Node store helpers and Noctalia IPC. No new dependency or host configuration.

**Spec:** [approved capture recovery design](../specs/2026-10-13-panel-budget-capture-recovery-design.md), owner spec round 3 accept. **Plan status:** accepted in owner-supplied plan review round2; the three minor points are folded into execution below. Desktop use still requires fresh permission at its named gate.

**Parent:** `prism-111a3f` under original Task 6 `prism-f15cbf`. Original Tasks 1–5 remain complete; Tasks 7–8 remain gated. This plan does not authorize merge, push, PR or publishing.

## Global Constraints

- "Cold/profile medians must be <15 ms; drag, release, changed-describe and ordinary deferred-render medians must be ≤12 ms." ≥5 eligible samples per implementation per block, zero complete-session budget errors; never pool blocks or implementations.
- "Evaluate the table in order; the first matching row wins." Complete cold evidence requires both blocks, complete identity/reference/integrity/correctness evidence and complete error counts. Unknown is not zero.
- Stage 1: B1→C1→C2→B2, five colds each; five launch pairs and five controls on B1/C1. No owner slider/profile actions. A smallest n=1 pilot precedes the five-sample run.
- Stage 2 is conditional on both cold gain and <15-ms gates plus complete launch/control groups. It recaptures its own colds in fresh runtimes; Stage 1 colds never fill Stage 2 classes.
- Gain is strictly >max(1 ms, baseline MAD) in both blocks. Stage 2 checks each other target's regression against its own same threshold. A failed complete cold gain comparison requires token revert; a cold absolute failure returns to design without a keep claim.
- "One combined, owner-approved replacement packet per activation." At most one extra unit of each needed type; missing records, changed reference, budget errors and identity faults cannot be repaired with new samples.
- Profile dwell ≥5 s and Prism values changed; release/restore dwell ≥2 s. Last P click gets the same dwell before chat. Opening renders never fill a deferred/profile class.
- Named tmux only, fresh socket `prism-budget-capture-<run-nonce>`, default server untouched. Initial card ≤1200 s, recovery ≤600 s, live collector ≤2100 s; controller allowance ≤300 s. Fixed headless watchdog2700 s and producer≥2400 s are rehearsal-only.
- Poll interval ≤min(2 s,T/4), allowed gap ≤min(10 s,T/2), T=file-fill time at max(4 MiB/min, actual full burst rate). Record poll/checkpoint intervals and report overlaps without sample deletion/subtraction.
- Automatic expansion, observers and diagnostic controls are administrative. Preserve measured production tree shape, original queue order/periodic ticks/ordinary frame priority and synchronous endDrag correction. No GC forcing or production API/module change.
- A real next controller turn requires **Keith's message after the 45-minute watchdog**. No child/process exit is assumed to wake Codex. Park that rehearsal waiting on user and name that action.
- New captures use schema2, new transformed hashes/nonces and explicit worktree CLI. Old schema1/r2 archives and used nonces stay frozen; use their frozen parser solely for historical evidence.
- Reviewers remain read-only, return full review text in their final message, and never write reports. Controller persists `<slug>-report.md` and verified identity. Independent task reviews precede dependent work; no live action by a worker.

## Review Focus

1. Append crashes or source mutation between polls must invalidate provisional capture instead of publishing a complete receipt: Task 1 fault fixtures.
2. Close/reopen or P-before-Q acceptance must not create valid profile/deferred samples: Task 2 timelines.
3. One complete failing block alongside missing cold/error evidence must not revert production: Task 3 ordered-decision fixtures.
4. Late recovery approval must not silently shorten the promised card: Task 4 deadline fixtures.
5. Collector/process disappearance while the controller is between turns must be detectable from durable receipts without a wake assumption: Task 5 real-boundary rehearsal and cleanup fixtures.

## Workspace and frozen inputs

Reuse locked `.worktrees/panel-budget`; setup and production baseline were already verified there. At execution setup record `git rev-parse HEAD` as PLAN_BASE, verify source hashes still equal the frozen identities, and create this plan's own SDD workspace/ledger. Do not touch either older ledger except their controller-owned disposition notes; do not remove worktrees or scratch ledgers.

No scratch code is written during planning. At Task 1 execution define:

```bash
CAPTURE_STATE="${XDG_STATE_HOME:-$HOME/.local/state}/prism/panel-budget"
CAPTURE_ROOT="$CAPTURE_STATE/capture-recovery-2026-10-13"
PRESERVED="$CAPTURE_STATE/task3-2026-10-13-preserved"
```

`CAPTURE_ROOT/code/` is the new version's private code. Copy only these preserved inputs: `logs.py`, `log-check.py`, `state.mjs`, `state-check.mjs`, `rotation-guard.py`, `rotation-guard-check.py`, and `frozen-task2/`. Copy `model-private.lua` and matching `describe-private.json` (83 params/12 devices/23 profiles) into `CAPTURE_ROOT/private-fixtures/`, never into a public archive. Validate inputs against the sibling preserved manifest first; refuse missing or mismatched files. Make private directories0700/files0600; invoke scripts via interpreters. Never modify the preserved tree. New runs live at `CAPTURE_ROOT/runs/<unique-run-id>/` with exclusive creation.

Baseline source: `9bf4e8e920c005f8a4d1666b32b4e1a516856ac2`.
Candidate source: `e7384b0d7ab3e8e935cdf0776043839441132af5`.
Frozen artifacts remain reviewable in `tasks/files/prism-4ba651/task3-r2-evidence-and-collector-fix.tar.gz`. New task commits attach only portable code/calibration/report archives using `tasks attach`; private originals remain durable outside git. Each archive carries SHA256 inventory and exact measurement-payload equality proof. The reviewer receives archive plus matching private source paths and the full diff package; binary-only git diffs are not sufficient.

These are private calibration/self-check scripts, as in the prior approved experiment. Run their focused assertions with their interpreters and record outputs. Repository gates are `just check` and `tasks check`; package/source suites use `just test-fast`, never a runner directly. Repeat the package suite only for production source changes (including token revert), not unchanged scratch/document updates.

---

### Task 1: Incremental collector and cleanup-owned tmux lifecycle

**Execution:** complete through d20c9c0, independent task review plus scoped sealing-fix re-review accepted. Two Minor calibration-harness findings remain in the SDD ledger. No long rehearsal or live use yet.

**Files:** modify `CAPTURE_ROOT/code/logs.py`, `log-check.py`; create `capture.py`, `capture-wrapper.sh`, `capture-check.py`. Attach portable archive to this task.

**Interfaces:**

- `logs.start(log: Path, manifest: Path)` retains exclusive initial offset/generation creation.
- `Capture(manifest: Path)` owns open files, incremental hash and validated cursor. `poll() -> list[Path]` appends only new bytes; `checkpoint(reason: str) -> dict` fully validates archives/source prefixes. Reasons are `ready`, `rotation`, `settled`, `finish`.
- `capture.py run RUN.json` runs one interpreter/loop. `RUN.json` includes schema2, runId, socket, log, manifest, deadlineSeconds, pollSeconds, maxGapSeconds, clockOrigin, environment (`synthetic` or `live`), and control/receipt paths. Deadline is monotonic from `collectorStarted`; live2100 or headless-rehearsal2700 only.
- Atomic command file `{sequence:int,command:ready|finish|stop}`; reject replay/unknown sequence/command. `ready` requests a checkpoint, not a host action. `finish` performs a final full checkpoint and clean exit; the collector does not parse operation ids or certify panel settlement. The controller verifies Task2's `cardSettled` and operation-qualified drain before sending finish. `stop` produces incomplete evidence.
- Durable JSONL polls `{runId,start,end,clockOrigin,bytes,checkpoint:false|reason}`; heartbeat and terminal receipt include last poll/end, generations, exit reason, `integrityComplete` and recorded process identities. Clean finish with a successful checkpoint certifies capture integrity only; the controller/analyzer produces `protocolComplete` separately. Append failure, stop or unexpected exit cannot leave integrityComplete=true.
- Wrapper launches isolated `tmux -L SOCKET -f /dev/null`, explicit options, one `capture` session. Record server/wrapper/collector pids plus Linux start identities; EXIT/TERM/INT/HUP traps reap only recorded children. No controller restart is needed. `kill-server` targets only recorded socket. No `&`/nohup launch outside the named server.

- [x] **Step 1: Freeze inputs and write RED fixtures.** Copy/validate inputs as above. Extend original first-offset/A→B→A/rotation/idempotence checks. Instrument file reads to pin incremental work:

```python
# capture-check.py; tempfile synthetic log, no Noctalia or owner files.
log.write_bytes(b'ignored\n')
logs.start(log, manifest)
c = logs.Capture(manifest)
with log.open('ab') as f: f.write(b'first\n')
c.poll()
log.rename(log.with_name(log.name+'.1'))
log.write_bytes(b'')
c.poll() # validate/seal first occurrence; create the next generation
read_meter.reset()
with log.open('ab') as f: f.write(b'second\n')
c.poll()
assert read_meter.source_bytes == len(b'second\n')
assert read_meter.sealed_archive_bytes == 0
assert b''.join(p.read_bytes() for p in c.poll()) == b'first\nsecond\n'
assert c.checkpoint('finish')['integrityComplete'] is True
```

`read_meter` is this test's file-open/read spy (wrap existing real file handles; count actual `read` bytes, not calls). Add source same-inode copytruncate/regrowth, captured-prefix mutation, sealed archive mutation/missing archive, interrupted append-before-manifest and malformed generation fixtures. Each asserts checkpoint refuses without repairing evidence or setting complete=true.

- [x] **Step 2: Run focused RED.** `python3 "$CAPTURE_ROOT/code/capture-check.py"`; expect missing Capture/incremental-read assertion, preserve exit/output. Do not accept an import/path failure as the target RED.

- [x] **Step 3: Implement append/checkpoint state.** Keep generation paths `segment-{generation:06d}-{dev}-{inode}.raw`. Hash incremental appended bytes in memory; manifest saves length/end offset/digest. One loop owns writers. Poll validates identity/size/archive metadata and detects missing/multiple rotations. On rotation, fully compare outgoing source range to archived bytes before sealing; final checkpoint hashes every archive and current captured prefix. A crash/reopen validates all saved bytes once before resuming **offline investigation only**; live unexpected exit invalidates that activation, never resumes it into complete evidence.

```python
# Core poll order inside Capture, after identity/truncation validation.
source.seek(cursor['offset'])
delta = source.read(stat_size - cursor['offset'])
assert len(delta) == stat_size - cursor['offset']
archive.write(delta)
archive.flush()
hasher.update(delta)
cursor['offset'] += len(delta)
# Publish manifest after append; a failure between these steps is detectable.
# Full source-prefix comparison belongs to checkpoint/seal, not every poll.
```

Snapshot both descriptors with fstat around reads. If rename/second rotation makes them ambiguous, preserve and refuse. Treat poll-gap breach as incomplete even if bytes happen to be recoverable. Do not start a Python interpreter per poll. Loop logs every poll/checkpoint interval before/after work, on host monotonic origin; neither traffic nor failure changes host state.

- [x] **Step 4: Add wrapper ownership and seconds-long lifecycle smoke.** Refuse an existing socket. Use `exit-unattached off`, `exit-empty on`, `remain-on-exit off` and empty configuration; test those effective values. Wrapper enforces deadline and atomically emits exit receipt on normal finish, deadline and signals. The quick smoke starts one unique synthetic named server, receives `collectorStarted`, writes known startup/final bytes, sends finish, then asserts integrityComplete=true and no matching pids/socket remain. It needs no panel record schema. Separate smoke issues exact named `kill-server` and asserts wrapper/collector/synthetic producer all gone and incomplete receipt. Test live2100 expiry using injected monotonic clock, not a35-minute sleep.

- [x] **Step 5: GREEN, package and review handoff.** Run `capture-check.py` and inherited `log-check.py`; save commands/exits and file-read measurements. Quick smoke exercises all startup/finish/stop gates before any long rehearsal. Run `just check`, `tasks check`, `git diff --check`; attach the new code/proofs without private raw logs and commit conventionally. Park child on controller review, with no server/process/check running. Independent review verifies incremental work and integrity, not just happy-path collector receipts.

### Task 2: Expansion, operation-qualified readiness and unmeasured references

**Execution:** complete through bfb6e68; independent review and scoped recovery-reachability correction accepted. Exact runtime recovery-manifest and schema2 record contracts are in the private implementer report; valid-reference reason wording remains Minor in the SDD ledger. Owner-derived record maps remain private. No live use.

**Files:** modify `CAPTURE_ROOT/code/frozen-task2/{build.py,probe.lua,tail.lua,self-check.lua,analysis_check.py,integrity-check.py}`; create `probe-check.lua`. Attach portable probe/build calibration.

**Interfaces:** builder emits schema2 identity: stage (`stage1` or `stage2`), block1/2, environment, runId/cardId/nonce, source hashes, coldPairs1/5, launchPairs0/1/5 and clockOrigin. Every event retains existing callback/render fields and adds stage/card/operation/replacement ids; parser contracts are Task 3. Public production exports remain unchanged.

Every timed callback/render sample emits `startTimestamp` and `endTimestamp` on its declared clockOrigin. Capture them at the existing timing boundaries, with elapsedMs=(endTimestamp-startTimestamp)*1000. `timestamp` remains the later record-construction time; never infer target endpoints from it. Cold/launch/control intervals retain their existing exact endpoints. Observer measurements also identify their own interval and scope; they cannot fill target classes.

New records outside target timing:

- `ready`: exact expandedIds/rackIds, allRackExpanded, same settled flags as old ready; card/reference identity.
- `acceptedReference`: accepted generation/profile/wallpaper id, full canonical key/value map and `heldScratchKeys`, snapshot start/end. Compare map exactly, not hash-only. Keys come from `state.model.params`; use `Presentation.holds(param,'scratch')`, not an invented held-map shape.
- `operationDone`: links release/restore or profile action to accepted generation and actual ordinary/profile deferred callback/render ids. Closed/open render does not qualify. Early ignored P input creates no successful operation.
- `cardSettled`: lists actual requested operations and final eligible drain, no pending ordinary work/commands/pairs, buffer empty. Initial idle state cannot satisfy it. A replacement has its own operation ids and `replacementFor` list.

- [x] **Step 1: Establish schema2 capture, then write feature RED tests.** Extend the existing real fake host, which currently manually expands12 cards and captures only schema1 in `noctalia.json.encode`. First change that hook to capture schema2, explicitly reject schema1, and retain ordinary table encoding. Update the scratch emitter's schema plumbing and prove a known schema2 sentinel reaches h.emitted and a schema1 sentinel is rejected; these are fixture prerequisites, not the feature RED. Then deliberately click the sole diagnostics button with collapsed cards. Assert it expands exact current structure ids administratively, then emits ready on its own observer frame before new-model cold setup. The target RED is missing expansion/readiness behavior with working record capture, never an absent ready caused by schema filtering. Compare measured tree against normal production rendering with all cards expanded and controls hidden.

```lua
local h=host(base..'/'..variant..'/plugin',true,false)
local beforeDecode=h.decodes
assert(button(h,'Sample diagnostics')).props.onClick()
assert(countExpanded(h.state) == #h.state.structure.rack.cards)
assert(h.decodes == beforeDecode) -- no fresh cold decode in the click
h.tick()
assert(lastRecord(h, 'ready').allRackExpanded)
h.tick() -- setup, clear shownStdout and construct fresh model
h.tick() -- actual cold render
assert(lastRecord(h, 'coldRender').rendered)
```

Extend the local `host(dir,probe,expandCards)` helper with an explicit third boolean: false skips its current manual expansion loop; true preserves it for inherited cases. `h.tick`, `button`, `base` and variant are existing harness interfaces; never call `h.frame` (that field is the host's boolean subscription). Define local `countExpanded(state)` by counting true entries and `lastRecord(h,class)` by reverse-scanning emitted records and failing if absent; do not add product exports. Every delivered non-cold test describe uses a unique stdout string so the unchanged-result shortcut cannot skip it. Keep the existing pending-ready test (accepted ordinary describe just before click renders normally before observer/cold), 100-ms nondirty-drag flush cadence and periodic refresh cases.

- [x] **Step 2: Add race/reference RED cases.** Close before release response, then deliver accepted describe and reopen: no release-origin ordinary deferred operationDone. Repeat for Q: no profileRender or successful Q operation. Click P while Q selectionPending: existing production guard remains, no false P operation/ref. Supersede accepted Q before its administrative reference observer: mark missing/invalid reference; do not delay the new input. Collapse one card during a target window: that sample ineligible. Change one numeric/color/boolean reference field with same profile name: exact reference comparison fails.

- [x] **Step 3: Implement endpoints and observer additions.** In both `diagnosticCallback` (probe.lua) and the `render=function(...)` wrapper around `diagnosticPlainRender` (tail.lua), retain the start read and store the existing final clock read as `finished`; attach both endpoints outside the timed function. Preserve return packing and callback/render classification:

```lua
local started=os.clock()
local returned=table.pack(fn(...))
local finished=os.clock()
diagnosticEvent(diagnosticClass,(finished-started)*1000,
  {scope='callback',startTimestamp=started,endTimestamp=finished})
-- Preserve the wrapper's existing depth/frame handling and return unpacking.
```

Apply the same boundaries to render records with scope='render'. Fake-clock fixtures assert the exact endpoints, elapsed identity, and a later record timestamp without extending the target interval. Expand `state.structure.rack.cards` by assigning `state.expanded[card.device]=true` in the diagnostics administrative callback, hide its control and wait for ordinary pending work and readiness. Keep a separate dedicated reference observer outside described/render timing; normal queue/frame work has priority. Serialize `{[param.key]=param.value}`, sorted scratch-held keys and accepted generation. Record a missing reference when superseded; never capture the next generation under the old operation. Preserve byte-for-byte production endDrag and queue modules. All added flags are scratch-only.

- [x] **Step 4: Implement finite approved replacement administration.** One initial diagnostics sequence/card plus at most one combined recovery/card. The controller's approved recovery manifest names exact unit counts; probe exposes one administrative recovery button, hidden before target timing, or owner performs the listed release/restore/cycle. The probe does not consume permission automatically. A recovery does not allocate a new runtime nonce or claim an excluded original was valid. Source/input interference stops the finite diagnostic sequence while original callbacks continue.

- [x] **Step 5: GREEN on both source revisions, lint and freeze.** Give `probe-check.lua` the same four-argument contract as inherited `self-check.lua`; fifth argument selects the named calibration mode. Build both revisions with identical instrumentation, unique calibration nonces, explicit worktree bin path and synthetic clock label; no installs. Run:

```bash
# CALIBRATION is this task's exclusive generated two-variant directory;
# PRISM_CAPTURE_CLI is the resolved worktree bin/prism, set before building.
lua "$CAPTURE_ROOT/code/probe-check.lua" "$CALIBRATION" "$CAPTURE_ROOT/private-fixtures/model-private.lua" "$CAPTURE_ROOT/code/frozen-task2/test_encode.lua" "$PRISM_CAPTURE_CLI"
lua "$CAPTURE_ROOT/code/frozen-task2/self-check.lua" "$CALIBRATION" "$CAPTURE_ROOT/private-fixtures/model-private.lua" "$CAPTURE_ROOT/code/frozen-task2/test_encode.lua" "$PRISM_CAPTURE_CLI" pending-ready
noctalia plugins lint "$CALIBRATION/baseline/plugin"
noctalia plugins lint "$CALIBRATION/candidate/plugin"
luac -p "$CALIBRATION/baseline/plugin/panel.luau"
luac -p "$CALIBRATION/candidate/plugin/panel.luau"
```

Also run inherited modes `readiness`, `periodic`, `sequence` and the default no-fifth-argument run with those same four arguments; nondirty100ms cadence is covered by readiness/default, not a fictitious `raw100ms` mode. Run `integrity-check.py --copies "$CALIBRATION" --baseline-identity "$CAPTURE_ROOT/code/frozen-task2/baseline-identity.json" --candidate-identity "$CAPTURE_ROOT/code/frozen-task2/task-1-candidate-identity.json" --model "$CAPTURE_ROOT/private-fixtures/describe-private.json"` and reverse-transform checks. Preserve that historical fixture's23-profile check; live identities/ref maps use fresh actual counts. Package scripts, identities, literal commands/exits and payloads, run repository gates, commit and park on read-only review. All calibration processes end.

### Task 3: Ordered stage verdict, strict parsing, overlap and estimates

**Files:** modify `CAPTURE_ROOT/code/frozen-task2/analyze.py`, `analysis_check.py`; create `verdict-check.py`.

**Interfaces:** `decide(stage, blocks, evidence, launch_complete) -> dict`; blocks ordered1,2, each `baseline`/`candidate` maps target-class names to elapsed-ms lists. `evidence` has exact booleans integrity/reference/identity/correctness/error completeness, `correct` and budgetErrors (`None` only when unknown). Only live certified results reach the root acceptance record; synthetic fixture results are marked calibration.

`normalize` now accepts only schema2 with all identity/stage/card/operation fields, contiguous record ids through certified final drain and full callback endpoints. Stage1 has no required owner-heavy classes. Existing pair input/completion chronology and contamination exclusions stay binding. Historical schema1 is parsed only by its untouched frozen historical tool.

`estimate(stage,pilot)->int`: measured occupancy+clean analysis once, plus extra unit intervals below, 25% allowance and ceil minutes. Four activations required. No null/unknown or negative durations. Unit intervals include ordinary readiness waits, not just short render/launch bodies.

- [x] **Step 1: RED the production-changing boundary cases.** Use complete five-sample blocks and evidence, then remove cold/error facts separately:

```python
from copy import deepcopy
E=dict(integrityComplete=True,referenceComplete=True,identityComplete=True,
       correctnessComplete=True,errorComplete=True,correct=True,budgetErrors=0)
classes=('coldRender','dragTick','release','changedDescribe','deferredRender','profileRender')
blocks=[{v:{k:[10.0]*5 for k in classes} for v in ('baseline','candidate')} for _ in range(2)]
blocks[0]['baseline']['coldRender']=[14.0]*5
blocks[1]['baseline']['coldRender']=[14.0]*5
blocks[0]['candidate']['coldRender']=[14.0]*5 # complete failing block
short=deepcopy(blocks);short[1]['candidate']['coldRender']=[10.0]*4
assert decide('stage1',short,E,True)['comparison']=='inconclusive'
unknown=dict(E,errorComplete=False,budgetErrors=None)
assert decide('stage1',blocks,unknown,True)['comparison']=='inconclusive'
assert decide('stage1',blocks,E,True)['comparison']=='revert'
```

`E` is this fixture's explicit complete evidence object (all completeness flags true, correct=true, budgetErrors=0). Add exact gain1.0 failure versus1.000001 pass; candidate15.0 absolute failure;16-ms cold with meaningful gain returns to design without keep; cold pass/short launch returns inconclusive; complete pass transitions pending_stage2/accepted=false only. Incomplete runtime/unknown error/known errors/failed correctness never reach stage1 revert. Cover Stage2 unchanged full numeric decision with regression in either block and no pooling.

- [x] **Step 2: Implement stage1 ordered branch.** Validate types/enums early; completeness first, then gain, then absolute, then launch groups. Return the spec's exact fields/reasons. Stage2 retains full class completeness and original gain/no-regression/absolute checks; acceptance also needs Stage1 certified launch identity/group/restoration evidence. The schema validator must not supply defaults for unknown completeness flags.

- [x] **Step 3: RED strict records and recovery credit.** Missing startup/readiness/ref/callback end/drain, duplicate/gapped ids, wrong source or clock, partial JSON, fake initial drain, stale operation generation and ignored early P all fail certification. Two references with one changed canonical value fail equality. A valid combined recovery can fill release/deferred and Q deficits while exclusions/original losses remain; a second recovery cannot count. Missing two-plus cold units after one extra cold remains short. Reuse existing pending/done pair chronology mutation tests.

- [x] **Step 4: Implement exact overlap reporting.** Inputs use Task2's `startTimestamp`/`endTimestamp` and Task1's external poll/checkpoint `start`/`end` with same verified clockOrigin. Require finite ordered endpoints and elapsedMs matching their difference within serialization precision; missing/reversed endpoints fail certification. Never use record timestamp or arrival to reconstruct the interval. Interval overlap uses `max(starts)<min(ends)`; touching endpoints are not overlap. Fixtures sample[10,11], polls[9,10],[10.5,10.6],[11,12] yield one overlap. Report count, full sample lists and timing distributions per class/block, poll durations/bytes and checkpoint durations. No filters or cost subtraction feed decide. Clock mismatch fails live overlap gate rather than guessing by log arrival.

- [x] **Step 5: Implement and pin stage estimates.** Define pilot fields `occupancySeconds`, `analysisSeconds`, four activation coldUnitSeconds, and (stage2) releaseRestoreUnitSeconds/profileCycleUnitSeconds; stage1 also two launchUnitSeconds and two controlUnitSeconds. All include unit readiness waits. Initial card/chat/controller time occurs only inside measured occupancy once:

```python
seconds=pilot['occupancySeconds']+pilot['analysisSeconds']
seconds+=4*sum(a['coldUnitSeconds'] for a in pilot['activations'])
if stage=='stage1':
    seconds+=4*sum(pilot['launchUnitSeconds'])
    seconds+=4*sum(pilot['controlUnitSeconds'])
else:
    seconds+=4*sum(a['releaseRestoreUnitSeconds'] for a in pilot['activations'])
    seconds+=2*sum(a['profileCycleUnitSeconds'] for a in pilot['activations'])
return math.ceil(seconds*1.25/60)
```

Fixture occupancy120, clean analysis30; four cold units2 each; stage1 launch[2,2]/control[1,1] gives `ceil((150+32+16+8)*1.25/60)=5` minutes. Stage2 release/restore6 each and cycles8 each gives `ceil((150+32+96+64)*1.25/60)=8`. Missing clean analysis, <4 activations or incomplete operation gates refuses estimate. A clock interval cannot be formed by subtracting unrelated origins.

- [x] **Step 6: GREEN, package and review.** Run verdict-check and changed analysis_check including saved schema2 parser timelines. Preserve separate calibration fixtures and original raw exclusions. Repository gates, portable archive/identity manifest and conventional commit; child parks on root review with no running check. Reviewer inspects strict completeness plus decision/estimate boundaries; does not rerun suite.

Task3 execution evidence: analyzer prepared/reviewed through d26c638 after two corrective rounds. Certified operation/replacement launch credit, current accepted/profile generation timelines, captured-stage binding and independent cold completeness are enforced. Stage2 consumes separately certified same-source Stage1 launch evidence; no current Stage2 launch groups are required. Neutral CLI acceptance fixtures prove the contract only; live correctness, source/clock/restoration facts remain controller/live gates.

### Task 4: Controller runbook, window accounting and pre-pilot clock proof

**Execution:** controller/runbook/clock-verifier implementation prepared and independently reviewed through0776753 after four corrective rounds. Saved6 signal-boundary and10 cleanup cases pass;38 frozen source entries and archives match. Actual running-host clock endorsement, concrete live host command specifications and fresh permission remain root pre-live gates. Mandatory broad Tasks1–4 review precedes the long rehearsal; no live readiness or performance acceptance is claimed.

**Files:** create `CAPTURE_ROOT/code/{controller.py,controller-check.py,clock-gate.py}` and `CAPTURE_ROOT/runbook.md`; copy the reviewed `state.mjs`/`rotation-guard.py` helpers unchanged. Update docs evidence status only through root/Tasks CLI.

**Interfaces:** controller consumes Task1 lifecycle receipts, Task2 operations/refs, Task3 verdict/estimator. It writes immutable session/activation manifests and atomic collector control commands. All host IPC/Prism/timer mutation methods require a fresh explicit root-approved session id; calibration injects fake IPC/temp state only. No worker uses real mutations.

Window stamps on host monotonic origin:
`collectorStarted` before enable; `initialCardIssued`, `initialCompleteReceived`, `completenessChecked`, `recoveryRequested`, `approvalReceived`, `recoveryCardIssued`, `recoveryCompleteReceived`, `finishSent`, `collectorExited`.
Controller intervals are pre-card, after either completion, request→approval, approval→recovery-card and final finish. Initial/recovery card time is counted separately; do not double count. Use cumulative controller seconds and a measured reserve for still-unperformed checks; approval wait cannot borrow or silently consume the promised600-s recovery.

- [x] **Step 1: RED budget/reservation fixtures.** Quick smoke measures actual offline pre-card/post-card/post-recovery/finish work with fake IPC, marking that provenance. Compute `stepReserve=ceil(1.25*sum(stepSeconds))`; require `stepReserve+120≤300`. Preserve300-s allowance/2100-s live deadline. Example stepSum100→reserve125 leaves175 s for approval; stepSum144→reserve180 fits exactly; stepSum144.000001→reserve181 refuses. Before initial card, require remaining lifetime ≥1200+600+remainingStepReserve. Before recovery request calculate:

```python
approval_deadline=min(
    collector_started+2100-600-final_step_reserve,
    now+300-controller_seconds_used-final_step_reserve,
)
# At approval receipt and card issuance, recheck both allowances.
can_issue = approval_received <= approval_deadline and remaining_lifetime >= 600+final_step_reserve
```

Fixture remaining lifetime620/final reserve30 refuses;630 permits full600, not590. Late approval cannot shorten recovery. Test initial completion at20min, late response, no recovery, combined release+Q recovery and expiry during owner work. Expiry records invalidity, not pointer restoration or dropped callbacks. Include smoke's real elapsed check times and separate fake IPC times; live setup also enforces measured remaining budget before asking for hands.

- [x] **Step 2: Implement runbook startup/swap/restore in explicit order.** Resolve `command -v noctalia` and explicit `.worktrees/panel-budget/bin/prism`; never repoint CLI launchers. Preserve literal original plugin symlink, raw documents and exact scratch via existing locked helpers. Pause rotation with journaled reviewed guard before fresh baseline; never disable timer units or kill rotation service. Clear scratch only under fresh authorized setup. Before every enable, create offset/capture and start named collector; await collectorStarted before plugin enable. Then verify manifest hashes, fresh empty-runtime activation, P/canonical/scratch before issuing card. Use actual commands:

```bash
noctalia msg panel-close khughitt/prism:panel
noctalia msg plugins disable khughitt/prism
# Root records and performs the approved link swap, with literal restore target.
noctalia msg plugins enable khughitt/prism
# Await export readiness, then:
noctalia msg panel-open khughitt/prism:panel
```

Every swap follows operation-qualified drain, restored tested slider/P/test scratch, flushed logs and frozen outgoing raw. New nonce even between C1/C2. Actual reference changes/conflicts invalidate the activation, not silently update one implementation. Record pointer what/from/to/how to restore at each mutation.

- [x] **Step 3: Write exact grouped cards.** Stage1: wait for Prism controls; click Sample diagnostics (auto-expands); keep panel visible ≥5 s after button disappears and controls settle; confirm once. No sliders/profiles. Stage2 initial card: same diagnostics, then designated unedited slider two-second drags with own restore and ≥2-s dwell after each release/restore, and named P/Q cycles ≥5-s dwell with Prism values changed after each click, including final P before chat. Pilot1/1cycle; full5release/restore and3cycles. Preselect the actual unedited key from fresh snapshot, never old exclusions. Explain20-min initial/10-min approved recovery caps and decline shortened packets. A combined recovery card names all exact units, deficits and `replacementFor` ids; fresh approval required before root publishes its manifest or hands the owner the recovery card. The inert Recovery diagnostics button may be visible at physical quiescence; missing/unapproved manifests refuse without sampling. Visibility is not approval.

- [x] **Step 4: Implement separate Noctalia clock gate.** `clock-gate.py --source-proof PROOF.json --r2-root PRESERVED/r2-evidence-preserved --output PROOF_OUT.json` verifies a root-prepared binding proof before a live request. PROOF contains resolved installed executable/package/build identity, the actual running host's executable/build identity, Noctalia source revision/hash and the os.clock→clock implementation source excerpts/hashes establishing Linux CLOCK_MONOTONIC/steady origin compatible with Python time.monotonic. Read actual source/bundled Luau implementation (including any host override); source/version mismatch or absent proof blocks, never assumes ordinary Lua's CPU clock is Luau's clock. If source is not locally present, obtain only primary source at installed revision, preserve that identity; inability to match the running host blocks. The controller records `/proc/sys/kernel/random/boot_id` as origin label and source inspection findings, not a guessed offset.

Validate r2 corroboration without relabelling its stored origins: C2 probe294942.885 followed by controller `C2-handsProfileQ-end`294942.898 (about13ms). Accept ordering/agreement as corroboration only; it cannot replace source proof. Fixtures altered source-clock identity, installed/running version, live proof's boot id, missing proof and r2 reversed/seconds-offset timestamps fail this gate. Historical r2 boot agreement is checked within that historical evidence, not required to equal a later session's boot id. Synthetic producer success does not satisfy it. Proof is rechecked before each live session against actual host build/boot.

- [x] **Step 5: Implement controller fake-host integration and clocks.** Only the named collector captures continuously. The controller reads durable readiness/phase records on its own active turns: before issuing a card and after the owner's actual reply, before swap/recovery/finish. It ends its turn for the card; no root polling loop blocks the reply, and collector exit is not assumed to wake it. Require actual acceptedReference equality at Q and P and ordinary post-release deferred operation. A sample lost while closed remains excluded; one approved combined recovery can fill multiple deficits. Verify cardSettled's operation ids and final eligible drain while leaving the collector running through completeness/recovery decision. After decision/final protocol verification send finish, await integrityComplete=true and clean exit; combine that with strict record verification to publish protocolComplete=true. An integrity receipt alone cannot prove settlement. Unexpected exit/deadline invalidates capture and is preserved. Root keeps probe until explicit owner completion/stop; no estimate-driven cleanup. Finally drain, close/disable, restore original literal link, re-enable, verify exact profile/scratch/raw docs/canonical/latest wallpaper under lock, then resume prior timer state and check its journal; host-load and process identities show collector reaped. Conflict stops overwriting and reports exact conflict.

- [x] **Step 6: GREEN and independent review.** Run controller-check with temp store and fake IPC, inherited state-check/rotation guard cases, and clock-gate negative fixtures. No real IPC/timer/window action. Save measured controller-step budget, rate/gap inputs and all signals/receipts. Package, repository gates and commit/park. Root resolves review before Task5 and obtains a broad protocol review of Tasks1–4 with frozen code inventories, scoped correction rounds as needed; no long rehearsal before the seconds-long smoke's verdict is read.

Broad Tasks1–4 review and two corrective waves accepted through25ba964, tracked by completed direct corrective child prism-941a8d. Full captured cutoff, bounded growth/rotation, visible per-card handoff, cooperative full validation and persistence-aware gap/overlap checks are prepared and reviewed. Both independent five-unit workloads and3.42GB initialized-history capacity passed; these are synthetic proofs. Complete-pair duplicate overlap accounting was corrected alongside the bounded phase observer and reviewed. Root accepted-freeze short proof and Task5 preparation passed; the actual real-turn lifetime rehearsal has now passed root verification, with independent Task5 result review still required before live clock rebinding and a fresh desktop request.

### Task 5: Prepare, cross the real turn boundary and verify lifetime

**Execution:** scratch preparation and scoped corrections are reviewed through `9243616`. Three headless rehearsals failed after 636.7 s (read metadata), 32.0 s (timing guard), and 944.36 s (publication metadata). All remain immutable and incomplete; their owned processes exited. Bounded diagnosis reproduced active-source append visibility failures. The reviewed correction handles the permitted single-append observations at read, publication, and checkpoint seams, reads current prefix bytes, enforces shared descriptor/path progression, and rejects receipt failure contradictions. Exact-source focused checks, normal/emergency smokes, and the independent paced pilot passed. The fresh headless run launched on 2026-10-14 at 20:17:56 UTC passed root strict verification after the distinct 21:47:52 UTC human turn, beyond the 21:02:56 UTC watchdog. Production lasted 2,424.882 seconds; all 1,637,984,592 bytes, 1,600 segments and 2,774 protocol records match. Poll gap 0.300965486 s and work plus persistence 0.190961811 s remain below the unchanged 0.367746176 s guard. All five recorded identities and the socket are gone. The [portable lifetime result](../../tasks/files/prism-ac904e/task5-active5-lifetime-result.tar.gz) imports immutable originals and records actual scheduler/phase observations; the verifier was not rerun. Final independent Task5 review accepted the synthetic lifetime/result gate (no Critical or Important findings); Task5 is complete. One documentary Minor qualifies the original packet default-server-after assertion as root-reported; a separately timestamped later observation is retained. Live clock rebinding, concrete host commands, fresh desktop permission and performance acceptance remain Task6 gates.

**Files:** create `CAPTURE_ROOT/code/{rehearse.py,rehearsal-check.py}`; root-controlled `runs/<rehearsal-id>/{run.json,processes.json,polls.jsonl,receipt.json,raw/,rehearsal-report.md}`. Portable attachment and task notes record actual result.

**Interfaces:** `rehearse.py prepare RUN_DIR` exclusively creates a synthetic manifest/log/producer config from Task2 full-burst calibration, with watchdog2700 s, producer≥2400 s, synthetic environment and host monotonic polling. `start RUN_DIR` starts the reviewed named tmux mechanism; only root invokes long start. `verify RUN_DIR --turn-proof TURN_PROOF.json` requires ≥2400 elapsed synthetic production, no restart, all expected ids/payloads and final integrity receipt plus strict protocol verification, no socket/pids alive. Exit/gap/missing next-turn proof fails. Root obtains turn proof from the actual Codex rollout using the session-logs skill. Task lifecycle harness_session is the stable thread identity, not a turn id; park/resume notes corroborate the handoff only. A yielded tool in one turn is insufficient.

`TURN_PROOF.json` records threadId, firstTurnId, nextTurnId and selected rollout-event references `{line,timestamp,type,turnId,sha256}`. Require distinct turn ids within the same session_meta identity, first task_started, the start tool call/result tied to RUN_DIR/run nonce, first task_complete, Keith's human post-watchdog message associated with the next task_started, and that next turn's tool call reading this run's receipts and rollout. Require next task_started's `turn_attribution.turn_trigger == 'user'` and the corresponding `item_completed` with `item.type == 'UserMessage'` and that exact turn_id, in addition to the session-logs human-message classifier. A child-agent message trigger cannot qualify. Match tool call/result ids and turn brackets/item_completed turn ids; task_started may precede the serialized user message, as the installed harness does. Read first task_complete only after resuming; it cannot exist before the first turn ends. Do not count turn_aborted or injected AGENTS/environment/hook/tool-result messages as the requested human handoff. Deduplicate mirrored user events using the session-logs classifier. Never edit the rollout or let the collector depend on reading it. Missing/ambiguous events refuse verification.

Raw synthetic logs (≥160 MiB at4MiB/min for40min, larger at higher burst rate), rollout excerpts and minimal selected-event proof remain in0700 private run directories with0600 files. Attach only byte/count/rate/hash inventory, cleanup/report results and redacted event timestamps/types/turn ids/hashes. No raw synthetic log or conversation transcript/message text is attached.

- [x] **Step 1: RED short scaled cases and implement producer.** Use controlled-clock short fixtures for deadline, premature SIGTERM, duplicate/missing id, gap breach, normal40min result and cleanup. Turn-proof fixtures reject same turn with two parks, session-only provenance, missing first task_complete, injected user content, a child-agent trigger, absent/wrong-turn UserMessage item_completed, a pre-watchdog reply and mismatched run nonce/tool result; a fixture with task_started before its real human message passes association by turn. Producer rotates1MiB with one `.1` at max(4MiB/min, full calibrated burst), adds actual bursts and deterministic A→B→A occurrences in collector fixture, then emits final operation-qualified drain. The headless supervisor verifies this synthetic operation contract before sending finish; the collector still only checkpoints bytes. Its process has its own deadline/traps/recorded pid. No actual profile/timer/plugin is read or mutated. Parent watchdog reaps it even if controller never returns. A byte-count fixture catches silently reduced rate; end-to-end parser proves every payload through final drain.

- [x] **Step 2: Read the seconds-long smoke result before root start.** Require startup/normal finish and emergency named kill clean on exact wrapper/code version plus Task4 budget smoke success. Prepare full code/identity/rate digest and record wall and monotonic watchdog deadlines. Worker commits preparation and parks on root launch, with no process running; root checks code/review/manifest match before start. No desktop permission is needed for this synthetic headless gate; implementation-plan approval precedes it.

- [x] **Step 3: Root starts one long rehearsal.** Verify unused socket/id, record server/wrapper/collector/producer pids/start identities, receipt paths and exact stop command; no reuse of Codex exec-session lifetime. Resolve the native Codex thread's rollout via the session-logs tools, verify session_meta/cwd and record first task_started and start tool references. Observe initial heartbeat, synthetic startup and first rotation before ending the turn. Run host-load, list every owned process still running, and name watchdog wall time and stop command in final report.

- [x] **Step 4: Park for the real next turn.** Park every root-held claim that needs this handoff, with:

```bash
tasks park prism-ac904e 'Keith sends a message after the recorded 45-minute watchdog; root then verifies durable rehearsal receipts, rollout turn proof, all captured bytes/ids and process cleanup in .worktrees/panel-budget.' --waiting-on user --reason dependency
```

`prism-ac904e` is this plan's registered Task5 child. The brief and runbook use that exact id. This person message is required because Codex does not auto-wake on tmux exit. The watchdog owns cleanup while root is away. Do not call a running worker a completed rehearsal, or wait for an untracked job notification.

- [x] **Step 5: On Keith's message, root resumes and verifies.** `tasks start`/trial-arm, read persisted evidence and the rollout's completed first turn and current human-triggered turn. Freeze selected event references/hashes and private proof, correlate first start and the current evidence-read tool call to this run, then invoke verify with that proof. The evidence-read call precedes proof construction; neither the verify call nor the current turn's task_complete is a prerequisite. Compare message timestamp to recorded wall watchdog and require the actual distinct-turn bracket evidence; park/resume provenance is corroboration only. Check socket/pids absent, run strict parser and hashes. If message arrives early, report remaining deadline, keep cleanup independent, and park waiting for the post-watchdog message; no premature passing claim. Analyze failure before any environment retry; no automatic retry or desktop request. Success is capability evidence for this exact reviewed named-server wrapper, not Codex exec-session lifetime or Noctalia os.clock.

- [x] **Step 6: Freeze report and review.** Original implementer imports immutable run to produce portable report/results, no host changes. Fresh read-only reviewer verifies real-boundary/lifetime/bytes/process cleanup and calibration provenance; root records review note before disposition. Close Task5 only after this gate passes; a failed run remains open for correction/new reviewed rehearsal. No live pilot before Task5 success and separate clock gate.

### Task 6: Stage 1 pilot, cold/launch comparison and disposition

**Execution:** Four selected B1→C1→C2→B2 schema2 n=1 builds and inert proposals are retained privately. Root verified the prospective current source/clock and read-only state/log preflight. Separate private IPC/state/drain/reconciliation helpers and focused refusal tests are prepared for review; accepted54-file runtime remains unchanged. Both full Stage1 fake bursts preserve the current83/12/24 model and certify five cold plus five launch/control pairs, with peaks318875/319617B/s below the unchanged1425679B/s guard. This is prospective compatibility, not live throughput or performance acceptance. Root still owns actual read-only timing, concrete session/contract/permit binding, reserve provenance review, fresh owner permission and live pilot. Abort physical-only drain and conservative manual recovery boundaries are explicit. No live authorization or host mutation occurred; Task6 remains open. Portable evidence: `task6-pilot-preparation-v2.tar.gz` and `task6-host-helpers-v2.tar.gz` task attachments; original helper archive retained. Readiness follow-up adds a shared4s registration deadline under the5s outer timeout for export and restoration, with mocked RED→GREEN proof; host.py SHA256ffedc55a350f749cbff680ff66d180c867a02ef31b1fd34cba32b4edb186068f supersedes the earlier helper bytes, requiring root inventory regeneration.

**Files:** private new builds/session manifests/action cards/raw logs/parsed results; task attachments, spec/plan evidence status and Tasks CLI records. Only a required token revert may change production.

**Interfaces:** consume reviewed Tasks1–5, pre-pilot clock proof, existing state/rotation guards and strict stage1 analyzer. Worker prepares fresh matched copies and frozen analysis; root owns permission/desktop/snapshot/pointer/rotation and prompts. Returns protocol gate, measured estimate, two independent cold blocks, launch/control report, restoration and ordered disposition.

- [x] **Step 1: Prepare read-only.** Verify clock gate on current binary/boot, durable scripts and source hashes; reproduce copies from frozen commits with new schema2/nonces and identical instrumentation. Check nested host availability first; fake Lua is not in-host acceptance. Inspect plugin pointer and CLI resolution. Fresh current P/Q eligibility and unedited candidates are read-only preparation, not permission. Reject stale env/runtime/doc differences before writes. No live action until root's next step.

- [ ] **Step 2: Ask for the Stage1 n=1 collection pilot.** Provisional25-minute occupancy estimate comes from r2 diagnostics17.5 + controller~2, rounded with25% allowance; automatic expansion removes the24-minute expansion/chat bucket and no manual slider/profile actions are requested. Name the prior96-minute inconclusive pilot, reviewed fixes/rehearsal, four reloads/cards, one cold each and one launch/control pair per variant, timer pause/exact restoration. Explain estimates are not cutoffs, initial card20min/runtime35min caps and no replacement without another request. Fresh yes required; if declined park prepared host action, not already-completed agent work.

- [ ] **Step 3: Run four one-click cards through certified parsing/restoration.** Snapshot/pause/clear/offset/start-before-enable, fresh startup/reference/readiness, exact source, all-expanded shape. Follow card5-s dwell and one explicit completion response per activation. The named collector captures continuously while root has ended its turn for the card; root reads those durable records on the turn triggered by the owner's reply. No collector exit auto-wakes root. Before swap check counts/drain/limits; offer at most one approved combined replacement while nonce/reference/capture valid, or report short/inconclusive. Freeze and restore plugin/settings/rotation before any park that hands off beyond an authorized owner card. Pilot performance verdict is inconclusive n=1; its collection gate can pass. Missing data or deadline invalidates collection and is analyzed before any retry. Save monotonic units, actual occupancy and clean normal analysis time; no diagnosis time substituted.

Every authorized initial/recovery card handoff parks the root-held measurement claim with `--waiting-on user --reason dependency`. Its next-action note names the pending owner response, collector pids/socket/deadline/stop command, the actual plugin pointer's current scratch target and exact original target/restore command, and the paused `wali-rotate.timer` with its journal and prior-state resume command. Record these actual values at handoff, never a generic placeholder. Keep the probe and timer pause only through that separately authorized card; other parks/done restore them first. Task7 uses the same card handoff rule. No worker parks or mutates a host pointer on root's behalf.

- [ ] **Step 4: Derive stage1 estimate and request five-sample stage.** Only after complete pilot gate and read result, use Task3 estimator's actual fields and quote the number plus all phase counts. No default fifteen-minute estimate. Need new host permission and fresh snapshots/nonces. Five colds per four activations; B1/C1 five launches/five controls each, zero owner slider/profile operations. Repeat same capture/permission/restore rules; short groups may use that activation's one combined approved packet, otherwise return design. No sample pooling or guessed budget count.

- [ ] **Step 5: Apply ordered result and review evidence.** Preserve all excluded/lost records and overlap report. Incomplete cold/error/identity/correctness evidence returns inconclusive, never revert based on one block. Complete gain failure dispatches one token-revert fix subagent (`git revert e7384b0d7ab3e8e935cdf0776043839441132af5` only after source/commit inspection), focused source tests/`just test-fast`/checks and scoped fresh review. Cold≥15 despite gain returns design without performance keep. Cold pass + complete launch groups sets pending_stage2; accepted remains false. Freeze exact restoration/source state after any revert. Fresh evidence reviewer gates child closure, full returned text saved by root.

- [ ] **Step 6: Record conditional next work.** On return-to-design/revert, drop this plan's Task7 as not eligible through Tasks CLI and prepare an evidence-grounded next design before any new production/host gate. Original Task6 stays open; original Tasks7–8 remain gated. On pending_stage2, close this child with measured result and proceed to Task7 preparation, but not its desktop without fresh permission. Do not merge the branch.

### Task 7: Conditional Stage 2 pilot and full acceptance

**Files:** new private matched builds/snapshots/run manifests/raw/parsing/report; Tasks CLI attachments; source only if required token revert.

**Interfaces:** enabled only by certified pending_stage2/complete launch evidence on the same frozen source revisions and exact restoration. Runtime cold data is new and belongs wholly to Stage2; launch diagnostic is separately identified from Stage1. Root owns host use, worker prepares/analyzes.

- [ ] **Step 1: Read gate, prepare copies and request smallest owner-heavy pilot.** Verify Task6 result is pending_stage2, unchanged source ids, new clock proof/builds/nonces/current snapshots. Read-only select current P and >half-changing Q and real unedited slider. Request a fresh four-activation n=1 pilot (one cold, one actual release/restore and one P→Q→P per card), naming action counts, dwells/timer/exact restore, initial provisional allowance based on measured grouped card/controller costs plus explicitly unmeasured heavy work. No Stage1 permission is reused.

- [ ] **Step 2: Verify every heavy gate through strict parser.** Q and P exact accepted references plus actual profile deferred renders; release-origin and restore-origin ordinary deferred evidence; expanded cards, real two-second drag/release and drained writes. Early P/close leaves exclusion, not relabel. One combined owner-approved recovery packet max. Full restore before parking. If any gate short, incomplete/return design; analyze before retry, prepare design, never request full acceptance automatically.

- [ ] **Step 3: Estimate from successful Stage2 pilot, then request full run.** Task3 stage2 estimate includes actual unit dwells and clean analysis, one card/chat overhead per activation. Fresh permission for four new activations with5 cold,5 release/restore,3 P→Q→P cycles each:20 actual releases,24 switches, ≥5 each other target class per implementation/block. Stage1 cold/launch permissions and allowance authorize no extra heavy actions.

- [ ] **Step 4: Run, freeze and restore exactly.** Apply same controller window/capture/reference/packet limits. Stage2 colds are within its own nonce/class records. Report each class/block sample list, median/MAD/threshold/max and overlap. Required non-profile deferred renders cannot be filled by profile/open/cold classes. Any short class/group or incomplete error count is inconclusive. Main plugin, exact owner state/latest wallpaper and prior rotation restored; processes reaped before task park/done.

- [ ] **Step 5: Review decision and continue original plan only if accepted.** Apply original full numeric keep/revert/absolute rules and primary Stage1 launch/restoration/source evidence. Revert via fix subagent/fast suite/scoped review if required; return to next written design on incomplete/absolute failure. Root closes original `prism-f15cbf` only for accepted=true and every cross-task identity/launch/restoration gate; that unlocks original Tasks7–8. Continue original SDD final whole-branch review and corrective rounds; preserve both older ledgers and deferred rulings. No push/PR/merge authorized here. Close this measurement child on its reviewed actual disposition without treating that as original performance acceptance.

## Self-review and traceability

- Lifetimes/turn handoff/cleanup and archive integrity → Tasks1,4,5. Spec round3 Minor1 boundaries/reserves → Task4; Minor2 Keith post-watchdog message → Task5; Minor3 actual binding/r2 clock pre-pilot gate → Task4, not synthetic rehearsal.
- Expansion/ready/accepted canonical references/early P/release and Q close races → Task2 and Task4.
- Stage1 ordered decision/unknown completeness/two blocks/launch state groups/no pooling → Task3; live cold and conditional revert → Task6.
- One combined recovery/permission/runtime caps → Tasks2,3,4,6,7.
- Byte-payload preservation, rates/gaps/poll overlaps, durable originals/reproducible fresh builds → Tasks1–5.
- Plan round1: distinct rollout turn events/private proof → Task5; collector integrity versus controller protocol contract → Tasks1,4,5; exact target endpoints → Tasks2,3; schema2 capture prerequisite → Task2; collector-only continuity between root turns → Tasks4,6; installed Lua version/private synthetic inventory/rehearsal park reason → header/Task5. No deferred finding.
- Counts/estimates/exact host restore/staged acceptance → Tasks3,6,7. Original numeric thresholds remain unchanged; old schema/data never enter new complete results.

Root self-reviews interfaces, enum/schema/clock field consistency, numerical fixtures and coverage before committing this plan. Plan review is required before code or rehearsal starts. Preserved execution method is subagent-driven; do not ask the owner to select it again.

Task6 read-only preparation is independently accepted for requesting host permission (review3:0Critical/0Important/0Minor). Current portable root packet is `tasks/files/prism-7ed2d3/task6-root-action-packet-v4.tar.gz` (SHA256 `7bf25a1019bb275136f31265becc096c7e7b059382fc556fe27dccd2b6ef1472`); earlier packets remain historical. Four inert sessions/contracts are bound, reconciliation argument order and pinned Node resolution verified, prospective numeric reserve and complete elapsed enforcement accepted. One outer rotation journal preserves the pause across all four implementations. Fresh owner permission for the provisional25-minute n1 pilot is pending. No live run, permit, plugin pointer/timer/store mutation or performance acceptance has occurred; Task6 remains open.

Task6 update2026-10-15: the first authorized B1 startup aborted before any owner card. Its active-checkpoint read failed; retained real logs also identify a data-directory plugin export while the packet changed a legacy config-directory link, so no probe activation or samples were certified. Original pointer/plugin, exact settings and original rotation were independently restored; owned collector/endpoint reaped. Manual abort recovery took the controller context beyond300s, explicitly ineligible. Evidence: `tasks/files/prism-7ed2d3/task6-b1-aborted-startup.tar.gz` (SHA256 `2b729032b052d0c34195e74c92ded40ca3825dd22f5ddfe0c8d53a29e8a52585`). No retry is authorized and no full-stage/performance acceptance is established.

Task6 bounded correction: diagnosis reproduced a legitimate active append/publication refusal and a parser reread that can consume bytes outside the audited extent. Exact B1 interleaving was not retained and remains unknown. Correct the shared reader in a new private version, parsing its audited bytes once and permitting only bounded, independently verified append/publication retries. Bind manifest provenance to that same view throughout startup, internal inspection, finish and terminal validation. The collector/control/probe remain unchanged; the completed lifetime rehearsal qualifies those unchanged files, while the new reader requires targeted full schema2 lifecycle proof and independent review. Source discovery must bind the actual running shell's data-directory entry and literal inverse target. Pending enable observation must bind its exact owned receipt and wait within the existing deadline without repeating the mutation. Original54 and failed namespaces remain immutable. No correction or read-only observation authorizes another desktop run.

Task6 correction qualification: the versioned reader/helper correction and scoped ready-issuance/restoration-source fixes are independently accepted through `a5e0989`, with0Critical/Important/Minor remaining in scoped review. The new58-file code digest is `4ea47695846dbcdf1d2dff5bf703486ccfe38da597a71d56e314d0abb89fdfce`, explicitly distinct from accepted54. Exact RED→GREEN regressions, affected inherited checks and the complete real schema2 synthetic lifecycle passed; the collector, supervisor, producer and probe remain byte-identical to the original lifetime-qualified files. Portable source/evidence: `tasks/files/prism-7ed2d3/task6-startup-correction-v2.tar.gz` (SHA256 `f80ae7ab91e95fa85939ae2efd39a2d51b564d260dc18fda06abb63069b9c13e`). The prior v1 correction and failed attempt stay preserved. Four Task6 corrective rounds have been used. Root's complete driver, fresh concrete action-phase packet, reserve qualification and their independent review remain required before a new permission request; Step1 stays open.

Task6 complete-driver review: `26f9116` adds the inert portable packet `tasks/files/prism-7ed2d3/task6-complete-driver-packet.tar.gz` (SHA256 `33f51cc0043abe90c198b0402ae59d85e289be52e6cf852bb9b8d97736427723`). Root verified its472 bound inputs and251 payload hashes. Independent impl review6 requests changes for four integration defects: overlapping repeated-action permits, unsupported reconciliation representation, a frozen descriptor check that refuses ordinary log rotation, and missed outer rotation restoration after an elapsed failure. The synthetic smoke substitutes those interfaces and does not qualify them. The final corrective round5/5 is confined to a new copied helper's exact attempt-to-permit binding and the driver corrections, with real Guard/RootHost/dispatch/helper checks and scoped re-review. Accepted source copies and the failed packet remain immutable. Step1 is open, no new host permission exists, and no performance result or Task7 eligibility follows. Owner card guidance will wait ten visible seconds after controls settle and diagnostics disappear, preserving the unchanged protocol's five-second stable-drain requirement.

Task6 final preparation qualification: corrective round5/5 in `fe3f29a` addresses all four integration findings; independent impl review7 accepts with0Critical/Important/Minor. The authoritative portable attachment is `tasks/files/prism-7ed2d3/task6-complete-packet-fix5-reviewed.tar.gz` (SHA256 `b20600dadd121cf0969aacd97d8f2fdbda2b5275fdccc3685397a3172a6d0f1d`); the same commit's `task6-complete-packet-fix5-final.tar.gz` is superseded harness evidence. The current private master hash is `e5e350b811316114eed31053935ace7a678ee734544a8795048731eeded4d388`. Root verified all472 inputs, canonical sessions/contracts,266 portable payloads and9 exact source copies, and repeated actual read-only clock/source/log binding. Saved58 focused/inherited tests and the final source-qualified real Guard/RootHost/dispatch/helper schema2 lifecycle cover normal four-activation, short-class and administrative-abort paths. All recorded actors are reaped. Step1 is complete for permission-request preparation; fresh host consent, authorized snapshots and actual live feasibility remain separate gates. The unchanged reconciliation helper's ambiguous overlapping original-effect permits remain an explicit refusal/manual-recovery boundary. The144-second seed fits the formula exactly and has no spare margin; actual overrun stays ineligible with owned cleanup. No performance acceptance, token disposition, fulln5 authorization or Task7 eligibility is established.
