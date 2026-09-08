---
id: prism-d836de
title: "niri sink: declare its niri-material requirement instead of failing through niri validate"
status: todo
priority: 1
size: m
created: 2026-09-08T15:13:04Z
updated: 2026-09-08T23:30:44Z
depends: []
tags: [robustness, niri, errors]
spec: docs/specs/2026-09-08-sink-requirements-design.md
plan: docs/plans/2026-09-08-sink-requirements.md
step: "Task 3: The niri sink's niri-material requirement"
---

Found bringing europa (laptop) up to date on 2026-09-08 after ~3 weeks. render.js emits material blocks unconditionally, so stock niri 26.04 produced a screenful of KDL parse errors with no statement of the real cause, and glass.enabled=false is no escape hatch. Outcome: the sink states its requirement (probe or declared minimum) and fails with one line naming the needed niri-material version and what is installed.
