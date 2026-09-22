---
id: prism-b4d118
title: Ring Color stays editable under every color source
status: todo
priority: 2
size: s
complexity: mid
process: direct
created: 2026-09-22T15:37:30Z
updated: 2026-09-22T15:37:52Z
depends: []
tags: [defs, noctalia, ui]
agent: claude-code/claude-opus-5
---

Owner request 2026-09-22: when `glass.ring.colorSource` is `familiar` or `noctalia`, the Color control below it should not be adjustable; only `manual` should let the user set it.

Today `defs/glass.yaml` declares `glass.ring.colorSource` (enum familiar/noctalia/manual, order 510) and `glass.ring.color` (color, order 520) as two independent params, and nothing in the glass defs expresses "enabled only when another key holds a value" — the `ui:` keys in use are group, control, label, order, header, unit, step, row, scale, state, display, exponent. `defs/rack/devices.yaml` has a `requires:` notion for rack devices; whether that generalises or a new `ui` key is the right shape is the first decision here.

Behaviour to settle alongside the gating: `glass.ring.color`'s description today is "Ring color under the manual source; the resting color under familiar until its signal arrives, and the fallback under noctalia until a colorscheme exists", and `integrations/niri/render.js` really does fall back to it when `sources.noctaliaAccent` is absent, and really does emit it as the resting `ring-color` under `familiar`. So the value is not dead under the other two sources — it is the fallback. Greying the control means the fallback becomes whatever was last set (or the default `#ccccff`) with no way to change it. Either accept that and say so in the description, or give the disabled control a visible read-only value showing what is actually in force (the resolved Noctalia accent, or the resting color).

Scope: the def/UI mechanism, the Ring group's rendering in the Noctalia panel, and the presentation test that pins the Ring row list. Not a change to how render.js resolves the color.

## Notes

- 2026-09-22T15:37:52Z (main): Pairs with material-068639: the same Ring rows, and the familiar source is currently inert. Settle both descriptions together.
