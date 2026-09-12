---
id: prism-02ea50
title: Pin the untested context-CLI edges
status: todo
priority: 3
size: xs
complexity: low
created: 2026-09-05T22:55:53Z
updated: 2026-09-12T16:46:10Z
depends: []
tags: [cli, testing]
---

Three rules the context-layers branch states but leaves to inference. (1) context deactivate state, and an unknown kind: assertKind is wired into the deactivate call site but nothing exercises it there — the only reserved-kind coverage targets save and the top-level usage error. (2) context list with zero contexts of a kind, and kind-vs-name validation order when both are invalid. (3) Deleting an INACTIVE context while the active state is broken is refused, because the resulting state is the same broken state — a deliberate consequence of 'the resulting state must resolve' plus the rule that a dangling profile is an error for every verb, with 'deactivate first' as the documented recovery; today it is only traced through the code. Each is cheap to add to test/context-cli.test.js and each pins a stated rule rather than an implementation detail.
