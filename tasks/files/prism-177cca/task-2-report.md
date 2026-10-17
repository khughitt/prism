# Task 2 implementer report

Status: DONE; scratch readiness prepared for independent controller-owned review.
Child: prism-177cca. Base: 38ee45b (bookkeeping); candidate: e7384b0;
baseline: 9bf4e8e. Evidence commit subject:
`test(panel): validate matched budget probe protocol`.

Only the child record and its task attachments are committed. Production code,
parent records and the controller's uncommitted plan correction are untouched.
The generated scratch directory is `/tmp/prism-budget-matched-task2`.
Readiness is preserved through child task attachments, including its full archive.

## Frozen sources and identical transform

Baseline full identity: 9bf4e8e920c005f8a4d1666b32b4e1a516856ac2.
Candidate full identity: e7384b0d7ab3e8e935cdf0776043839441132af5.
All six source bytes were fetched by `git show` and independently checked against
both supplied frozen identities and SHA256 maps. Each output preserves `source/`,
its uninstrumented hashes, plugin manifest, transform manifest and unified diff.
All non-entry modules and plugin.toml are byte-identical. Reverse transforms recover
exact panel source bytes. Transform anchors must occur once; missing/duplicate-anchor
fixtures fail. The original `endDrag` and enqueue bodies remain byte-identical.
The baseline raw signature path and candidate token path are unchanged.

Identical instrumentation SHA256: 7c841aabb619124a81f44a8025df72fec8f96f48bc3009bda2898419ec9d9d23.
The explicit callback expression transform wraps 26 input assignments;
its per-expression changes and the common prefix/tail are identical across variants
except the supplied identities and original source. No UI constructor wrapping,
getfenv/setfenv, host API-table mutation, trace observer, heap sampling, forced GC,
production module/export, dependency, launcher or installed config change exists.

## Callback, cold and launch protocol

The readiness-only Sample diagnostics control is hidden on click. That click never
renders. All readiness callbacks while the control is visible are retained but
explicitly excluded from target data. Every measured tree has production shape,
keys and props, with functions ignored only for deep comparison. Optional nil native
handlers retain nil; wrappers preserve all original return values.

Cold setup saves exact shown stdout, clears memo AND shown stdout, then calls the
existing described path in setup. It freshly decodes/validates/accepts; the next
actual frame renders. Both variants prove five separate setup/render callback pairs,
five fresh model/structure tables, unchanged model content/enqueued/queue, no setup
render, and 142 rebuilt retained units per expanded 12-card fixture. Trace collection
is fake-test-only; live scratch copies have no observer. Input changes stop the finite
sequence with a saved diagnostic reason. A new runtime proves initial memo/model/
structure/enqueued/drag/queue state; close/open retains model and fails reset semantics.
Parser fixtures refuse old nonce, wrong variant/hash, duplicate and nonfresh identities.

Each launch pair executes one existing run helper before its immediate render in a
frame callback. The helper copies argv, substitutes the explicit worktree CLI, builds
the shell command, then times only noctalia.runAsync. Run-helper elapsed remains a
separate span. The next actual frame renders once; ordinary tick work then stays
intact. No-launch frame/frame controls alternate with launches in reverse order for
the two variants. A new pair starts only after frame AND command completion.
Completion does not decode/log stdout or change model/queue; raw result flag metadata,
completion state and invalidation reasons survive. Both completion-before-frame and
completion-after-frame, controls, launch/completion failure, malformed completion,
changed/unchanged/error describe, focus/expansion/value changes and overlap are checked.
An input collision invalidates the pair and performs normal frame work exactly once.

