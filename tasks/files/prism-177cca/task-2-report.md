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
