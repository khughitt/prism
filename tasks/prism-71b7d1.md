---
id: prism-71b7d1
title: Make small pane geometry respect the native material ring constraint
status: todo
priority: 2
size: m
created: 2026-09-10T11:44:10Z
updated: 2026-09-10T11:44:10Z
depends: []
tags: [niri]
---

Neutral desktop acceptance exposed an existing geometry constraint gap: bevel = paneLip + max(abs(offsets)) may be below 7.6, but the inherited native response uses ring-inset 5 and ring-width 2.6 and requires their sum <= bevel. Width must be positive, so a zero bevel cannot currently load even with an explicit response. prism-91edc5 corrects the curated neutral lip to 8; manual slider values and stored profiles can still reach rejected geometry. Decide an explicit geometry/response contract (coordinate native zero-bevel support if preserving zero), validate before committing invalid values, and cover boundaries. Do not silently clamp the renderer or tighten a def range without accounting for existing stored values. Related ring controls: prism-28e29c.