Render/native/helper/callback timers stop before their record is buffered. Identity
expansion, JSON serialization and logging happen in otherwise-idle frame callbacks,
in chunks of at most 16 records, recorded as observerFlush. Every active drag runs
original frame logic, including nondirty ticks with pendingSample and its 100ms enqueue
cadence. Ordinary deferred and due cold/pair/sequence work also precede flushing.
Closing keeps frame ticks disabled. Raw tests call the wrapper directly; they do not
hide delayed frames behind the helper. Parser monotonicity follows issued record ids,
so chunked observer records can safely interleave in physical log order with older
buffered samples. Final drains preserve all records and stop diagnostics ticks.

## Numeric/parser/timing checks

Exact two-block decision function and strict MAD/floor gain, equality, per-class
regression, missing class/variant/block, correctness/budget, cold/profile <15 and
other-class <=12 boundaries all pass. Keep with cold18 remains unaccepted; maxima
alone do not decide; one block cannot hide another. Inconclusive always returns
return_to_design=True. Blocks/activations are never pooled.

Normalization preserves raw records, samples and explicit exclusions. Duplicate keys,
record ids/callbacks, malformed identities/types, callback id0, incomplete spans,
unaccepted describes, loading/idle/no-render cases and visible controls are handled.
Pair subtraction uses actual immediate/frame record ids. Native/helper/completion,
valid disposition and consistent pending/done metadata are required; controls stay
separate. Five launch pairs split between states have no primary aggregate; a primary
launch group also needs five valid controls. Saved byte offset plus a rotated segment
reconstructs exact events, including first sample and final drain.

The single reusable estimator is analyze.py --pilot <measured-json>. It requires
complete finite/nonnegative phase fields and four measured activation entries. The
binding 30/30/30, four10/2/6/8, launch2/control1 fixture computes 520 seconds including
25% allowance and 9 minutes; it is NOT a live estimate. Probe cold/pair interval facts
carry a clock origin and include command completion waits. Controller owns actual
setup/reload/expansion/user action/analysis/restoration timestamps and hands/occupancy
split; absent fields fail rather than invent durations.

Full fake sequence parsing retained 20 valid launch/control pairs, zero pair exclusions
and 22 origin-local intervals across variants. Its target verdict is intentionally
inconclusive, accepted=False, return_to_design=True. Those fake durations establish
neither a host performance verdict nor thread CPU/GC cost.

## Exact commands and results

Commands ran from `.worktrees/panel-budget/`; `$PWD/bin/prism` was supplied as the
explicit CLI, never executed by the fake host. All following commands exited0 except
the deliberately failing RED runs, whose logs preserve relevant failing assertions.

```sh
~/.agents/bin/trial-arm prism-177cca
# exit0: not enrolled: no trial for prism
python3 /tmp/prism-budget-matched-task2/build.py --baseline 9bf4e8e --candidate e7384b0 --cli "$PWD/bin/prism" --output /tmp/prism-budget-matched-task2/copies --nonce task2-calibration-01
python3 /tmp/prism-budget-matched-task2/build.py --baseline 9bf4e8e --candidate e7384b0 --cli "$PWD/bin/prism" --output /tmp/prism-budget-matched-task2/sequence-copies --nonce task2-sequence-01 --cold-pairs 1 --launch-pairs 5
lua /tmp/prism-budget-matched-task2/self-check.lua /tmp/prism-budget-matched-task2/copies /tmp/prism-budget-matched-task2/model.lua integrations/noctalia-plugin/test_encode.lua "$PWD/bin/prism"
lua /tmp/prism-budget-matched-task2/self-check.lua /tmp/prism-budget-matched-task2/sequence-copies /tmp/prism-budget-matched-task2/model.lua integrations/noctalia-plugin/test_encode.lua "$PWD/bin/prism" sequence
python3 /tmp/prism-budget-matched-task2/analysis_check.py
python3 /tmp/prism-budget-matched-task2/integrity-check.py --copies /tmp/prism-budget-matched-task2/copies --baseline-identity .superpowers/sdd/2026-10-11-panel-budget-tokens-and-launch/baseline-identity.json --candidate-identity .superpowers/sdd/2026-10-11-panel-budget-tokens-and-launch/task-1-candidate-identity.json --model .superpowers/sdd/2026-10-11-panel-budget-tokens-and-launch/readonly-describe.json
python3 /tmp/prism-budget-matched-task2/analyze.py --log /tmp/prism-budget-matched-task2/sequence-copies/baseline/fake.log --log /tmp/prism-budget-matched-task2/sequence-copies/candidate/fake.log --identity /tmp/prism-budget-matched-task2/sequence-copies/baseline/identity.json --identity /tmp/prism-budget-matched-task2/sequence-copies/candidate/identity.json --budget-errors 0 --output /tmp/prism-budget-matched-task2/fake-verdict.json
python3 /tmp/prism-budget-matched-task2/analyze.py --pilot /tmp/prism-budget-matched-task2/pilot-fixture.json
noctalia plugins lint /tmp/prism-budget-matched-task2/copies/baseline/plugin
noctalia plugins lint /tmp/prism-budget-matched-task2/copies/candidate/plugin
luac -p /tmp/prism-budget-matched-task2/copies/baseline/plugin/panel.luau
luac -p /tmp/prism-budget-matched-task2/copies/candidate/plugin/panel.luau
just test-fast
just check
tasks check
```

