---
id: prism-0ea68f
title: Emit light-ior in the niri glass block
status: doing
priority: 2
size: s
complexity: low
process: direct
owner: main
created: 2026-09-05T17:14:03Z
updated: 2026-09-22T13:05:45Z
started: 2026-09-22T13:05:45Z
depends: [material-92edaf]
tags: [niri]
---

Current scope (2026-09-18): expose palette-overridable light-ior (native 1..12, default6) and emit it in every glass block from integrations/niri/render.js; extend defs/glass.yaml and test/niri-render.test.js with defaults, overrides and both materials. The e79b226b remaining path is 0.2*thickness: stock/Prism glass no longer saturates the ring cap at every setting, and light-ior now refracts aurora too. Therefore material-a85a18 is not a prerequisite for this wiring. Keep the native default unchanged; describe shared ring/aurora light bending separately from backdrop IOR. Verify the integrated/installed native build supports the intended semantics before live apply, retain existing capability checks, and do not confuse generated syntax acceptance with visual validation. Depends on material-92edaf; coordinated with material-743692 and prism-d8ee06. Run just test/check; no generic parameter framework or motion controls.

Historical motivation (pre-render-order; superseded where stated above):
niri-material material-26dd8a adds glass { light-ior } (1..12, default 6) as a multiplier on the focus filament's light path. The filament's shift is capped at half ring-inset, so at Prism's ior 1.24 every light-ior value saturates the cap and the knob only widens the chromatic split; deriving it from ior buys nothing there. Wait for niri-material material-a85a18 to settle the model before emitting the line. When it does: add a palette-overridable definition, emit 'light-ior <v>' in every glass block integrations/niri/render.js writes, and extend test/niri-render.test.js. Lands only after the native build is installed, since niri validate rejects the line until then.

## Notes

- 2026-09-19T00:26:59Z (main): Ring follow-through refinement: checked defs/glass.yaml, integrations/niri/render.js and native e79b226b; removed obsolete premise without changing implementation. Related material brief: docs/notes/2026-09-18-ring-next-steps-brief.md; native integration/installation remains a gate.
- 2026-09-22T13:05:45Z (main): started
  provenance: {"harness_session":"claude-code:86218c99-e333-49f8-965c-e0e30c526e78","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
