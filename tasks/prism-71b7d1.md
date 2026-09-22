---
id: prism-71b7d1
title: Verify small-pane configs against the updated native geometry contract
status: done
priority: 2
size: s
complexity: mid
process: direct
owner: main
created: 2026-09-10T11:44:10Z
updated: 2026-09-22T13:17:37Z
started: 2026-09-22T13:14:20Z
completed: 2026-09-22T13:17:37Z
depends: [material-92edaf]
tags: [niri]
model: "claude-opus-5[1m]"
---

Current scope (2026-09-18): verify generated small-pane configurations against the post-e79b226b native contract. The ring-inset+ring-width<=bevel validation is removed; do not implement a Prism clamp or a 7.6px floor to preserve that obsolete rule. integrations/niri/render.js already derives bevel=paneLip+max(abs(offsets)); native offset<=bevel, positive ring width and scalar bounds remain. Add native-validation coverage for zero lip/zero offsets, zero lip with supported offsets, default placement under a small bevel, and explicit face placement inset20/bevel12. Zero chamfer intentionally disables ring rendering: config acceptance is not proof of visible ring. Verify current defs ranges/stored profile inputs meet remaining bounds, and report any independent gap rather than silently clamp. Use test/niri-render.test.js and actual supported native validation; completion includes just gates and installed-version checkpoint. Depends on material-92edaf; related prism-d8ee06. No default/profile retuning or new geometry model.

Historical motivation (pre-render-order; superseded where stated above):
Neutral desktop acceptance exposed an existing geometry constraint gap: bevel = paneLip + max(abs(offsets)) may be below 7.6, but the inherited native response uses ring-inset 5 and ring-width 2.6 and requires their sum <= bevel. Width must be positive, so a zero bevel cannot currently load even with an explicit response. prism-91edc5 corrects the curated neutral lip to 8; manual slider values and stored profiles can still reach rejected geometry. Decide an explicit geometry/response contract (coordinate native zero-bevel support if preserving zero), validate before committing invalid values, and cover boundaries. Do not silently clamp the renderer or tighten a def range without accounting for existing stored values. Related ring controls: prism-28e29c.

## Notes

- 2026-09-19T00:27:00Z (main): Ring follow-through refinement: checked defs/glass.yaml, integrations/niri/render.js and native e79b226b; removed obsolete premise without changing implementation. Related material brief: docs/notes/2026-09-18-ring-next-steps-brief.md; native integration/installation remains a gate.
- 2026-09-22T13:14:20Z (main): started
  provenance: {"harness_session":"claude-code:86218c99-e333-49f8-965c-e0e30c526e78","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-09-22T13:14:20Z (main): Scope drift found at start: the task body (2026-09-18) still names ring-inset, which the ring beam retired. Current native contract (docs/materials/material-config.md in niri-material at 649c731b): the band sits ring-gap px inward from the FACE edge and the bevel shrinks to make room, so there is no inset+width<=bevel rule at all; ring-gap is 0-128 default 8, ring-width >0..128 default 2.6 (prism does not emit it). The remaining validation rules are offset<=bevel, bevel 0-128, positive ring-width, and the retired keys rejected by name. The 'inset20/bevel12' case becomes gap 20 / bevel 12.
- 2026-09-22T13:15:55Z (main): Second premise is stale too: the body says 'zero chamfer intentionally disables ring rendering'. Post-beam that is false. main.frag: 'The ring needs a face to run under, not a chamfer: a flat slab with bevel 0 carries the beam. Only the spill needs the chamfer.' The one behavioural limit is hasLine = face_half.x > gap && face_half.y > gap, i.e. a face narrower than 2*ring-gap. So the small-pane risk is ring-gap against the face size, not bevel.
- 2026-09-22T13:17:32Z (main): Native validation checkpoint on installed niri 26.04 (649c731b), fragment rendered from defs defaults with both states on: accepted bevel 8 (neutral), 0 (zero lip, zero offsets), 64 (zero lip, widest offsets), 2 (small bevel), 128 (max lip+offsets), and ring-gap 20 under bevel 12, and ring-gap 128. Nothing rejected; the two the retired rule would have refused now pass. Stored inputs: 10 config files carry geometry, none out of bounds (bevel 0..128, |offset| <= bevel, gap 0..128).
- 2026-09-22T13:17:32Z (main): No clamp and no floor added. The one gap found is documentary, not a bound: ring-gap accepts 0..128 while the ring only draws where the face half-extent exceeds the gap, so the panel maximum needs a face over 256 px on both axes. Fixed by carrying the limit in the gap description; narrowing the range would rewrite stored profiles silently.
- 2026-09-22T13:17:37Z (main): done
  provenance: {"harness_session":"claude-code:86218c99-e333-49f8-965c-e0e30c526e78","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-09-22T13:17:37Z (main): Small-pane geometry pinned against the post-beam native contract: the retired inset+width<=bevel test is gone, bevel 0..128 and offset<=bevel are covered for zero lip, widest offsets, a small bevel and gap 20 under bevel 12, and the ring-gap small-face limit is documented rather than clamped; all cases validated on installed 649c731b
  provenance: {"harness_session":"claude-code:86218c99-e333-49f8-965c-e0e30c526e78","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
