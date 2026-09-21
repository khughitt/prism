---
id: prism-7b09ce
title: Declare prism's command table and conform to the shared CLI vocabulary
status: done
priority: 2
size: m
complexity: mid
process: direct
owner: main
created: 2026-09-20T11:30:32Z
updated: 2026-09-20T13:23:21Z
started: 2026-09-20T13:12:23Z
completed: 2026-09-20T13:23:21Z
depends: []
tags: [cli, cross-project]
agent: claude-code/claude-opus-5
---

Adopt the shared CLI vocabulary: vendor tools/cli.toml (and tools/cli_surface.py), make the parser conform, add the conformance test. The steps are Task 9 in the ops plan docs/plans/2026-09-20-cli-conventions.md (spec docs/specs/2026-09-20-cli-conventions-design.md). Waits for the ops table task ops-c9ecf0 to land on ops main; the ops step ops-78ae37 tracks this piece.

## Notes

- 2026-09-20T13:12:23Z (main): started
  provenance: {"harness_session":"claude-code:20e55bde-4aed-4a6f-993d-b44b058f509f","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-09-20T13:23:21Z (prism-7b09ce): done
  provenance: {"harness_session":"claude-code:20e55bde-4aed-4a6f-993d-b44b058f509f","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-09-20T13:23:21Z (prism-7b09ce): src/commands.js declares the 21-row table; run() resolves argv through it (globals, help, version, usage exit 2, json error object, --color, completion); tools/cli.toml and cli_surface.py vendored; test/cli-surface.test.js conformance
  provenance: {"harness_session":"claude-code:20e55bde-4aed-4a6f-993d-b44b058f509f","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
