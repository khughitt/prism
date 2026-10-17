---
id: prism-eba711
title: Cost ceilings on real describe output
status: done
priority: 1
complexity: low
process: direct
owner: fix/panel-render-budget
created: 2026-10-10T17:06:03Z
updated: 2026-10-17T21:17:28Z
started: 2026-10-17T21:15:12Z
completed: 2026-10-17T21:17:28Z
closed: 2026-10-17T21:17:28Z
depends: [prism-f15cbf]
parent: prism-dac509
tags: []
agent: claude-code/claude-opus-5-5
plan: docs/plans/2026-10-10-panel-render-budget.md
step: "Task 7: Cost ceilings on real describe output"
---

## Notes

- 2026-10-17T21:15:12Z (fix/panel-render-budget): started
  provenance: {"harness_session":"claude-code:2efe5e59-1ac2-4da3-a170-7b5188325415","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-17T21:17:28Z (fix/panel-render-budget): done
  provenance: {"harness_session":"claude-code:2efe5e59-1ac2-4da3-a170-7b5188325415","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-17T21:17:28Z (fix/panel-render-budget): Cost ceilings pinned in contract.test.mjs at 1.25x the 61fba00 counts (fullRender 8704 -> 10900, dragTick 3211 -> 4100, dragEnd 3103 -> 3900, describeChanged 3995 -> 5000, describeRender 3376 -> 4300, switchRender 7916 -> 9900); ratio check relaxed to dragTick under half a full render (c87359b), since retained renders still pay signature work.
  provenance: {"harness_session":"claude-code:2efe5e59-1ac2-4da3-a170-7b5188325415","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
