---
id: prism-c3a7b9
title: "Visual acceptance for the widened focus split, and whether its new rows should ship receded"
status: todo
priority: 2
size: m
created: 2026-09-09T01:19:33Z
updated: 2026-09-09T01:19:33Z
depends: []
tags: [material, niri, acceptance]
---

prism-a4ef9a split tint, refraction, depth, distortion detail, and frosted backdrop by focus state. niri 26.04 (f0370f52) validates a divergent pair at both range extremes, but no capture exists of one: the split has never been seen, only parsed.

All five ship level (each twin defaults to its focused value), which was chosen to keep the upgrade a visual no-op rather than because level is right. The 2026-09-04 focus-glass spike picked its inactive set from captures; the same evidence is missing here.

Method: nested niri on the headless weston host, never the desktop session. Two adjacent terminals, one focused, over a hard backdrop; capture the pair for each new optic diverging on its own, then together. Set animations { off; } so the ring drift phase does not differ between runs.

Outcome: a doc under docs/materials-style captures, plus a decision per optic on whether it deserves a receded shipping default. Any default change is a separate piece, since it moves the shipped look.
