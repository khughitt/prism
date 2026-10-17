---
id: prism-7d38d8
title: Compact exact-equality metadata tokens
status: done
priority: 1
size: m
complexity: mid
process: direct
owner: fix/panel-render-budget
created: 2026-10-11T18:13:25Z
updated: 2026-10-11T18:40:43Z
started: 2026-10-11T18:31:21Z
completed: 2026-10-11T18:36:02Z
depends: [prism-b81188]
parent: prism-f15cbf
tags: []
agent: codex
spec: docs/specs/2026-10-10-panel-render-budget-design.md
plan: docs/plans/2026-10-11-panel-budget-tokens-and-launch.md
step: "Task 1: Compact exact-equality metadata tokens"
---

Implement approved Part5 compact tokens in panel.luau with exact raw equality, accepted-map lifecycle, optimistic precision regression and existing tree/handler/queue coverage. Freeze pre-token baseline; keep candidate performance status unaccepted until measurement.

## Notes

- 2026-10-11T18:31:21Z (fix/panel-render-budget): started
  provenance: {"harness_session":"codex:01a12c3a-f40a-7a00-b3c0-887ca3ad43aa","harness_session_source":"CODEX_THREAD_ID"}
- 2026-10-11T18:32:59Z (fix/panel-render-budget): Controller ruling: place acceptedStructure on existing host test-helper table rather than adding a top-level local, because the Lua chunk reached its 200-local limit. Current onOpen lookup remains per call; no production test accessor. Compile failure is not feature RED; missing contentToken still requires demonstrated RED.
- 2026-10-11T18:36:02Z (fix/panel-render-budget): evidence: just test-fast RED — 574 Node pass; Lua failed accepted structure has compact content tokens. GREEN — 574 Node and plugin Lua pass; exact-equality token lifecycle, rejected/invalidated publication, metadata tree equivalence and expanded optimistic precision covered. Candidate performance remains unaccepted.
- 2026-10-11T18:36:02Z (fix/panel-render-budget): done
  provenance: {"harness_session":"codex:01a12c3a-f40a-7a00-b3c0-887ca3ad43aa","harness_session_source":"CODEX_THREAD_ID"}
- 2026-10-11T18:36:02Z (fix/panel-render-budget): Compact exact-equality metadata tokens replace raw retained signature payloads; lifecycle and optimistic-precision regressions pass, performance candidate awaits in-host measurement.
  provenance: {"harness_session":"codex:01a12c3a-f40a-7a00-b3c0-887ca3ad43aa","harness_session_source":"CODEX_THREAD_ID"}
- 2026-10-11T18:40:43Z (fix/panel-render-budget): review: impl round 1 — verdict: accept; findings: none; reviewer: codex/gpt-6.1-sol
