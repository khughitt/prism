---
id: prism-8e8a18
title: Refraction saturates fast and turns the glass milky
status: todo
priority: 2
size: s
created: 2026-09-06T00:32:53Z
updated: 2026-09-06T00:32:53Z
depends: []
parent: prism-5758d3
tags: [ui, defs]
---

Refraction has range [1, 3]; in practice it saturates quickly and leads to a dull, milky appearance, which is why it is kept very low. Determine where the useful region is (real glass is roughly 1.4 to 1.7) and whether the milkiness is a range problem or a rendering one (frosted backdrop plus bevel at high index). If it is rendering, file the follow-up in niri-material and tighten only the range here.
