---
id: prism-b7a3d3
title: Read material's installed glass facts and move the owner's picks to user config
status: todo
priority: 2
size: m
complexity: mid
process: planned
created: 2026-10-19T11:55:26Z
updated: 2026-10-19T11:55:26Z
depends: []
tags: []
source: ops-630a87 boundary-proposal-r3.md A2
agent: claude-code/claude-opus-5-5
---

Why: one direction for glass knowledge (revision 3, A2): material owns the physical facts, prism keeps UI hints and prism-only keys, and the owner's taste leaves the shipped defaults. Depends on material-9c8763's contract. Done: the niri sink reads the installed bundle; defs keep only hints; the copied files and the copy-the-newer-one contract test go; the owner's picks live in ~/.config/prism as the user's Default look. Before landing, pass the flow-trial-1 gate (revision 3, change 5): judge the step's effect on what enrolled sessions see and what obs and the verdict tools measure; a step that changes either waits for readout (2027-02-16).