Results: builder/integrity/probe/sequence/numeric/parser/time fixtures PASS; both offline
lint runs0 errors/0 warnings; both syntax checks exit0; just test-fast574/574 plus
plugin Lua assertions, no failures; just check exit0; tasks check0 errors/0 warnings.
Repository test/check logs, all fixture logs, identities and diffs are in the archive.

## RED/GREEN evidence and self-review

- red-probe.log: frozen uninstrumented copies fail "missing transient diagnostic start control".
- red-pair-order.log: deliberate pre-launch render fails the exact launch/render timeline.
- red-numeric.log: initial inconclusive-only function fails the complete fixture keep assertion.
- red-parser.log: launch-only data initially incorrectly formed a primary aggregate; fixture fails "launch-only data lacks matched controls". Fixed aggregation requires controls.
- red-estimator.log: deliberate estimator return0 fails the binding9-minute fixture.
- red-profile-class.log: collapsing profileRender into deferredRender fails generation/class assertions.
- red-optional-callback.log: real unavailable-light fixture fails deep-tree equality; preserving nil handlers fixes it.
- red-visible-control.log: readiness deferred render initially entered selected samples; explicit visible-control exclusion fixes it.
- red-native-cadence.log: raw next-frame pair assertion exposes flush-before-render delay. Priority fix preserves actual next frames and original close tick state.
- red-nondirty-sampling.log: ignoring nondirty drags fails the raw100ms pending-sample assertion.
- red-collision-frame.log: an extra diagnostic render on interference fails exactly-one normal frame assertion.
- red-bounded-flush.log: unbounded flush fails the sixteen-record/complete-drain assertion.

Every mutation was confined to a scratch copy or analysis script and restored byte for
byte in finally. green-probe.log and green-parser.log capture final complete passes;
sequence-check.log, integrity-check.log and lint logs capture final readiness checks.
Self-review corrected nil handler shape, readiness selection and observer/frame cadence
before handoff. Independent review remains the controller's next gate, not a worker
assignment left running. The only remaining limitations are explicit task boundaries:
no live acceptance/latency measurements or host install; budget-error count and real
pilot phase durations must come from the controller's approved live session. No checks
or spawned processes remain running.

## Original disclosed concern (resolved by corrective pass below)

The current second-tick wrapper conservatively marks every update callback as
interference, including odd ticks which do not launch a refresh. This cannot admit
contaminated target/pair data, but can stop an otherwise unchanged finite sequence or
reduce live pair yield. It was disclosed to the controller before commit and is an
explicit review concern; no live yield was measured. No check is still running.

## Commit-gate normalization

