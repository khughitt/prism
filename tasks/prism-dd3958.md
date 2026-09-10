---
id: prism-dd3958
title: "Contract test: every queue argv is accepted by the CLI parser"
status: todo
priority: 2
size: s
created: 2026-09-10T17:00:50Z
updated: 2026-09-10T17:00:50Z
depends: []
tags: [testing, noctalia]
---

The panel and the CLI are upgraded together and the contract note promises skew fails loudly, but the queue's verbs are pinned by regex only. Run each Queue.argvFor shape against the real prism in a temporary store from contract.test.mjs and assert the failure, if any, is never a usage error. The shell was in exactly that state between the two 2026-09-09 merges: a panel emitting rename against a CLI without it.
