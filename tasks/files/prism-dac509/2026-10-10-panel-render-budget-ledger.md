# SDD ledger — plan: docs/plans/2026-10-10-panel-render-budget.md

Execution start: 5d0047d; branch fix/panel-render-budget; worktree .worktrees/panel-budget. Spec approved round 2; plan approved round 4. User chose subagent-driven execution.

## Preflight: per-task consistency
| Task | Tests/code/files consistency |
| --- | --- |
| 1 | Metadata cache remains per-entry; rackState mutates current refs; assertions match the proposed API. |
| 2 | Memo get/keep/clear and trace assertions agree; failed builders remain uncached. |
| 3 | Build structure and current-key handlers match tests; removed-section guard and keyboard/Keep freshness follow in Task 4 before retention. |
| 4 | Deferral, lifecycle fake encoder/ticks and no-op removed keys/scopes agree; synchronous release remains required. |
| 5 | Signature composition, structure eviction, equivalence and focus walk agree; every builder input must be verified during task review. |
| 6 | Live probe requires a new desktop approval; complete samples and restore precede gate; ceilings remain blocked until passage. |
| 7 | Real describe ceiling test consumes completed host gate; initial zeros intentionally RED; count ratio must also pass. |
| 8 | Contract/spec implementation status and closure depend on host passage plus cost ceilings. |

## Preflight: shared files/interfaces
| Tasks | Producer / consumer and shared files | Finding |
| --- | --- | --- |
| 1, 2 | plugin_test; earlier tests/host fakes remain compatible with later changes | No contradiction; ordered execution |
| 1, 3 | plugin_test; rackState/current param refs consumed by structure/render | No contradiction; ordered execution |
| 1, 4 | plugin_test; earlier tests/host fakes remain compatible with later changes | No contradiction; ordered execution |
| 1, 5 | plugin_test; cached per-entry metadata consumed by retained builders | No contradiction; ordered execution |
| 2, 3 | plugin_test; test blocks append independently; retain package preload precedes panel requiring it | No contradiction; ordered execution |
| 2, 4 | plugin_test; test blocks append independently; retain package preload precedes panel requiring it | No contradiction; ordered execution |
| 2, 5 | plugin_test; memo API consumed by wrappers and structure eviction | No contradiction; ordered execution |
| 3, 4 | contract, lifecycle, panel, plugin_test; current/resetScope/structure consumed by deferral freshness | No contradiction; ordered execution |
| 3, 5 | panel, plugin_test; digest/ids/current handlers consumed by retention | No contradiction; ordered execution |
| 3, 7 | contract; earlier tests/host fakes remain compatible with later changes | No contradiction; ordered execution |
| 4, 5 | panel, plugin_test; pending render schedule consumed by retained render | No contradiction; ordered execution |
| 4, 6 | ; described/endDrag/frame tick consumed by scratch wrappers | No contradiction; ordered execution |
| 4, 7 | contract; deferred describe consumed by separated measurements | No contradiction; ordered execution |
| 5, 6 | ; retainedMemo and callback locals consumed by scratch probe | No contradiction; ordered execution |
| 5, 7 | ; retainedMemo consumed by real-model harness | No contradiction; ordered execution |
| 6, 7 | ; passing in-host measurement gates offline ceilings | No contradiction; ordered execution |
| 6, 8 | ; host figures required for implemented status and close | No contradiction; ordered execution |
| 7, 8 | ; ceiling evidence required for contract and close | No contradiction; ordered execution |

## Scope
Production: presentation derivations, rack state, panel structure/current-key closures/frame ticks, retain module. Callers/tests: plugin Lua harness, real describe contract harness, native slider lifecycle harness. Docs: plugin contract and design status after host gate. No queue, CLI, host API or shared-launcher change. Regression risks: stale handler writes, retention missing inputs, loss of focus order, tick leakage and slider correction schedule.

## Tasks
- [x] Task 1
- [x] Task 2
- [x] Task 3
- [x] Task 4
- [x] Task 5
- [ ] Task 6 (desktop approval at point of use)
- [ ] Task 7 (host gate first)
- [ ] Task 8

Baseline initially lacked yaml dependency; README names npm install, no just setup exists. README npm install completed. Baseline just test-fast passed: 574 Node tests, plugin Lua checks, zero failures.

