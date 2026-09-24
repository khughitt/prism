---
id: prism-492ce8
title: "colorSource familiar: drop the 'not wired yet' disclosure now that the bridge runs"
status: todo
priority: 2
size: xs
complexity: low
process: direct
created: 2026-09-24T18:42:48Z
updated: 2026-09-24T18:42:48Z
depends: []
tags: [defs, ui]
source: material-930c55
agent: claude-code/claude-opus-5-5
---

Why: material-068639 made defs/glass.yaml's ring colorSource description (and the panel tooltip built from it) say familiar is not wired yet and rests every window on the manual Color. fam-e7fa72 (familiar 188c602) now sets each window's familiar signal slot, and on 2026-09-24 the user confirmed the rings take each session's hue. The disclosure is now false.

Done when: the colorSource description says familiar tints each terminal's ring with its session's familiar hue and rests on the manual Color where no session runs, and the panel tooltip follows. Keep prism-b4d118's scope (Color-control gating) separate.

Where to look: defs/glass.yaml colorSource (line ~385), the panel row that shows the description, prism's defs tests.
