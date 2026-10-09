---
id: prism-1bb833
title: Add familiar to glass.tintSource
status: doing
priority: 2
size: m
complexity: mid
process: planned
owner: prism-1bb833
created: 2026-10-02T23:39:13Z
updated: 2026-10-09T14:05:05Z
started: 2026-10-09T04:42:38Z
depends: [material-6f45a0, prism-b4d118]
parent: prism-980a29
tags: [material, niri]
agent: claude-code/claude-opus-5-5
spec: docs/specs/2026-10-09-familiar-tint-source-design.md
plan: docs/plans/2026-10-09-familiar-tint-source.md
---

Why: glass.ring.colorSource already offers familiar (each terminal's ring takes its agent session's hue through niri-material's 'accent "ring"'); the glass tint offers only noctalia and manual (defs/glass.yaml glass.tintSource).

Outcome: glass.tintSource values [familiar, noctalia, manual]. Under familiar, each terminal's attenuation color mixes toward its session hue; a window without a session rests on the manual focused/unfocused tints, as the ring rests on its manual Color.

Blocked upstream: niri-material's accent selector is ring|none only. material-3bdffc designs the attenuation-tint response (spelling, weight, coexistence with the ring accent, missing-accent behaviour); material-6f45a0 implements it. Prism's render (integrations/niri/render.js responseBlock, which emits accent 'ring' or 'none' today) must emit whatever spelling that design settles, and expose its weight if it has one, possibly reusing glass.tintAccentMix.

Start: defs/glass.yaml tintSource/tintAccentMix; integrations/niri/render.js; integrations/niri/palette.js (remedy text names the sources); test/niri-render.test.js, test/glass-defs.test.js, test/niri-apply.test.js source matrix. Planned because the param shape depends on the upstream design.

## Notes

- 2026-10-09T04:34:40Z (main): Upstream unblocked: material-6f45a0 done; the response key is 'accent-tint' (0-1, default 0; recommended 1 on dark glass), independent of 'accent ring|none'; see niri-material docs/specs/2026-10-03-accent-tint-design.md and docs/materials/material-config.md. Absorbs prism-2b9a40; whether its weight gets a glass.inactive.* twin is a design choice here (prism-9bbe0a covers the Noctalia palette mix twin).
- 2026-10-09T04:42:38Z (main): started
  provenance: {"harness_session":"claude-code:5d047455-4e28-45eb-87c5-552951a08175","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-09T04:42:44Z (prism-1bb833): resumed
  provenance: {"harness_session":"claude-code:5d047455-4e28-45eb-87c5-552951a08175","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-09T04:45:08Z (prism-1bb833): spec drafted: docs/specs/2026-10-09-familiar-tint-source-design.md — new glass.accentTint + inactive twin (default 1, hidden outside familiar), accent-tint emitted only under familiar and unbypassed, pickers stay manual-only, probe renders familiar
- 2026-10-09T04:45:14Z (prism-1bb833): parked (waiting on user, review): owner reviews docs/specs/2026-10-09-familiar-tint-source-design.md in .worktrees/prism-1bb833; on approval, agent writes the implementation plan (docs/plans/) for review
  provenance: {"harness_session":"claude-code:5d047455-4e28-45eb-87c5-552951a08175","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-09T04:49:28Z (prism-1bb833): review: spec round 1 — verdict: revise; findings: P2 2; reviewer: codex
- 2026-10-09T04:49:28Z (prism-1bb833): Spec review: clarify that the familiar probe requires accent-tint support for every glass-enabled apply, including manual/noctalia, and document that minimum in README requirements; add render regressions for independent ring/tint sources and weight 0, plus accent-tint in the existing rejected-property probe tests.
- 2026-10-09T04:52:00Z (prism-1bb833): resumed
  provenance: {"harness_session":"claude-code:5d047455-4e28-45eb-87c5-552951a08175","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-09T04:52:30Z (prism-1bb833): spec revised for round 1: minimum niri (accent-tint) stated for every glass apply and in README requirements; render tests for familiar tint/manual ring, familiar ring/manual tint, both, and weight 0; accent-tint joins the probe rejected-property tests
- 2026-10-09T04:52:31Z (prism-1bb833): parked (waiting on user, review): owner re-reviews the round-1 revision of docs/specs/2026-10-09-familiar-tint-source-design.md in .worktrees/prism-1bb833; on approval, agent writes the implementation plan
  provenance: {"harness_session":"claude-code:5d047455-4e28-45eb-87c5-552951a08175","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-09T04:53:10Z (prism-1bb833): review: spec round 2 — verdict: accept; findings: none; reviewer: codex
- 2026-10-09T04:53:59Z (prism-1bb833): resumed
  provenance: {"harness_session":"claude-code:5d047455-4e28-45eb-87c5-552951a08175","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-09T04:59:03Z (prism-1bb833): plan written: docs/plans/2026-10-09-familiar-tint-source.md — 3 tasks (prism-531768 defs/rack/panel, prism-f8faee render, prism-21452c apply/probe/README); deviation: starter profiles carry the new keys (full-snapshot test), recorded in plan and corrected in spec by Task 1
- 2026-10-09T04:59:04Z (prism-1bb833): parked (waiting on user, review): owner reviews docs/plans/2026-10-09-familiar-tint-source.md in .worktrees/prism-1bb833 and picks an execution method; then agent runs Setup (npm install if needed, just test-fast baseline) and Task 1 (prism-531768)
  provenance: {"harness_session":"claude-code:5d047455-4e28-45eb-87c5-552951a08175","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-09T05:05:39Z (prism-1bb833): review: plan round 1 — verdict: revise; findings: P2 1; reviewer: codex
- 2026-10-09T05:05:39Z (prism-1bb833): Plan review: implementation and starter-profile adjustment match current contracts. Fix After the tasks live check (line 644): use .worktrees/prism-1bb833/bin/prism explicitly for set, apply, and restore; plain prism resolves to the main checkout, whose enum rejects familiar. Keep desktop permission and restore the previous source on failure too.
- 2026-10-09T05:06:28Z (prism-1bb833): resumed
  provenance: {"harness_session":"claude-code:5d047455-4e28-45eb-87c5-552951a08175","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-09T05:07:12Z (prism-1bb833): plan revised for plan review round 1: live check runs .worktrees/prism-1bb833/bin/prism by explicit path for set, apply and restore; restore recorded from describe (layer+value) and run by an ERR trap and unconditionally after the verdict; setup uses npm ci
- 2026-10-09T05:07:12Z (prism-1bb833): parked (waiting on user, review): owner re-reviews the round-1 revision of docs/plans/2026-10-09-familiar-tint-source.md and picks an execution method (recommended: native); then agent runs Setup (npm ci, just test-fast baseline) and Task 1 (prism-531768)
  provenance: {"harness_session":"claude-code:5d047455-4e28-45eb-87c5-552951a08175","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-09T05:11:12Z (prism-1bb833): resumed
  provenance: {"harness_session":"codex:01a11f11-6a8b-7d53-b950-22ef98c5de0b","harness_session_source":"CODEX_THREAD_ID"}
- 2026-10-09T05:11:20Z (prism-1bb833): review: plan round 2 — verdict: accept; findings: none; reviewer: human
- 2026-10-09T05:11:20Z (prism-1bb833): Execution authorized with subagent-driven development; reusing .worktrees/prism-1bb833. Live desktop check remains a separate owner gate.
- 2026-10-09T05:17:49Z (prism-1bb833): Task 1 accepted: defs, gated rack row and starter snapshots committed fdc63f2; renderer/probe requirements are assigned to Tasks 2 and 3.
- 2026-10-09T05:22:50Z (prism-1bb833): Task 2 accepted: familiar keeps stored resting tints and emits each material weight; unchanged golden and 561 Node tests plus Lua pass. Task 1 schema was reviewed separately; remaining apply/probe/docs checks belong to Task 3.
- 2026-10-09T05:27:56Z (prism-1bb833): Task 3 accepted: familiar capability probe, apply source matrix, palette remedies and README committed 412b2e2; installed /usr/bin/niri passed worktree probe without desktop reload. Whole-branch review next.
- 2026-10-09T05:31:04Z (prism-1bb833): review: impl round 1 — verdict: accept; findings: none; reviewer: codex/gpt-6-astra
- 2026-10-09T05:31:35Z (prism-1bb833): All three implementation tasks and whole-branch review accepted. Fresh just test-fast: 563 Node tests plus Lua pass; tasks check/just check clean. Awaiting separate live desktop permission and owner visual judgment; host unchanged.
- 2026-10-09T05:31:45Z (prism-1bb833): Rulings: carry full-snapshot defaults and native-field wording into spec (revert docs/snapshots if wrong); reserve live appearance for owner judgment (extra visual check if wrong); consume upstream accent-tint contract without shader/signal audit (upstream investigation if wrong); exclude combined sources and Noctalia focus-mix twin (additional scoped work if wrong). No deferred review findings.
- 2026-10-09T05:33:16Z (prism-1bb833): parked (waiting on user, review): Owner grants live desktop permission or explicitly skips visual acceptance; then controller performs the check with .worktrees/prism-1bb833/bin/prism, records judgment, restores the prior source, closes prism-1bb833 and integrates locally.
  provenance: {"harness_session":"codex:01a11f11-6a8b-7d53-b950-22ef98c5de0b","harness_session_source":"CODEX_THREAD_ID"}
- 2026-10-09T13:58:17Z (prism-1bb833): resumed
  provenance: {"harness_session":"codex:01a11f11-6a8b-7d53-b950-22ef98c5de0b","harness_session_source":"CODEX_THREAD_ID"}
- 2026-10-09T13:58:17Z (prism-1bb833): Live desktop check authorized by owner; temporarily select familiar via .worktrees/prism-1bb833/bin/prism and reload niri for up to 3 minutes, then restore original source and reload using an EXIT/TERM/INT trap.
- 2026-10-09T14:01:29Z (prism-1bb833): Live check restored: original profile-layer noctalia restored by removing the temporary scratch key; worktree apply niri succeeded and main describe succeeds. Owner evaluation blocked by panel calling main prism, whose enum omitted familiar; no tint verdict yet.
- 2026-10-09T14:01:29Z (prism-1bb833): Ruling: integrate the reviewed branch locally before retrying owner acceptance — the panel runs main prism and needs its familiar schema to adjust settings — cost if wrong: revert local integration; no push or launcher repoint.
- 2026-10-09T14:03:32Z (prism-1bb833): Reviewed branch integrated locally as f297b7d before visual retry. Main panel command prism describe succeeds and lists familiar/noctalia/manual; merged just test-fast passes 563 Node tests plus Lua, tasks check/just check clean. Retry requires fresh desktop permission; first check restored noctalia.
- 2026-10-09T14:05:05Z (prism-1bb833): parked (waiting on user, review): Owner grants a fresh 3-minute live retry or selects familiar in the now-updated panel and reports the visual verdict; controller then records acceptance, closes the task and completes worktree cleanup.
  provenance: {"harness_session":"codex:01a11f11-6a8b-7d53-b950-22ef98c5de0b","harness_session_source":"CODEX_THREAD_ID"}
