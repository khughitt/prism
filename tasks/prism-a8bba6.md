---
id: prism-a8bba6
title: "One structure per accepted describe, and handlers that act by key"
status: done
priority: 1
complexity: mid
process: direct
owner: fix/panel-render-budget
created: 2026-10-10T17:06:03Z
updated: 2026-10-10T18:23:19Z
started: 2026-10-10T18:14:24Z
completed: 2026-10-10T18:23:18Z
depends: [prism-e68699]
parent: prism-dac509
tags: []
agent: claude-code/claude-opus-5-5
plan: docs/plans/2026-10-10-panel-render-budget.md
step: "Task 3: One structure per accepted describe, and handlers that act by key"
---

## Notes

- 2026-10-10T18:14:24Z (fix/panel-render-budget): started
  provenance: {"harness_session":"codex:01a12705-3efd-7ed3-b6bf-ef90747b81ac","harness_session_source":"CODEX_THREAD_ID"}
- 2026-10-10T18:15:23Z (fix/panel-render-budget): RED: just test-fast failed in plugin_test.lua at a render reuses the accepted rack; all 574 Node tests passed. Scope remains panel structure, key handlers, and three host fakes.
- 2026-10-10T18:16:18Z (fix/panel-render-budget): Task 3 green run found test/plugin-client.test.js asserts the old title derivation call; authorize minimal assertion update for structure.title and include that test file in the same commit. Behavioral title coverage stays unchanged.
- 2026-10-10T18:17:17Z (fix/panel-render-budget): GREEN: just test-fast exited 0; 574/574 Node tests passed and plugin Lua tests passed. tasks check exited 0 with no warnings. Controller approved removing two obsolete render-derivation source assertions in plugin-client.test.js.
- 2026-10-10T18:17:42Z (fix/panel-render-budget): done
  provenance: {"harness_session":"codex:01a12705-3efd-7ed3-b6bf-ef90747b81ac","harness_session_source":"CODEX_THREAD_ID"}
- 2026-10-10T18:17:42Z (fix/panel-render-budget): Build accepted panel structure once per describe; resolve parameter, drag, card and reset handlers against current keys.
  provenance: {"harness_session":"codex:01a12705-3efd-7ed3-b6bf-ef90747b81ac","harness_session_source":"CODEX_THREAD_ID"}
- 2026-10-10T18:21:39Z (fix/panel-render-budget): review: impl round 1 — verdict: revise; findings: Important 1; reviewer: codex/gpt-6.1-sol
- 2026-10-10T18:22:25Z (fix/panel-render-budget): resumed
  provenance: {"harness_session":"codex:01a12705-3efd-7ed3-b6bf-ef90747b81ac","harness_session_source":"CODEX_THREAD_ID"}
- 2026-10-10T18:23:18Z (fix/panel-render-budget): Fix round 1: replace three recursive test encoders with shared test_encode.lua fixture. RED test-fast failed at missing fixture; GREEN passed 574 Node plus Lua, including recursive ordering and 17-digit precision assertions. No production encoding changes; tasks check clean.
- 2026-10-10T18:23:18Z (fix/panel-render-budget): done
  provenance: {"harness_session":"codex:01a12705-3efd-7ed3-b6bf-ef90747b81ac","harness_session_source":"CODEX_THREAD_ID"}
- 2026-10-10T18:23:18Z (fix/panel-render-budget): Share test digest encoder across all three Lua host fakes; verify recursive ordering and numeric precision.
  provenance: {"harness_session":"codex:01a12705-3efd-7ed3-b6bf-ef90747b81ac","harness_session_source":"CODEX_THREAD_ID"}