The initial evidence commit was refused by the machine-layout gate on the readable
manifest's captured CLI display paths. The standalone attached manifest now displays
`.worktrees/panel-budget/bin/prism`; only that display representation was normalized
through tasks detach/attach. Exact frozen runtime identity/CLI strings, probe argv,
source copies and original manifests remain unchanged in scratch and the archive.
No hook was bypassed and no host pointer changed. Feedback ops-4e97bf records the
missing portable-representation instruction; its maintainer owns triage.

Evidence commit: 7a067af12a3c19ff17ba422f3f45ff31bf6a1d45 (`test(panel): validate matched budget probe protocol`).

## Corrective pass: periodic ticks and unchanged refresh settlement

Controller ruling: an odd no-refresh update must not invalidate a pair or abort the
whole finite sequence; normal refreshes/unchanged callbacks between trials must settle
without postponing production work. The first report understated the original effect
as reduced yield: it actually marked sequence.failure and aborted the whole sequence.
That behavior is now fixed before independent review.

Claim/lifecycle commands: tasks start prism-177cca initially refused done→doing; then
tasks edit prism-177cca --status todo, tasks start prism-177cca and
~/.agents/bin/trial-arm prism-177cca succeeded (not enrolled). Only the child is reopened
and changed; controller plan and parent records remain untouched.

Changes: diagnosticInterfere now distinguishes pair-only interference from actual input
changes that stop the sequence. It preserves each active-pair reason as raw metadata.
update invokes the original body without unconditional interference; an actual foreign
run launch invalidates only its active pair. described records pair interference even
for unchanged results, while only accepted/rejected/error-changing results stop the
sequence. Temporary normal describe/queue busy state is sequenceWait, bounded by the
original completion/timeout path. All original update, refresh, deferred/frame and
100ms drag/sample work continues. No new scheduler/process/file/timer API is used.
The fixed finite trial count remains unchanged; contaminated records survive and are
excluded rather than replaced or silently admitted.

RED command (before correction):

```sh
lua /tmp/prism-budget-matched-task2/self-check.lua /tmp/prism-budget-matched-task2/sequence-copies /tmp/prism-budget-matched-task2/model.lua integrations/noctalia-plugin/test_encode.lua "$PWD/bin/prism" periodic
```

red-periodic-sequence.log fails: `harmless odd update invalidated diagnostics`.
GREEN uses the same command after rebuilding with the already documented builder
command. green-periodic-sequence.log passes: regular odd updates during all ten trials;
eleven even refresh/unchanged settlements between trials; each variant reaches finite
done with ten valid pairs and unchanged model/decode/enqueued/queue. Separate cases
prove changed/error/timeout responses stop the sequence and still perform exactly one
original deferred frame. An actual foreign refresh launch during a pair records raw
foreign-launch/describe reasons, excludes that trial, waits for unchanged settlement,
and reaches done with nine valid and one excluded trial for each variant.

Parser commands for those saved timelines (both exit0):

```sh
python3 /tmp/prism-budget-matched-task2/analyze.py --log /tmp/prism-budget-matched-task2/sequence-copies/baseline/periodic-fake.log --log /tmp/prism-budget-matched-task2/sequence-copies/candidate/periodic-fake.log --identity /tmp/prism-budget-matched-task2/sequence-copies/baseline/identity.json --identity /tmp/prism-budget-matched-task2/sequence-copies/candidate/identity.json --budget-errors 0 --output /tmp/prism-budget-matched-task2/periodic-verdict.json
python3 /tmp/prism-budget-matched-task2/analyze.py --log /tmp/prism-budget-matched-task2/sequence-copies/baseline/periodic-interference-fake.log --log /tmp/prism-budget-matched-task2/sequence-copies/candidate/periodic-interference-fake.log --identity /tmp/prism-budget-matched-task2/sequence-copies/baseline/identity.json --identity /tmp/prism-budget-matched-task2/sequence-copies/candidate/identity.json --budget-errors 0 --output /tmp/prism-budget-matched-task2/periodic-interference-verdict.json
```

