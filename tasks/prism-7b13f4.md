---
id: prism-7b13f4
title: Presentation rack resolver
status: done
priority: 2
size: m
parallel: true
owner: device-chain
created: 2026-09-09T09:26:05Z
updated: 2026-09-09T10:16:37Z
depends: [prism-1f9fa1]
parent: prism-9331c1
tags: [noctalia, ui]
plan: docs/plans/2026-09-09-device-chain-rack.md
step: "Task 4: Resolve the rack in the presentation module"
---

Presentation.rack(model) resolves cards with bypassed and silenced flags, cardParams and rackParams; sections gains a group to skip.

## Notes

- 2026-09-09T10:16:37Z (device-chain): Rack resolver validates ownership and focus pairs, resolves dependencies and flattens card parameters for resets.
