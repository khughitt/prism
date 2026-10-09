---
id: prism-1bb833
title: Add familiar to glass.tintSource
status: doing
priority: 2
size: m
complexity: mid
process: planned
owner: main
created: 2026-10-02T23:39:13Z
updated: 2026-10-09T04:42:38Z
started: 2026-10-09T04:42:38Z
depends: [material-6f45a0, prism-b4d118]
parent: prism-980a29
tags: [material, niri]
agent: claude-code/claude-opus-5-5
---

Why: glass.ring.colorSource already offers familiar (each terminal's ring takes its agent session's hue through niri-material's 'accent "ring"'); the glass tint offers only noctalia and manual (defs/glass.yaml glass.tintSource).

Outcome: glass.tintSource values [familiar, noctalia, manual]. Under familiar, each terminal's attenuation color mixes toward its session hue; a window without a session rests on the manual focused/unfocused tints, as the ring rests on its manual Color.

Blocked upstream: niri-material's accent selector is ring|none only. material-3bdffc designs the attenuation-tint response (spelling, weight, coexistence with the ring accent, missing-accent behaviour); material-6f45a0 implements it. Prism's render (integrations/niri/render.js responseBlock, which emits accent 'ring' or 'none' today) must emit whatever spelling that design settles, and expose its weight if it has one, possibly reusing glass.tintAccentMix.

Start: defs/glass.yaml tintSource/tintAccentMix; integrations/niri/render.js; integrations/niri/palette.js (remedy text names the sources); test/niri-render.test.js, test/glass-defs.test.js, test/niri-apply.test.js source matrix. Planned because the param shape depends on the upstream design.

## Notes

- 2026-10-09T04:34:40Z (main): Upstream unblocked: material-6f45a0 done; the response key is 'accent-tint' (0-1, default 0; recommended 1 on dark glass), independent of 'accent ring|none'; see niri-material docs/specs/2026-10-03-accent-tint-design.md and docs/materials/material-config.md. Absorbs prism-2b9a40; whether its weight gets a glass.inactive.* twin is a design choice here (prism-9bbe0a covers the Noctalia palette mix twin).
- 2026-10-09T04:42:38Z (main): started
  provenance: {"harness_session":"claude-code:5d047455-4e28-45eb-87c5-552951a08175","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
