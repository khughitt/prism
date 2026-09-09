---
id: prism-6e4868
title: Rack loader and describe field
status: todo
priority: 2
size: s
parallel: true
created: 2026-09-09T09:26:05Z
updated: 2026-09-09T09:26:05Z
depends: [prism-1f9fa1]
parent: prism-9331c1
tags: [cli, defs]
plan: docs/plans/2026-09-09-device-chain-rack.md
step: "Task 2: Load and validate the rack, and carry it in describe"
---

src/rack.js validates devices, rows, keys, bypass, and requires against the defs; describe --json carries rack verbatim.