Task 1: dispatched /root/task1_implement (gpt-6-luna/high), BASE 5d0047d.
Task 1: implementation 6e8dc46; RED nil rackState; GREEN 574 + Lua. Dispatched /root/task1_review (gpt-6.1-sol/medium), review pending.
Task 1: minor (deferred): presentation.luau:38 omitted requested one-line curved-track explanation; behavior preserved.
Task 1: cross-task verification items (host timing/equivalence/ceilings/logs) belong to Tasks 5-7; not missing Task 1 implementation.
Task 1: complete (commits 5d0047d..6e8dc46, review clean apart from deferred minor).
Task 2: dispatched /root/task2_implement (gpt-6-luna/high), BASE 6e8dc46.
Task 2: complete (commits 6e8dc46..db2a0e6, review clean). Integrated equality/timing checks remain Tasks 5-7.
Task 3: dispatched /root/task3_implement (gpt-6.1-sol/high), BASE db2a0e6.
Task 3: Ruling: remove exactly the two obsolete title/section derivation-call assertions in test/plugin-client.test.js — the planned structure reads deliberately replace them, and runtime layout-reuse plus existing title/section behavior checks cover their purpose — cost if wrong: removing source-level coverage; all remaining assertions and behavioral tests stay.
Task 3: implementation 96552b3; 574 + Lua pass; /root/task3_review (gpt-6.1-sol/high) reviewing.
Task 3: Ruling: replace the three plan-mandated recursive encoder copies with one test-only Lua fixture — all harnesses already receive pluginDir/here, so sharing removes duplicated logic without unifying the harnesses or changing production; cost if wrong: one additional test fixture dependency. Task 7 must reuse that fixture rather than add a fourth encoder.
Task 3: fix round 1 dispatched to original implementer; FIX_BASE 96552b3.
Task 3: fix round 1/5 (1 addressed, 0 open; commits 96552b3..aeabc12).
Task 3: complete (commits db2a0e6..aeabc12, review clean). Timing/equality/deferral are assigned downstream gates, not absent Task 3 work. Feedback lore-b691c9 records preflight/review conflict.
Task 4: dispatched /root/task4_implement (gpt-6.1-sol/high), BASE aeabc12.
Task 4: Ruling: update only the three lifecycle source-shape assertions in test/plugin-client.test.js to the planned pending-render/syncFrameTick schedule — literal old callback structure is deliberately replaced; preserve behavioral lifecycle assertions — cost if wrong: source-pattern coverage could miss a regression, mitigated by the new runtime lifecycle tests.
Task 4: implementation affcdc1; RED immediate describe render; GREEN 574 + Lua; /root/task4_review (gpt-6.1-sol/high) reviewing.
Task 4: Ruling: track panel open state when synchronizing frame ticks, retaining accepted model/queue completion after a late describe — the spec requires closed panels leave no ticks, which includes callbacks after close — cost if wrong: an added boolean lifecycle state; callback-after-close regression and reopen tests verify it.
Task 4: fix round 1 dispatched original implementer; FIX_BASE affcdc1.
Task 4: fix round 1/5 (1 addressed, 0 open; commits affcdc1..50b2e99).
Task 4: complete (commits aeabc12..50b2e99, review clean). Timing remains Task 6.
Task 5: dispatched /root/task5_implement (gpt-6.1-sol/high), BASE 50b2e99.
Task 5: Ruling: update the existing matrixRow source assertion in test/plugin-client.test.js from controlCell to retainedCell if it fails — the planned retained wrapper deliberately replaces the call; preserve all other assertions — cost if wrong: source-pattern coverage could miss a regression, mitigated by fresh-versus-retained runtime tests.
Task 5: implementation 75dd7e6; RED missing retainedMemo; GREEN 574 + Lua equivalence/reach/focus; /root/task5_review (gpt-6.1-sol/high) reviewing. Host pointer remains main checkout; host-load reports nothing running.
Task 5: minor (deferred): plugin_test.lua:2577 precision case changes accepted describe digest, so it does not isolate optimistic-value numeric signatures; current %.17g implementation correct.
Task 5: complete (commits 50b2e99..75dd7e6, review clean apart from deferred minor).
Task 6: prepare scratch probe and lint only, desktop/pointer actions require approval; Tasks 7-8 remain gated.
Task 6: scratch preparation DONE, /root/task6_prepare (gpt-6.1-sol/medium), report task-6-report.md. Probe /tmp/prism-task6-panel-budget-utpxfsy5/probe-plugin lint 0 errors/0 warnings. Required fresh live-pilot approval requested; no host side effects. Strict spec full-rebuild target remains <15 ms. Task 6 gate incomplete; Tasks 7-8 not started.
Stopped at Task 6 fresh live-desktop approval gate. Parent/Task 6 parked waiting on user (approval); owner approves pilot, controller resumes child in existing worktree, installs/restores prepared probe, collects/analyzes pilot, then requests full measurement. No host pointer changed; host-load nothing running. Tasks 7-8 and final branch review remain unstarted. Keep this workspace for resume; do not redispatch Tasks 1-5.

