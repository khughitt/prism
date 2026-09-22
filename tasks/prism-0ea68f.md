---
id: prism-0ea68f
title: Emit light-ior in the niri glass block
status: done
priority: 2
size: s
complexity: low
process: direct
owner: main
created: 2026-09-05T17:14:03Z
updated: 2026-09-22T13:12:11Z
started: 2026-09-22T13:05:45Z
completed: 2026-09-22T13:12:11Z
depends: [material-92edaf]
tags: [niri]
model: "claude-opus-5[1m]"
---

Current scope (2026-09-18): expose palette-overridable light-ior (native 1..12, default6) and emit it in every glass block from integrations/niri/render.js; extend defs/glass.yaml and test/niri-render.test.js with defaults, overrides and both materials. The e79b226b remaining path is 0.2*thickness: stock/Prism glass no longer saturates the ring cap at every setting, and light-ior now refracts aurora too. Therefore material-a85a18 is not a prerequisite for this wiring. Keep the native default unchanged; describe shared ring/aurora light bending separately from backdrop IOR. Verify the integrated/installed native build supports the intended semantics before live apply, retain existing capability checks, and do not confuse generated syntax acceptance with visual validation. Depends on material-92edaf; coordinated with material-743692 and prism-d8ee06. Run just test/check; no generic parameter framework or motion controls.

Historical motivation (pre-render-order; superseded where stated above):
niri-material material-26dd8a adds glass { light-ior } (1..12, default 6) as a multiplier on the focus filament's light path. The filament's shift is capped at half ring-inset, so at Prism's ior 1.24 every light-ior value saturates the cap and the knob only widens the chromatic split; deriving it from ior buys nothing there. Wait for niri-material material-a85a18 to settle the model before emitting the line. When it does: add a palette-overridable definition, emit 'light-ior <v>' in every glass block integrations/niri/render.js writes, and extend test/niri-render.test.js. Lands only after the native build is installed, since niri validate rejects the line until then.

## Notes

- 2026-09-19T00:26:59Z (main): Ring follow-through refinement: checked defs/glass.yaml, integrations/niri/render.js and native e79b226b; removed obsolete premise without changing implementation. Related material brief: docs/notes/2026-09-18-ring-next-steps-brief.md; native integration/installation remains a gate.
- 2026-09-22T13:05:45Z (main): started
  provenance: {"harness_session":"claude-code:86218c99-e333-49f8-965c-e0e30c526e78","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-09-22T13:11:56Z (prism-0ea68f): Shared, not focus-split: the native light-ior bends only interior light (ring filament + aurora), the ring lights the focused window, and a divergent multiplier would jump the aurora across a material swap. Placed in the Ring group (order 560, 'Light bending') rather than the Focus matrix, which is the split matrix; key stays glass.lightIor because the native node is glass-level, not inside the response block.
- 2026-09-22T13:11:56Z (prism-0ea68f): Native bounds verified against the installed build (niri 26.04 649c731b): light-ior 1/6/12 accepted, 0.5 and 13 rejected, so the def range [1,12] default 6 is exactly the native one. probe-material exits 0 with the line emitted.
- 2026-09-22T13:12:11Z (prism-0ea68f): done
  provenance: {"harness_session":"claude-code:86218c99-e333-49f8-965c-e0e30c526e78","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-09-22T13:12:11Z (prism-0ea68f): glass.lightIor is a shared Ring-group slider (1..12, default 6); the niri sink emits light-ior in every glass block, bound at reload, in both starter profiles; verified against installed niri 649c731b
  provenance: {"harness_session":"claude-code:86218c99-e333-49f8-965c-e0e30c526e78","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