Assertions confirm20 valid/0 excluded clean pairs and five pending launches/five done
controls per variant. The contaminated timeline preserves18 valid/2 excluded raw
pair groups, with no falsely admitted contaminated trial. These remain fake timelines,
not a host acceptance verdict.

Existing raw queued-frame, nondirty active drag+pendingSample at16+84ms, dirty frames,
ordinary deferred frame, cold next actual frame, pair next actual frame/collision,
close-tick and sixteen-record idle flush assertions remain unchanged and pass on both
corrected copies. This retained the separate original cadence RED/GREEN evidence.
The periodic correction did not change endDrag/enqueue or any uninstrumented module.

Validation commands are the existing cold self-check, integrity-check.py with frozen
identities/readonly fixture, noctalia plugins lint on both changed copies, luac -p on
both entries, just test-fast and just check, with the exact arguments listed above.
fix-existing-calibration.log, fix-integrity.log, fix-lint-baseline.log and
fix-lint-candidate.log all pass; lint0 errors/0 warnings; syntax exit0;
fix-repository-tests.log574/574 plus Lua assertions; fix-repository-check.log exit0.
No unrelated scope or new production behavior was introduced.

Current identical instrumentation SHA256: 12c724d9127044b7d9ce17b91ab06cd82b90d388b26d4fccd532f268b1825a62.
Original tick concern is resolved; remaining boundary is unchanged: no live host
installation or timing acceptance. Independent full review is controller-owned.
All checks finished; no process remains running.

## Independent implementation review fix round1/5: I1/I2

FIX_BASE:6f5d212. Review: codex/gpt-6.1-sol; revise, Important2, Critical0, Minor0.
The child review note was recorded before changes. Scope is analyze.py and
analysis_check.py, their attachments, report/archive and the child record. The live
probe, frozen copies, instrumentation, normal timing/cadence and other modules are
unchanged; no host action, subagent, probe lint or repository-suite rerun occurred.

I1: pairs now indexes complete callback-end records by (activationNonce,callbackId)
across ALL events, including terminal ends whose pairId=false. Immediate/frame/
native/helper/completion evidence and frame-state/disposition metadata require a
matching eligible complete endpoint after each referenced event in the same clock
origin. A missing/incomplete end excludes the pair, so pairDone cannot substitute
for the enclosing callback's completion. Synthetic fixtures now include unique
callback ids and actual callback endings. Each required end's removal/incompletion,
all-end removal and saved terminal-end truncations are covered.

I2: origin-local issued record ids and monotonic timestamps must put immediate
render before frame render, and frame-state in its same callback after that frame.
The recorded frame pending flag must agree with frame-state. Done requires actual
comparison completion before the frame; pending requires completion after the
frame-state. Consistently relabeling both metadata records cannot change the actual
completion group. Synthetic done fixtures now complete before frame; both early→
pending and late→done contradictions are rejected.

Exact covering commands (from .worktrees/panel-budget):

```sh
python3 /tmp/prism-budget-matched-task2/analysis_check.py
python3 /tmp/prism-budget-matched-task2/analysis_check.py /tmp/prism-budget-matched-task2/sequence-copies
python3 /tmp/prism-budget-matched-task2/analyze.py --log /tmp/prism-budget-matched-task2/sequence-copies/baseline/periodic-fake.log --log /tmp/prism-budget-matched-task2/sequence-copies/candidate/periodic-fake.log --identity /tmp/prism-budget-matched-task2/sequence-copies/baseline/identity.json --identity /tmp/prism-budget-matched-task2/sequence-copies/candidate/identity.json --budget-errors 0 --output /tmp/prism-budget-matched-task2/review-round1-periodic-verdict.json
python3 /tmp/prism-budget-matched-task2/analyze.py --log /tmp/prism-budget-matched-task2/sequence-copies/baseline/periodic-interference-fake.log --log /tmp/prism-budget-matched-task2/sequence-copies/candidate/periodic-interference-fake.log --identity /tmp/prism-budget-matched-task2/sequence-copies/baseline/identity.json --identity /tmp/prism-budget-matched-task2/sequence-copies/candidate/identity.json --budget-errors 0 --output /tmp/prism-budget-matched-task2/review-round1-interference-verdict.json
just check
tasks check
```