Task 6: pilot and full measured run completed as far as data permits; NOT complete / NOT accepted. Measured run 1791659395: cold med/max/n 21.39/23.65/5; drag 8.33/12.10/333; release 19.26/20.77/7; changed describe 10.00/11.52/14; deferred render 8.54/10.45/13; switch n0. Metric os.clock elapsed upper bound; zero measured-probe budget errors. Above-target causes unknown.
Task 6: controller closed probe before profile-phase confirmation; late switches ran original main plugin, yielding no measured switch callbacks and two original-plugin post-restoration budget errors. Recorded mistake and report correction; feedback hq-5e63d9 records unavailable async-prompt cancellation.
Task 6: restored original plugin pointer and reloaded; all 21 profile docs byte-equal full backups; exact scratch and active glass9 restored, latest independent wallpaper preserved; no canonical-value changes from pre-full snapshot. Undo of pilot-saved four wallpaper values retained source-only metadata. Fresh host-load: nothing running.
Task 6: evidence attached through tasks CLI to prism-f15cbf: task-6-measurement-report.md, full-1791659395-results.json, full-1791659395.log. Reports produced by /root/task6_prepare (gpt-6.1-sol/medium); child stopped, no pending commands or processes.
Stopped at spec part-5 performance gate: cold/release requirements missed; whole acceptance incomplete. Owner reviews measured report; agent revises design with these figures before more code lands. Tasks 7-8 and final branch review remain unstarted. Do not redispatch Tasks 1-5; keep plan workspace and worktree for design/resume.

Measurement qualification after next-step investigation: old Task 6 probe calls getfenv(1), documented by official Luau performance docs to deoptimize its affected environment. Production entry has no getfenv. Local Noctalia pushCallback uses lua_getglobal at dispatch, so direct assignment can replace onFrameTick without introspection. Prior timings may be inflated; magnitude unknown. Do not treat them alone as proof clean production misses targets.
Prepared /tmp/prism-budget-diagnostic-3_avin1d/probe-plugin by original Task 6 worker: coarse render/construction/native-readback and enqueue/run/native-launch spans; no getfenv/setfenv or host API-table mutation. Lint 0 errors/warnings; Lua compiler and structural checks pass; runtime untested. Report diagnostic-probe-report.md. No host/source changes or running children/processes. Parent/Task 6 parked at fresh live-host approval. Next agent runs one cold + one drag/release after approval, keeps probe until explicit human completion/stop, restores full saved state, then determines whether revised production design is needed. Tasks 7-8 remain gated.

Diagnostic 1791663060 executed after fresh owner approval; owner confirmed completion before restoration. One release14.706 ms: render14.473/native2.200, enqueue0.174/native launch0.071. Dirty drag n18 med6.2495/max8.507. Zero budget errors; no key/cold callbacks recorded, cause unknown. Not acceptance; rendering dominates this release sample, enqueue hypothesis not supported.
Original pointer/main reload, exact scratch/profile bytes verified, latest wallpaper preserved; host-load nothing running. Results report/data/log attached to prism-f15cbf via CLI.
Follow-up prepared by /root/task6_prepare: /tmp/prism-budget-cache-diagnostic-gdlbu7zz/probe-plugin; visible Cold rebuild button + per-render memo.trace ids/counts, no getfenv/setfenv, callback0 orphan records excluded, ids escaped against NUL log truncation. Lint/syntax/static checks pass; no live run. Reports diagnostic-results-report.md and diagnostic-follow-up-report.md; worker finished. Next outside-repo action needs fresh host approval: five cold button clicks + five releases, no profiles, saved state restored after explicit completion.

Diagnostic evidence committed 1c56364. Fresh just check passed with no warnings; exact scratch, glass9 and all 21 profile bytes reverified. Original main plugin pointer intact; host-load nothing running. Parent and Task 6 parked on owner approval for follow-up diagnostic. No follow-up run installed or executed; existing approval question remains pending. Tasks 7-8 and final branch review remain gated.

2026-10-11 follow-up diagnostic freshly approved and installed; marker 1791729887. Snapshot exact runtime, 23 profile docs and describe before host change. Host pointer temporarily /tmp/prism-budget-cache-diagnostic-gdlbu7zz/probe-plugin, original main pointer saved in run-state.json and task note. Owner completion prompt pending: five visible Cold rebuild clicks and five drag/releases; no profile switches. Probe remains installed until explicit completion/stop. Task6 worker preparing scratch-only parser, no host or repo mutations.

