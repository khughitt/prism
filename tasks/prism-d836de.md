---
id: prism-d836de
title: "niri sink: declare its niri-material requirement instead of failing through niri validate"
status: todo
priority: 1
size: m
created: 2026-09-08T15:13:04Z
updated: 2026-09-08T15:13:04Z
depends: []
tags: [robustness, niri, errors]
---

Found bringing europa (laptop) up to date on 2026-09-08 after ~3 weeks. render.js emits material blocks unconditionally, so stock niri 26.04 produced a screenful of KDL parse errors with no statement of the real cause, and glass.enabled=false is no escape hatch. Outcome: the sink states its requirement (probe or declared minimum) and fails with one line naming the needed niri-material version and what is installed.
