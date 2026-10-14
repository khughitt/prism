---
id: prism-111a3f
title: Recover staged panel budget capture
status: doing
priority: 2
size: s
complexity: mid
process: planned
owner: fix/panel-render-budget
created: 2026-10-13T22:07:51Z
updated: 2026-10-14T00:07:43Z
started: 2026-10-13T22:08:29Z
depends: []
parent: prism-f15cbf
tags: [performance]
agent: codex
spec: docs/specs/2026-10-13-panel-budget-capture-recovery-design.md
plan: docs/plans/2026-10-13-panel-budget-capture-recovery.md
---

Approved capture recovery design (spec round3) and proposed implementation plan. Build and review incremental named-tmux collection, scratch readiness/reference records, ordered staged analysis and controller gates; prove a real-turn headless rehearsal before fresh desktop use. Stage1 cold/launch evidence precedes conditional Stage2 owner-heavy acceptance. Original Task6 performance acceptance remains open until complete targets/launch/restoration pass; no protocol implementation before plan approval.

## Notes

- 2026-10-13T22:08:29Z (fix/panel-render-budget): started
  provenance: {"harness_session":"codex:01a126fc-fa1d-7c71-8177-24d23ad4bf26","harness_session_source":"CODEX_THREAD_ID"}
- 2026-10-13T22:08:29Z (fix/panel-render-budget): Draft capture recovery spec prepared from frozen stabilized-r2 evidence. Grouped owner instructions retain per-activation confirmation, strict render-class/capture gates, exact restoration, original targets and keep/revert thresholds. No implementation plan/protocol or production changes before written review; no new desktop request.
- 2026-10-13T22:11:42Z (fix/panel-render-budget): Self-review: no placeholders, collection/protocol scope bounded, missing samples cannot be relabelled, original thresholds and numeric keep/revert inherited exactly. just check/tasks check exit0 with zero errors/warnings; diff check clean. Root verified original plugin pointer, rotation active/waiting/enabled and host-load nothing running. Written design pending owner review; no protocol implementation or live retry.
- 2026-10-13T22:11:43Z (fix/panel-render-budget): parked (waiting on user, review): Owner reviews proposed docs/specs/2026-10-13-panel-budget-capture-recovery-design.md; after acceptance root writes implementation plan for review, with fresh desktop permission only after implementation and complete pilot preparation.
  provenance: {"harness_session":"codex:01a126fc-fa1d-7c71-8177-24d23ad4bf26","harness_session_source":"CODEX_THREAD_ID"}
- 2026-10-13T22:50:50Z (fix/panel-render-budget): resumed
  provenance: {"harness_session":"codex:01a126fc-fa1d-7c71-8177-24d23ad4bf26","harness_session_source":"CODEX_THREAD_ID"}
- 2026-10-13T22:50:50Z (fix/panel-render-budget): review: spec round 1 — verdict: revise; findings: Important 6, Minor 4; reviewer: claude-code/claude-opus-5-5
- 2026-10-13T22:52:32Z (fix/panel-render-budget): Review verified against complete r2 timelines: C1 release293229.033588, close293229.640423, changedDescribe293229.723143, no release-origin deferred render; C2 close294797.366679 precedes Q describe294797.518068. Frozen runbook disallows background collector, so revised harness-tracked execution must explicitly supersede that rule. Durable private preservation: /home/keith/.local/state/prism/panel-budget/task3-2026-10-13-preserved (ext4, mode0700), 565 files/122800287bytes source/copy SHA256 verified; manifest sibling mode0600. No host/runtime controls changed.
- 2026-10-13T23:00:31Z (fix/panel-render-budget): attached: spec-review-1-report.md (7788 bytes): Full read-only spec review supplied by claude-code/claude-opus-5-5, round1 revise Important6/Minor4; controller-persisted text.
- 2026-10-13T23:02:35Z (fix/panel-render-budget): Spec revision addresses I1 both close races +2s/5s Prism dwells/early-P fixture; I2 one expressly approved replacement packet per short class/runtime; I3 yielded tracked foreground session, operation-qualified stop, ≤2s polls tightened to file-fill T/4 and gap T/2, full-burst capture test; I4 durable private565-file preservation/reproducible source commits; I5 proposed Stage1 cold/launch-only gate with explicit early-revert and pending-stage2 decisions, Stage2 fresh-runtime colds recaptured/no pooling; I6 pre-card canonical/scratch/P check then auto-expand separate strict readiness. M1 time breakdown/old10min estimate, M2 full canonical Q equality observer outside timing, M3 artifact scope/new hashes/nonces, M4 terms/task/>half/elapsed-vsCPU added. No protocol/analyzer implementation or host run.
- 2026-10-13T23:03:22Z (fix/panel-render-budget): Revised-spec self-review: staging amendment marked proposed, no implicit change to approved Part5; only complete cold gain failure allows early revert, cold absolute failure returns to design without keep, and short launch groups cannot advance. Stage2 full gate/own-runtime cold recapture unchanged. Polling/rate and dwell numbers explicit; readonly canonical observer cannot postpone queue work; recovery cap and source/reference failures distinguished. just check/tasks check/diff check clean, no warnings. Only docs/record/review attachment changed; suite/live run not repeated.
- 2026-10-13T23:03:22Z (fix/panel-render-budget): parked (waiting on user, review): Owner re-reviews revised docs/specs/2026-10-13-panel-budget-capture-recovery-design.md including proposed Stage1/Stage2 exception; on acceptance root writes the implementation plan for review. No protocol implementation or new desktop run before those gates.
  provenance: {"harness_session":"codex:01a126fc-fa1d-7c71-8177-24d23ad4bf26","harness_session_source":"CODEX_THREAD_ID"}