Follow-up1791729887 complete; original main pointer/reload verified, aquamarine and exact scratch unchanged, 23 profile docs byte-equal, canonical values same, latest wallpaper preserved. Cold n5 med/max20.597/21.149, release n6 19.7795/21.816, dirty drag n238 7.8985/11.613; zero budget errors. Cold rebuilt142; all releases and write completions rebuilt0. Source render has no explicit drag/release branch; remaining traversal/signature/derivations/unretained UI work shared. Evidence attached through CLI and committed e37cdcf with spec part5/status note and corrected getfenv probe. Commit hook first refused machine paths in host-log lines; redacted portable path markers through detach/reattach, all diagnostic records byte-identical; original scratch log retained. just check and parser self-check pass. Dedicated Task6 worker now running offline function-call profile on saved real describe; no live desktop or source work, no acceptance or ceilings.

Offline call-profile DONE by task6 worker:1907 typed leaves/821 shapes/83 keys/12 expanded cards verified; cold9742/142 misses,warm3514/0,drag3982/4,release3572/0,describe4426/0,deferred3737/5. Call-volume gap does not explain live timing gap; CPU/GC/scheduling/host context unknown. Report/results/repro scripts attached via CLI and committed c299996. New scratch warm comparison ready /tmp/prism-budget-warm-comparison-n3_7du6c/probe-plugin: no tracing; three render phases; one immediate + one following-frame unchanged render per button; no launches/values/cache changes in standalone self-check. Lint0/errors0/warnings, syntax+two-click self-check pass, worker finished. Fresh host approval question pending; no live run or pointer action. Parent/Task6 parked waiting on owner approval; status/spec notes committed d9e4a4a, fresh just check clean, original main pointer intact, host-load nothing running. After approval controller runs five Warm comparison clicks, keeps installed until explicit owner completion/stop, restores exact fresh snapshot/pointer, analyzes phases before proposing reviewed design changes. Tasks7-8 and whole-branch review remain gated.

Warm comparison freshly approved and installed at /tmp/prism-budget-warm-comparison-n3_7du6c/probe-plugin. Fresh aquamarine/runtime/23 profile bytes/describe/offset snapshots saved. Original pointer and restore command recorded on parent before installation. Owner completion prompt pending; keep installed until explicit complete/stop. No sliders, profiles, scratch clearing or writes requested. No child running; analyze frozen data after completion and restore.

Warm run1791731787 completed after explicit owner confirmation;80.405s collection. Original main pointer restored/reloaded; exact aquamarine/scratch/23 profile files/canonical values unchanged, no host processes left. Five raw button/frame pairs med8.522/8.124; four strict pairs exclude describe-interrupted82-to84; paired frame-minus-button med-0.028, differences both ways,0budget errors. No consistent ordinary-button penalty; context/input equality still limited. Phase assembly~4ms largest nonnative warm span. Evidence + parser attached via CLI, paths redacted without timing changes; committed4b88d0a with spec evidence, just check/parser self-check pass. Original worker now prepares NEW scratch readonly-launch comparison: unchanged render before one explicit worktree describe command, one pending frame during/after command, no values/queue writes/tracing. Hypothesis only: command-adjacent effects explain release/completion20ms. Fresh desktop approval will be asked after readiness; no launch probe installed. Cold20.6ms remains unresolved; Task6/Tasks7-8 unaccepted.

Launch comparison ready /tmp/prism-budget-launch-comparison-jx3_7ztr/probe-plugin: unchanged render before one readonly explicit worktree describe command, then one pending frame labelled while/after command, state metadata model identity/enqueued counters. Handler-only overlap guard; no command-dependent props, writes, queue/model updates, stdout logging or trace. Lint/syntax + both completion-timing standalone checks + integrity pass; controller inspected diff/verification, worker final confirms all checks stopped and nothing running. New host approval prompt pending; no launch probe installed/executed. Parent/Task6 parked waiting on owner approval, recorded c7292c3; just check clean, original main pointer intact, host-load nothing running. Next agent resumes Task6 after approval, fresh snapshot/offset/pointer note, five launch clicks, explicit completion then restore/analyze. Cold and release targets remain unresolved; do not advance Tasks7-8 or whole-branch review.

Owner Lets continue freshly approves readonly-launch comparison; installed /tmp/prism-budget-launch-comparison-jx3_7ztr/probe-plugin after snapshot of aquamarine/runtime/23 profile docs/describe/log offset and pointer restore note. Five-click completion prompt pending; preserve probe until explicit completion/stop. No slider/profile/scratch changes or writes requested. No child currently running; freeze data and restore before analysis.


