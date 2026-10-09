---
id: prism-d63c5d
title: Emit one material when every split optic resolves equal
status: todo
priority: 3
size: s
complexity: low
process: direct
created: 2026-09-09T01:19:43Z
updated: 2026-10-09T04:35:07Z
depends: []
tags: [niri, material]
---

With glass.focusSplit on, the niri sink always writes terminal-glass and terminal-glass-inactive, even when they resolve identical. That happens when a user levels the matrix or turns the split on before tuning anything. niri then still swaps material names on every focus change, and apply_resolved rebuilds MaterialState on a name change, so the jelly residuals restart for no visual difference. Upstream kept the hard cut on focus swaps (material-8e3b73; material-5a5fff dropped), so prism still has to avoid it.

Mechanism: in renderNiriFragment (integrations/niri/render.js), compare activeGlass(params, sources) with inactiveGlass(params, sources). When they are equal, fall through to the unsplit shape, so the split costs nothing until it shows something. Compare the resolved optic objects, after source tints and bypass DRY overrides. The response block is shared, so it does not take part. Watch the assignment rules: the unsplit path emits one window-rule with no is-active match.

Done when: a test in test/niri-render.test.js shows that a leveled matrix under focusSplit emits one material and one is-active-free rule, and that one differing optic restores both. The probe (integrations/niri/probe-material) still renders both materials from the defs' defaults: the shipped inactive roughness differs, but assert it so a later default change, or prism-7e4766's inheritance, cannot silently drop the inactive material from the capability probe. just test-fast green.

## Notes

- 2026-10-09T04:35:06Z (main): scope: scoped; confirmed render.js still emits both materials under focusSplit and upstream keeps hard focus cuts (material-8e3b73); body now names the comparison point, the rule shape and a probe guard; set todo P3 s low direct
