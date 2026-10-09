---
id: prism-1bb833
title: Add familiar to glass.tintSource
status: doing
priority: 2
size: m
complexity: mid
process: planned
owner: prism-1bb833
created: 2026-10-02T23:39:13Z
updated: 2026-10-09T04:59:04Z
started: 2026-10-09T04:42:38Z
depends: [material-6f45a0, prism-b4d118]
parent: prism-980a29
tags: [material, niri]
agent: claude-code/claude-opus-5-5
spec: docs/specs/2026-10-09-familiar-tint-source-design.md
plan: docs/plans/2026-10-09-familiar-tint-source.md
---

Why: glass.ring.colorSource already offers familiar (each terminal's ring takes its agent session's hue through niri-material's 'accent "ring"'); the glass tint offers only noctalia and manual (defs/glass.yaml glass.tintSource).

Outcome: glass.tintSource values [familiar, noctalia, manual]. Under familiar, each terminal's attenuation color mixes toward its session hue; a window without a session rests on the manual focused/unfocused tints, as the ring rests on its manual Color.

Blocked upstream: niri-material's accent selector is ring|none only. material-3bdffc designs the attenuation-tint response (spelling, weight, coexistence with the ring accent, missing-accent behaviour); material-6f45a0 implements it. Prism's render (integrations/niri/render.js responseBlock, which emits accent 'ring' or 'none' today) must emit whatever spelling that design settles, and expose its weight if it has one, possibly reusing glass.tintAccentMix.

Start: defs/glass.yaml tintSource/tintAccentMix; integrations/niri/render.js; integrations/niri/palette.js (remedy text names the sources); test/niri-render.test.js, test/glass-defs.test.js, test/niri-apply.test.js source matrix. Planned because the param shape depends on the upstream design.

## Notes

- 2026-10-09T04:34:40Z (main): Upstream unblocked: material-6f45a0 done; the response key is 'accent-tint' (0-1, default 0; recommended 1 on dark glass), independent of 'accent ring|none'; see niri-material docs/specs/2026-10-03-accent-tint-design.md and docs/materials/material-config.md. Absorbs prism-2b9a40; whether its weight gets a glass.inactive.* twin is a design choice here (prism-9bbe0a covers the Noctalia palette mix twin).
- 2026-10-09T04:42:38Z (main): started
  provenance: {"harness_session":"claude-code:5d047455-4e28-45eb-87c5-552951a08175","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-09T04:42:44Z (prism-1bb833): resumed
  provenance: {"harness_session":"claude-code:5d047455-4e28-45eb-87c5-552951a08175","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-09T04:45:08Z (prism-1bb833): spec drafted: docs/specs/2026-10-09-familiar-tint-source-design.md — new glass.accentTint + inactive twin (default 1, hidden outside familiar), accent-tint emitted only under familiar and unbypassed, pickers stay manual-only, probe renders familiar
- 2026-10-09T04:45:14Z (prism-1bb833): parked (waiting on user, review): owner reviews docs/specs/2026-10-09-familiar-tint-source-design.md in .worktrees/prism-1bb833; on approval, agent writes the implementation plan (docs/plans/) for review
  provenance: {"harness_session":"claude-code:5d047455-4e28-45eb-87c5-552951a08175","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-09T04:49:28Z (prism-1bb833): review: spec round 1 — verdict: revise; findings: P2 2; reviewer: codex
- 2026-10-09T04:49:28Z (prism-1bb833): Spec review: clarify that the familiar probe requires accent-tint support for every glass-enabled apply, including manual/noctalia, and document that minimum in README requirements; add render regressions for independent ring/tint sources and weight 0, plus accent-tint in the existing rejected-property probe tests.
- 2026-10-09T04:52:00Z (prism-1bb833): resumed
  provenance: {"harness_session":"claude-code:5d047455-4e28-45eb-87c5-552951a08175","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-09T04:52:30Z (prism-1bb833): spec revised for round 1: minimum niri (accent-tint) stated for every glass apply and in README requirements; render tests for familiar tint/manual ring, familiar ring/manual tint, both, and weight 0; accent-tint joins the probe rejected-property tests
- 2026-10-09T04:52:31Z (prism-1bb833): parked (waiting on user, review): owner re-reviews the round-1 revision of docs/specs/2026-10-09-familiar-tint-source-design.md in .worktrees/prism-1bb833; on approval, agent writes the implementation plan
  provenance: {"harness_session":"claude-code:5d047455-4e28-45eb-87c5-552951a08175","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-09T04:53:10Z (prism-1bb833): review: spec round 2 — verdict: accept; findings: none; reviewer: codex
- 2026-10-09T04:53:59Z (prism-1bb833): resumed
  provenance: {"harness_session":"claude-code:5d047455-4e28-45eb-87c5-552951a08175","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-09T04:59:03Z (prism-1bb833): plan written: docs/plans/2026-10-09-familiar-tint-source.md — 3 tasks (prism-531768 defs/rack/panel, prism-f8faee render, prism-21452c apply/probe/README); deviation: starter profiles carry the new keys (full-snapshot test), recorded in plan and corrected in spec by Task 1
- 2026-10-09T04:59:04Z (prism-1bb833): parked (waiting on user, review): owner reviews docs/plans/2026-10-09-familiar-tint-source.md in .worktrees/prism-1bb833 and picks an execution method; then agent runs Setup (npm install if needed, just test-fast baseline) and Task 1 (prism-531768)
  provenance: {"harness_session":"claude-code:5d047455-4e28-45eb-87c5-552951a08175","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