RED evidence: review-round1-red-I1.log fails `missing callback end admitted a pair`;
after I1, review-round1-red-I2.log fails `contradictory early/late completion admitted
a pair`. Saved-log RED checks use the exact pre-review analyze.py git blob from
6f5d212, preserved as analyze-before-review.py; review-round1-red-saved-logs.log
fails `saved callback-free logs formed primary launch evidence`, and
review-round1-red-saved-I2.log fails `saved late completion was falsely admitted
into done group`. These read-only mutations never changed the saved logs or probe.

GREEN: review-round1-green.log and review-round1-green-saved-logs.log pass all
existing numeric/parser/interval/readiness fixtures plus I1/I2. Clean saved periodic
logs retain20 valid pairs, zero exclusions and primary pending launch/control
groups; foreign-interference logs retain18 valid and2 excluded raw pair groups.
All callback-free/terminal-end truncations and consistent late→done mutations are
inconclusive and cannot form primary launch evidence. Required just check/tasks
check exit0, zero warnings; evidence logs are review-round1-check.log and
review-round1-tasks-check.log. No check/process remains running.

Corrective evidence commit subject: fix(panel): reject incomplete and misordered
launch evidence. Its final hash is appended to the workspace report after commit
and supplied in the worker final response. Fresh scoped re-review is controller-owned.
Live host timings/acceptance remain unproved.

Review fix round1 final commit: c1c7d7400bfc12e647761e75153e680c5482a042 (`fix(panel): reject incomplete and misordered launch evidence`).

## Fix round2/5: explicit live-gate readiness and settled drain observability

BASE:b4f458f. Task3 preflight found missing startup/render/pair flags and no explicit
ready/final-drain state; the controller recorded impl review round3 revise before
dispatch. This is scratch instrumentation/schema only. No production, API, IPC,
button/tree, host install or desktop action changed.

The controller authorized one dedicated administrative observer callback before cold
setup. The click only sets its request flag. Ordinary deferred render, every active
drag (including nondirty100ms sampling) and due pair/cold render have priority.
The observer first uses the existing bounded flush so startup precedes readiness,
then emits a fixed ready metadata record before any measured cold/pair sample.
Cold setup→following actual-frame render remains unchanged. Startup now includes
initialRenderPending=false/initialPairEmpty=true, also required by normalization.

After an otherwise-idle flush drains its last chunk, a fresh direct drain snapshot
reports exact queue/describe/drag/render/refresh/selection/help/error state, pair and
comparison completion, sequence completion, zero buffer, sorted expanded/rack ids
and current profile (false means absent). eligibleDrain is false for busy, partially
expanded or otherwise unsettled state; buffer-empty alone cannot establish eligibility.
Partial chunks have remainingRecords/bufferEmpty on observerFlush. Snapshot collection,
JSON and logging run outside timed targets, and observerSnapshot records that overhead.
Direct emission appends/pops its own record without leaving anything buffered, so
there is no infinite self-buffering. All snapshot scopes are metadata/observer, excluded
from target classes. Frozen source modules and original endDrag/enqueue remain exact.

RED command on prior copies:

```sh
lua /tmp/prism-budget-matched-task2/self-check.lua /tmp/prism-budget-matched-task2/copies /tmp/prism-budget-matched-task2/model.lua integrations/noctalia-plugin/test_encode.lua "$PWD/bin/prism" readiness
```

