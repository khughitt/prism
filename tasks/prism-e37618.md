---
id: prism-e37618
title: Design profile editing controls from the brief
status: dropped
priority: 2
size: s
complexity: high
created: 2026-09-13T11:09:26Z
updated: 2026-09-19T21:15:37Z
depends: []
parent: prism-3415ef
tags: [profiles]
source: docs/notes/2026-09-13-profile-editing-brief.md
---

Design the edited-since-load indicator and unloaded-profile rename/delete controls for prism-b8b589 and prism-920f31 using docs/notes/2026-09-13-profile-editing-brief.md. Start at integrations/noctalia-plugin/panel.luau (finishWrite, profileRow, commitName), queue.luau, presentation.luau, and test/context-cli.test.js. Prefer a panel-local edit marker and a management target picker; settle successful/failed queued writes, rapid profile switches, reopen/rename lifetime, and how the target stays distinct from the loaded profile. The CLI already supports inactive rename/delete. Produce one reviewed design with Lua acceptance cases for those transitions; do not redesign persistence, implement controls, or duplicate prism-bf3ae9 reset work. On completion add the finding with tasks note to prism-b8b589 and prism-920f31 in the same commit, and update the brief so default scoping can reconsider both.

## Notes

- 2026-09-19T21:15:37Z (prism-aec90f): dropped
  provenance: {"harness_session":"claude-code:1f37680c-20bd-40a3-9a1e-849bd9e3e3f7","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-09-19T21:15:37Z (prism-aec90f): superseded by the compositional profiles design, prism-aec90f
  provenance: {"harness_session":"claude-code:1f37680c-20bd-40a3-9a1e-849bd9e3e3f7","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
