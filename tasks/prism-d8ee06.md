---
id: prism-d8ee06
title: Wire approved ring placement controls through profiles and the niri sink
status: idea
priority: 2
size: s
complexity: mid
process: planned
created: 2026-09-19T00:26:01Z
updated: 2026-09-19T00:26:01Z
depends: [material-92edaf]
tags: [niri, material]
source: "material:docs/notes/2026-09-18-ring-next-steps-brief.md"
agent: codex
---

Extend existing prism-28e29c wiring rather than build a new Ring panel. Placement gaps are ring-inset/ring-width: defs/glass.yaml currently exposes focus, colorSource, color and driftHz; integrations/niri/render.js responseBlock intentionally inherits native placement. After material-9306b5 visual decisions, define palette/profile/reset behavior and emit agreed values in both terminal-glass response default blocks; preserve familiar/noctalia/manual color semantics. Native inset is 0..128 and width is positive through 128; choose useful UI bounds during review, never silently clamp stored profiles. Validate generated face placement such as inset20/bevel12 against the new installed native build, plus ordinary and opaque cases; test omitted/new defaults, saved profiles, reset and both materials through just gates. Keep light-ior in prism-0ea68f. Motion controls wait for material-0e130e design; native scheduler owns visibility/activity, not a panel timer. No implementation or live apply before the native contract and installation checkpoint are verified.