Cold/release run1791735860 completed after explicit owner confirmation. Recovered one log rotation from saved offset in .1 plus current segment before restoration: one marker, five separate setup/render pairs, five actual releases, ten write completions, zero budget/error-level lines. Final drain queueIdle=true/describeRunning=false. Original main pointer restored/reloaded; exact aquamarine/scratch/23 profile bytes/canonical values unchanged; latest independent wallpaper preserved, no restoration write. Host-load nothing running.
Cold callback n5 med/max19.869/22.271, assembly15.479/native1.491; release n5 20.661/24.007 with long interval moving among top/presentation/assembly; completion n10 20.6045/23.514; dirty drag n182 7.969/11.060. Release heap net +295–298KB; neither snapshots nor elapsed phases identify CPU/GC/allocator/scheduling cause. Ordinary post-cold describe/deferred n11 med8.657/8.532; profile class missing. Diagnostic overhead remains. Report/JSON/parser/path-redacted chronological log attached via tasks CLI; redaction preserves all timing/heap/drain/done records and parsed fields exactly. Parser self-check passes. Saved JSON additionally includes controller verification/restoration/rotation metadata, outside parser output.
Original Task6 worker analysis DONE, no jobs. Read-only upstream issues/PRs/default+development branches/release notes checked; no matching render-latency fix found. Different upstream fork/deadlock/pipe-leak reports do not authorize a host workaround. No host patch or vendor-defect claim.
Part5 gate reached; Task6 raised planned/high. Architecture advice /root/panel_budget_design_revision (gpt-6-astra/high), proposal part5-revision-proposal.md: compact tokens backed by exact raw equality first; metadata getters only a later reviewed candidate; reject unmeasured scheduling changes. Advice is not a reviewer verdict. Agent finished, only scratch report written, nothing running.
Controller drafted complete proposed spec part5, keeping original targets and behavior. Scope only panel tokens/tests; keep/revert requires repeatable live timing improvement, not signature size alone. Each failed full-rebuild median returns to design before further code. Original plan status updated without changing implementation steps; revised implementation plan awaits owner written-spec review. Self-review checks exact equality, accepted/rejected map publication, token uniqueness/exhaustion, bounded lifecycle, optimistic precision, evidence links and original strict targets. Tasks7–8 and full branch review remain unstarted; do not redispatch Tasks1–5.

Proposed spec/evidence committed a5c80bc; just check/tasks check/diff check clean, worktree tracked status clean. Parent and Task6 parked waiting on owner written-spec review; controller next prepares reviewed implementation plan after approval. All children/checks stopped, host-load nothing running, original main plugin pointer verified. Production unchanged since Task5.

Owner spec review round3: revise, Important3/Minor1, human. Recorded on parent before acting; resumed parent/Task6, both trial-arm not enrolled. Checked endDrag enqueue-before-render and finishWrite next-launch/drained-refresh-before-render; readonly paired result had only before-launch and later-frame measurements. Luau local lstrlib supports %d via int64 formatting. No live host action or source mutation.
Applied all four spec requests: tokens explicitly target cold construction, release/completion separate unresolved hypothesis (shared signatures may shrink but heap attribution/causality unproved); one proposed live session includes immediate-post-launch/frame pairs and no-launch controls on baseline/candidate with valid-state/interference rules; cold keep requires gain >max(1ms, baseline MAD) in both matched blocks, per-class numeric no-regression and unchanged absolute acceptance gates; %d integer counter with only monotonicity assert, no injected overflow/exhaustion machinery/test seam. Full release-render deferral would violate synchronous correction, so any scheduling change still needs separate written review. Owner re-review then controller prepares revised implementation plan. Tasks7–8 remain gated; completed Tasks1–5 stay closed.

Review-round-3 doc revisions committed9c4a276; just check/tasks check/diff check pass without warnings, tracked worktree clean. No production edit, suite or live experiment. Parent/Task6 parked for owner written-spec re-review; after approval controller prepares revised implementation plan. Original main plugin pointer verified; host-load nothing running. All children stopped.

Continuation plan committed; spec owner round4 accepted. New children prism-7d38d8 (tokens), prism-177cca (probe/verdict), prism-4ba651 (pilot/measurement evidence), in sequence under original Task6. Owner plan review pending, execution choice preserved subagent-driven. Self-reviewed source/test reach, numeric boundaries, estimate fixture, input/pair classification, fresh runtime identity and restoration gates. just check/tasks check/diff check clean, tracked status clean, main plugin pointer verified, host-load nothing running. No code/test suite/live experiment run. Controller next freezes baseline and dispatches token child only after written-plan approval; original Tasks7–8 remain gated.