review-round2-red.log fails `missing fresh runtime render/pair startup flags`.
The same command after rebuilding passes in review-round2-green.log: both startup
flags, ready before target work, exact final eligible drain, queue/normal describe/
comparison-callback/refresh/render/help busy refusals, all expanded ids/current profile,
partial chunks, unique contiguous record ids and finite drain. Requested readiness
yields to dirty frames, nondirty16+84ms sampling and ordinary deferred work; an aborted
start cannot claim readyEligible.

Exact covering commands (from .worktrees/panel-budget):

```sh
python3 /tmp/prism-budget-matched-task2/build.py --baseline 9bf4e8e --candidate e7384b0 --cli "$PWD/bin/prism" --output /tmp/prism-budget-matched-task2/copies --nonce task2-calibration-01
python3 /tmp/prism-budget-matched-task2/build.py --baseline 9bf4e8e --candidate e7384b0 --cli "$PWD/bin/prism" --output /tmp/prism-budget-matched-task2/sequence-copies --nonce task2-sequence-01 --cold-pairs 1 --launch-pairs 5
lua /tmp/prism-budget-matched-task2/self-check.lua /tmp/prism-budget-matched-task2/copies /tmp/prism-budget-matched-task2/model.lua integrations/noctalia-plugin/test_encode.lua "$PWD/bin/prism" readiness
lua /tmp/prism-budget-matched-task2/self-check.lua /tmp/prism-budget-matched-task2/copies /tmp/prism-budget-matched-task2/model.lua integrations/noctalia-plugin/test_encode.lua "$PWD/bin/prism"
lua /tmp/prism-budget-matched-task2/self-check.lua /tmp/prism-budget-matched-task2/sequence-copies /tmp/prism-budget-matched-task2/model.lua integrations/noctalia-plugin/test_encode.lua "$PWD/bin/prism" periodic
python3 /tmp/prism-budget-matched-task2/analysis_check.py /tmp/prism-budget-matched-task2/sequence-copies
python3 /tmp/prism-budget-matched-task2/analyze.py --log /tmp/prism-budget-matched-task2/copies/baseline/readiness-fake.log --log /tmp/prism-budget-matched-task2/copies/candidate/readiness-fake.log --identity /tmp/prism-budget-matched-task2/copies/baseline/identity.json --identity /tmp/prism-budget-matched-task2/copies/candidate/identity.json --budget-errors 0 --output /tmp/prism-budget-matched-task2/review-round2-readiness-verdict.json
python3 /tmp/prism-budget-matched-task2/integrity-check.py --copies /tmp/prism-budget-matched-task2/copies --baseline-identity .superpowers/sdd/2026-10-11-panel-budget-tokens-and-launch/baseline-identity.json --candidate-identity .superpowers/sdd/2026-10-11-panel-budget-tokens-and-launch/task-1-candidate-identity.json --model .superpowers/sdd/2026-10-11-panel-budget-tokens-and-launch/readonly-describe.json
noctalia plugins lint /tmp/prism-budget-matched-task2/copies/baseline/plugin
noctalia plugins lint /tmp/prism-budget-matched-task2/copies/candidate/plugin
just check
tasks check
```

Results: readiness, existing cold142-unit/timeline/collision/deferred/dirty/nondirty
cadence, periodic clean/foreign/error/timeout and parser/numeric/I1/I2 saved-log fixtures
all PASS. Both lint runs0 errors/0 warnings. Six frozen blobs, byte-identical non-entry
modules, unique anchors and reverse/identical transforms pass. just check exits0;
no task-check warnings. No repository suite rerun: scratch-only change, no affected
production behavior. Covering logs are review-round2-green.log, -existing.log,
-periodic.log, -analysis.log, -integrity.log, -lint-baseline.log, -lint-candidate.log
and -check.log. The regenerated source/identity/diff copies are preserved in archive.