- 2026-10-13T23:12:49Z (fix/panel-render-budget): resumed
  provenance: {"harness_session":"codex:01a126fc-fa1d-7c71-8177-24d23ad4bf26","harness_session_source":"CODEX_THREAD_ID"}
- 2026-10-13T23:12:49Z (fix/panel-render-budget): review: spec round 2 — verdict: revise; findings: Important 2, Minor 3; reviewer: claude-code/claude-opus-5-5
- 2026-10-13T23:18:57Z (fix/panel-render-budget): Round2 review verified: hq-5e067c is todo; hq command-lifetime brief confirms unexplained yielded-session SIGTERM around13min and named tmux workaround. Local tmux3.8/man confirms named independent server/detached lifetime/exit options; no server launched. Revision chooses named tmux with recorded identities/traps, 35min uninterrupted live cap (20min card+10min one combined recovery+5min allowance), seconds-long smoke then ≥40min real-turn-boundary headless rehearsal under45min watchdog. No Codex wake/restart assumption. Precedence row1 explicitly wins for incomplete other block/error count; new fixtures required. Incremental reads/hash with full checkpoints, shared-clock overlap reporting, one combined recovery packet/runtime, accurate preserved-root privacy wording added.
- 2026-10-13T23:20:26Z (fix/panel-render-budget): attached: spec-review-2-report.md (4856 bytes): Full read-only round2 spec review supplied by claude-code/claude-opus-5-5; Important2/Minor3, prior ten findings addressed. Controller-persisted text.
- 2026-10-13T23:20:26Z (fix/panel-render-budget): Ruling: retain cold-pass/short-launch return-to-design after the single combined same-activation recovery; separate launch-only recollection is not authorized here. It bounds owner work; cost if wrong is one extra design revision. Round2 revised proposal addresses Important2/Minor3 but tmux/probe/analyzer changes and ≥40min headless rehearsal remain unimplemented and gated on written spec/plan approval.
- 2026-10-13T23:21:43Z (fix/panel-render-budget): Round2 revised-spec self-review: ordered predicates reject unknown/error/incomplete evidence before any revert; row2 says row1 does not apply. Timed live collector cap35min differs explicitly from fixed headless watchdog45min, ≥40min producer/rehearsal, with cleanup even if next turn late; no restart/wakeup promise. Full verification gates all incremental evidence; overlaps reported without deletion/subtraction. One combined packet example covers release+Q losses. All proposals remain unimplemented. just check/tasks check/diff check exit0, no warnings; no suite or live rehearsal run.
- 2026-10-13T23:21:43Z (fix/panel-render-budget): parked (waiting on user, review): Owner re-reviews round2 revision of docs/specs/2026-10-13-panel-budget-capture-recovery-design.md; after acceptance root writes implementation plan. Named-tmux implementation and real-turn headless rehearsal remain future gates before any desktop request.
  provenance: {"harness_session":"codex:01a126fc-fa1d-7c71-8177-24d23ad4bf26","harness_session_source":"CODEX_THREAD_ID"}
- 2026-10-13T23:27:13Z (fix/panel-render-budget): resumed
  provenance: {"harness_session":"codex:01a126fc-fa1d-7c71-8177-24d23ad4bf26","harness_session_source":"CODEX_THREAD_ID"}
- 2026-10-13T23:27:14Z (fix/panel-render-budget): review: spec round 3 — verdict: accept; findings: Minor 3; reviewer: claude-code/claude-opus-5-5
- 2026-10-13T23:50:22Z (fix/panel-render-budget): attached: spec-review-3-report.md (2996 bytes): Full supplied read-only spec round3 acceptance by claude-code/claude-opus-5-5, Minor3; owner approves planning. Controller persists report.
- 2026-10-13T23:50:22Z (fix/panel-render-budget): Spec round3 accepted/approved planning. Folded Minor3 into spec and plan: collector starts before enable; initial/recovery/controller timestamps explicit, smoke ceil1.25step+120≤300 reserve and late-approval/full600s checks; Keith post45min message/Task5 park; Noctalia clock proof at pre-pilot with source+r2 corroboration, synthetic rehearsal cannot prove it. Draft plan has seven dependency-ordered children, first blocked pending written plan review; preserved subagent-driven. No implementation/rehearsal/live changes.
- 2026-10-14T00:07:42Z (fix/panel-render-budget): Implementation plan self-reviewed: all approved spec sections and five ReviewFocus cases map to seven tasks; interfaces/schema2/operation ids/clock gates and stage ownership checked; placeholder scan clean. Numeric fixtures stage1=5min/stage2=8min, controller144s exact boundary vs144.000001 failure and full600s reservation independently checked. Corrected Lua tick versus boolean frame and actual inherited mode names/fixture23-profile count. just check/tasks check/diff check exit0, zero warnings. Task1 blocked until written plan approval; no code, tmux, rehearsal or desktop action.
- 2026-10-14T00:07:42Z (fix/panel-render-budget): parked (waiting on user, review): Keith reviews docs/plans/2026-10-13-panel-budget-capture-recovery.md; on acceptance root unblocks prism-73a117 and executes the preserved subagent-driven plan. Headless real-turn rehearsal and fresh desktop permission remain separate later gates.
  provenance: {"harness_session":"codex:01a126fc-fa1d-7c71-8177-24d23ad4bf26","harness_session_source":"CODEX_THREAD_ID"}
