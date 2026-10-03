---
id: prism-4f8bab
title: Organize the Ring group on the Unfocused/Focused axis
status: doing
priority: 2
size: m
complexity: mid
process: planned
owner: prism-4f8bab
created: 2026-10-02T23:39:13Z
updated: 2026-10-03T09:53:40Z
started: 2026-10-03T09:34:03Z
depends: []
parent: prism-980a29
tags: [ui, material]
agent: claude-code/claude-opus-5-5
spec: docs/specs/2026-10-03-ring-axis-and-source-aware-colors-design.md
---

Why: the Focus group pairs each optic into Unfocused/Focused rows (ui.state + ui.row in defs/glass.yaml); the Ring group is a flat list, though its controls act on different windows. The focus light (Ring of light, Beam speed, Head wander, Wander rate, Decay distance, Glow, Resting ring) lights only the focused window; the signal accent (Accent strength, Edge tint) and the band (Gap, Width, Color) apply to every window.

Question for the spec: presentation only (Focused-only rows plus shared rows spanning both columns), or real per-state ring params? prism writes the same response block into terminal-glass and terminal-glass-inactive (integrations/niri/render.js responseBlock), so per-state accent and geometry values need no upstream change; whether per-state geometry looks right across a material swap needs checking (cf. material-5a5fff). Recommendation: start presentation-only, and split per state only the params that visibly should differ.

Start: defs/glass.yaml Ring section; integrations/noctalia-plugin/presentation.luau row pairing (~L159-200, ~L300-330); panel.luau column header (~L606); test/plugin-presentation.test.js. Lands first: it settles where the Ring rows live, so the source-aware swatch task (prism-b4d118) gates controls in their final layout.

## Notes

- 2026-10-02T23:46:52Z (main): owner 2026-10-02: the '?' marks an open idea, not low priority; raised to P2.
- 2026-10-03T09:34:03Z (main): started
  provenance: {"harness_session":"claude-code:41dbe03e-a467-49eb-9870-825e76fa1468","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-03T09:34:08Z (prism-4f8bab): resumed
  provenance: {"harness_session":"claude-code:41dbe03e-a467-49eb-9870-825e76fa1468","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-03T09:42:43Z (prism-4f8bab): spec drafted: one spec with prism-b4d118. Owner chose layout-only for the ring axis (no per-state ring params). Choices: sink-reported effective colors (rejected: describe computing them, panel reading the palette); ui.when gate; ui.subgroup + ui.column.
- 2026-10-03T09:42:47Z (prism-4f8bab): parked (waiting on user, review): owner reviews docs/specs/2026-10-03-ring-axis-and-source-aware-colors-design.md (in .worktrees/prism-4f8bab); then I write the implementation plan (writing-plans) in the same worktree
  provenance: {"harness_session":"claude-code:41dbe03e-a467-49eb-9870-825e76fa1468","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-03T09:51:44Z (prism-4f8bab): review: spec round 1 — verdict: revise; findings: P2 3; reviewer: codex
- 2026-10-03T09:52:53Z (prism-4f8bab): resumed
  provenance: {"harness_session":"claude-code:41dbe03e-a467-49eb-9870-825e76fa1468","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-03T09:53:39Z (prism-4f8bab): spec round 1 findings addressed: familiar ring Color read-only (only manual edits, per prism-b4d118 owner request); bypassed tint reads no palette and omits both tint keys; report travels with prism.kdl (renamed after validate, before reload) and is labelled 'as of the last apply', not the screen.
- 2026-10-03T09:53:39Z (prism-4f8bab): parked (waiting on user, review): spec round 2 review of docs/specs/2026-10-03-ring-axis-and-source-aware-colors-design.md (in .worktrees/prism-4f8bab); on accept, I write the implementation plan there
  provenance: {"harness_session":"claude-code:41dbe03e-a467-49eb-9870-825e76fa1468","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
