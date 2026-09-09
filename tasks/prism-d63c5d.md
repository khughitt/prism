---
id: prism-d63c5d
title: Emit one material when every split optic resolves equal
status: idea
priority: 2
created: 2026-09-09T01:19:43Z
updated: 2026-09-09T01:19:43Z
depends: []
tags: [niri, material]
---

With glass.focusSplit on and nothing tuned apart from the shipped receded defaults, the niri sink always writes terminal-glass and terminal-glass-inactive. If a user levels the matrix, or turns the split on before tuning anything, the two definitions are identical and niri still swaps material names on every focus change - and apply_resolved rebuilds MaterialState on a name change, so the jelly residuals restart for no visual difference (see material-5a5fff).

Mechanism: in renderNiriFragment, compare activeGlass(params) with inactiveGlass(params) and fall through to the unsplit shape when they are equal, so the split costs nothing until it shows something. Watch the assignment rules: the unsplit path emits one window-rule with no is-active match.
