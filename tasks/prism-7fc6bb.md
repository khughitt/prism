---
id: prism-7fc6bb
title: "Panel: size it so nearly every parameter fits without scrolling"
status: todo
priority: 2
size: s
complexity: low
process: direct
created: 2026-10-02T00:09:28Z
updated: 2026-10-02T00:09:28Z
depends: []
tags: [noctalia, ui]
agent: claude-code/claude-opus-5-5
---

Owner ask (2026-10-01): adjusting the glass means scrolling the panel. integrations/noctalia-plugin/plugin.toml fixes it at 756x798 (contract.test.mjs pins the same numbers). Grow the height, and the width if a second column of groups is cheaper than a taller list, so the Glass/Ring/Focus groups fit on a 1440p output without scrolling; keep a scroll fallback for smaller outputs. Re-check the per-render CPU budget (prism-5172ea), since more rows render at once.
