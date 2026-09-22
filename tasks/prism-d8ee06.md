---
id: prism-d8ee06
title: Wire approved ring placement controls through profiles and the niri sink
status: done
priority: 2
size: s
complexity: mid
process: planned
created: 2026-09-19T00:26:01Z
updated: 2026-09-22T13:19:56Z
completed: 2026-09-22T13:19:56Z
depends: [material-92edaf]
tags: [niri, material]
source: "material:docs/notes/2026-09-18-ring-next-steps-brief.md"
model: "claude-opus-5[1m]"
agent: codex
---

Extend existing prism-28e29c wiring rather than build a new Ring panel. Placement gaps are ring-inset/ring-width: defs/glass.yaml currently exposes focus, colorSource, color and driftHz; integrations/niri/render.js responseBlock intentionally inherits native placement. After material-9306b5 visual decisions, define palette/profile/reset behavior and emit agreed values in both terminal-glass response default blocks; preserve familiar/noctalia/manual color semantics. Native inset is 0..128 and width is positive through 128; choose useful UI bounds during review, never silently clamp stored profiles. Validate generated face placement such as inset20/bevel12 against the new installed native build, plus ordinary and opaque cases; test omitted/new defaults, saved profiles, reset and both materials through just gates. Keep light-ior in prism-0ea68f. Motion controls wait for material-0e130e design; native scheduler owns visibility/activity, not a panel timer. No implementation or live apply before the native contract and installation checkpoint are verified.

## Notes

- 2026-09-22T13:19:50Z (main): Overtaken by the ring beam. The placement this task was to wire was ring-inset/ring-width; ring-inset is retired (replaced by ring-gap) and prism already exposes glass.ring.gap 0-128 default 8 through defs, both starter profiles, the manifest and the response block in both materials (prism-1514d3), alongside beamSpeed and glow. The 'inset20/bevel12' validation clause landed as gap 20 under bevel 12 in prism-71b7d1, checked on installed 649c731b, together with zero lip, widest offsets and small-bevel cases; light-ior went to prism-0ea68f as directed. The only clause left is ring-width, which prism deliberately does not emit.
- 2026-09-22T13:19:56Z (main): done
  provenance: {"harness_session":"claude-code:86218c99-e333-49f8-965c-e0e30c526e78","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-09-22T13:19:56Z (main): Superseded by the ring beam: ring-inset is retired and glass.ring.gap/beamSpeed/glow already round-trip through defs, profiles, manifest and both response blocks; the placement validation landed in prism-71b7d1 and light-ior in prism-0ea68f. The one remaining clause, ring-width, is filed as prism-a2c205
  provenance: {"harness_session":"claude-code:86218c99-e333-49f8-965c-e0e30c526e78","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
