---
id: prism-1601f9
title: One Lua harness for the three panel test files
status: todo
priority: 3
size: s
created: 2026-09-09T01:55:20Z
updated: 2026-09-09T01:55:20Z
depends: []
tags: [testing, noctalia, dx]
---

Three files now stand panel.luau up against a stubbed host, each with its own copy of the scaffolding: integrations/noctalia-plugin/plugin_test.lua sets globals and dofiles the panel, test/plugin-panel-lifecycle.test.js builds an env table with a metatable and loadfile, and integrations/noctalia-plugin/contract.test.mjs (prism-52bc13) builds a third. All three write the same ui node factory, the same panel.render capture, the same noctalia.runAsync recorder, and the same tree walker. They diverge in what they stub: only the lifecycle harness carries noctalia.state and focusedOutputName, so a panel that starts calling one of those breaks two files and not the third, for no reason a reader can see. Factor the env sandbox, the ui factory, the runAsync recorder, and the collect walker into one Lua module the three load, and let each file add only what it actually exercises. Worth doing when the next host call is added, not before -- the duplication costs nothing until then.
