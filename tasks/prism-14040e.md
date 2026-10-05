---
id: prism-14040e
title: Refresh the vendored pipeline.json after the sweeps row gains accent
status: todo
priority: 3
size: xs
complexity: low
process: direct
created: 2026-10-05T12:08:05Z
updated: 2026-10-05T12:08:05Z
depends: [material-5b2bc5]
parent: prism-a03862
tags: [material]
agent: claude-code/claude-opus-5-5
---

material-5b2bc5 adds the accent response to the sweeps stage and regenerates resources/materials/pipeline.json in niri-material. test/pipeline-contract.test.js then fails here until defs/rack/pipeline.json is copied over (cp from the niri-material checkout). Copy it, run just test-fast, and confirm the interaction document needs no regeneration (sweeps has no device).
