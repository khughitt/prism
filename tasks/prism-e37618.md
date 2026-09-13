---
id: prism-e37618
title: Design profile editing controls from the brief
status: todo
priority: 2
size: s
complexity: high
created: 2026-09-13T11:09:26Z
updated: 2026-09-13T11:09:26Z
depends: []
parent: prism-3415ef
tags: [profiles]
source: docs/notes/2026-09-13-profile-editing-brief.md
---

Design the edited-since-load indicator and unloaded-profile rename/delete controls for prism-b8b589 and prism-920f31 using docs/notes/2026-09-13-profile-editing-brief.md. Start at integrations/noctalia-plugin/panel.luau (finishWrite, profileRow, commitName), queue.luau, presentation.luau, and test/context-cli.test.js. Prefer a panel-local edit marker and a management target picker; settle successful/failed queued writes, rapid profile switches, reopen/rename lifetime, and how the target stays distinct from the loaded profile. The CLI already supports inactive rename/delete. Produce one reviewed design with Lua acceptance cases for those transitions; do not redesign persistence, implement controls, or duplicate prism-bf3ae9 reset work. On completion add the finding with tasks note to prism-b8b589 and prism-920f31 in the same commit, and update the brief so default scoping can reconsider both.
