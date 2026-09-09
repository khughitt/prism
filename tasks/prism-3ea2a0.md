---
id: prism-3ea2a0
title: "Panel device cards, lights, expanders"
status: done
priority: 2
size: m
owner: device-chain
created: 2026-09-09T09:26:05Z
updated: 2026-09-09T10:25:18Z
depends: [prism-6e4868, prism-7b13f4]
parent: prism-9331c1
tags: [noctalia, ui]
plan: docs/plans/2026-09-09-device-chain-rack.md
step: "Task 5: Render the rack as device cards"
---

validateModel checks the rack; cards with category fill, light glyph, chevron, mix cells, an expanded bypass row with reset, detail rows; the contract harness expands cards.

## Notes

- 2026-09-09T10:23:14Z (device-chain): Red: plugin_test failed at missing Backdrop card; green: Lua panel suite and both focused Node harnesses pass.
- 2026-09-09T10:24:45Z (device-chain): Full gate exposed and fixed stale plugin-client source assertions for the new sections(params, rack.group) call and matrixRow indent argument.
- 2026-09-09T10:25:18Z (device-chain): Rendered the Focus rack as persistent expandable device cards with category lights, mix controls, bypass details, and contract coverage.