Current identical instrumentation SHA256: 85968157946f938c569ea9c23f4b0749b50e01866a112fd98dbcc1538c31966a.
Changed attachments are probe.lua, tail.lua, self-check.lua, analyze.py,
analysis_check.py, portable manifest, README, report and archive. Child only; controller
notes/Task3/parent records are untouched. All checks finished, no process remains.
Corrective commit subject: fix(panel): emit ready and settled drain evidence; final
hash is appended after commit in this workspace report and worker final. Root owns
fresh scoped re-review and Task3 four-copy generation; desktop permission and live
host acceptance remain missing.

Fix round2 final commit: 8911851f4b77521efe376c26a9a88b05826bbc89 (`fix(panel): emit ready and settled drain evidence`).

## Fix round3/5: accepted ordinary render pending before diagnostic click

BASE:8911851. Scoped re-review task-2-rereview-2.md (codex/gpt-6.1-sol) found one
Important readiness-ordering issue; controller recorded impl round4 revise and reopened
the child before dispatch. The existing test changed inputs after click, so it did not
cover an accepted ordinary describe already waiting for its deferred render.

Minimal fix: while readiness remains requested and ordinary frame work is due, invoke
the existing ordinary tick exactly once with its normal dragTick/deferredRender/
profileRender/idle classification and return. Preserve the request. No sequence work
can run through that path; only after the observer callback emits readiness may cold
setup start. diagnosticDeferred is consumed exactly as in the original ordinary path.
No general scheduler, production, host, UI, API, IPC or probe-prefix change occurred.
Changed code is tail.lua and its focused fake fixture in self-check.lua.

Focused RED and GREEN command (from .worktrees/panel-budget):

```sh
lua /tmp/prism-budget-matched-task2/self-check.lua /tmp/prism-budget-matched-task2/copies /tmp/prism-budget-matched-task2/model.lua integrations/noctalia-plugin/test_encode.lua "$PWD/bin/prism" pending-ready
```

review-round3-red.log fails `before-click pending ordinary render bypassed readiness
barrier` on the previous copies. After rebuilding with the existing exact frozen
builder commands, review-round3-green.log passes both variants. Sequence: accepted
ordinary describe before click → one original deferred render (no additional decode,
request intact, no ready emitted) → dedicated ready observer (no render/decode) →
cold setup → cold render on following actual frame. The fixture independently asserts
the ordinary deferred callback class and exact render/decode counts.

Covering commands retain the same worktree, fixture and CLI args above, replacing the
last mode with readiness, with no mode for existing calibration, or with periodic and
sequence-copies for regular updates. Existing parser command is
`python3 /tmp/prism-budget-matched-task2/analysis_check.py /tmp/prism-budget-matched-task2/sequence-copies`.
Builder, integrity-check, both offline lint and just check commands are the exact
round2 commands already listed, with round3 result filenames.

Results: focused pending-ready, readiness/drain, cold142-unit equivalence, immediate/
next-frame pairs, collision, ordinary/dirty/nondirty100ms precedence, periodic clean/
foreign/error/timeout, numeric/parser/I1/I2/saved-log fixtures all PASS. Frozen-source
identity/reversible/identical instrumentation checks PASS; lint0 errors/0 warnings
each copy; just check exit0 and no task warnings. Covering logs:
review-round3-green.log, -readiness.log, -existing.log, -periodic.log, -analysis.log,
-integrity.log, -lint-baseline.log, -lint-candidate.log and -check.log.
No unchanged repository suite repeated, no live host action and no running check.

Current identical instrumentation SHA256: 9e92f80e44beea68ef3318eba78ada68b2f67140997a202425addc5b6c501e29.
Amended tail/self-check, portable manifest, regenerated source/identity/diff copies,
report and archive are preserved through child attachments. Parent/Task3 records are
not staged. Corrective commit subject: fix(panel): preserve pending render before
readiness; final hash appended after commit in workspace report and worker final.
Root owns the next scoped re-review; live acceptance remains unproved.
