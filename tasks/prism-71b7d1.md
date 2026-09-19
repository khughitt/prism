---
id: prism-71b7d1
title: Verify small-pane configs against the updated native geometry contract
status: todo
priority: 2
size: s
complexity: mid
process: direct
created: 2026-09-10T11:44:10Z
updated: 2026-09-19T00:27:00Z
depends: [material-92edaf]
tags: [niri]
---

Current scope (2026-09-18): verify generated small-pane configurations against the post-e79b226b native contract. The ring-inset+ring-width<=bevel validation is removed; do not implement a Prism clamp or a 7.6px floor to preserve that obsolete rule. integrations/niri/render.js already derives bevel=paneLip+max(abs(offsets)); native offset<=bevel, positive ring width and scalar bounds remain. Add native-validation coverage for zero lip/zero offsets, zero lip with supported offsets, default placement under a small bevel, and explicit face placement inset20/bevel12. Zero chamfer intentionally disables ring rendering: config acceptance is not proof of visible ring. Verify current defs ranges/stored profile inputs meet remaining bounds, and report any independent gap rather than silently clamp. Use test/niri-render.test.js and actual supported native validation; completion includes just gates and installed-version checkpoint. Depends on material-92edaf; related prism-d8ee06. No default/profile retuning or new geometry model.

Historical motivation (pre-render-order; superseded where stated above):
Neutral desktop acceptance exposed an existing geometry constraint gap: bevel = paneLip + max(abs(offsets)) may be below 7.6, but the inherited native response uses ring-inset 5 and ring-width 2.6 and requires their sum <= bevel. Width must be positive, so a zero bevel cannot currently load even with an explicit response. prism-91edc5 corrects the curated neutral lip to 8; manual slider values and stored profiles can still reach rejected geometry. Decide an explicit geometry/response contract (coordinate native zero-bevel support if preserving zero), validate before committing invalid values, and cover boundaries. Do not silently clamp the renderer or tighten a def range without accounting for existing stored values. Related ring controls: prism-28e29c.

## Notes

- 2026-09-19T00:27:00Z (main): Ring follow-through refinement: checked defs/glass.yaml, integrations/niri/render.js and native e79b226b; removed obsolete premise without changing implementation. Related material brief: docs/notes/2026-09-18-ring-next-steps-brief.md; native integration/installation remains a gate.
