---
id: prism-9e449a
title: "Row alignment: fixed value column and aligned matrix columns"
status: todo
priority: 2
size: s
created: 2026-09-05T21:35:07Z
updated: 2026-09-05T21:35:12Z
depends: [prism-23df96]
parent: prism-7e1c66
tags: [noctalia, ui]
---

Sliders start and end at different x positions per row because the formatted value label is sized by its content (minWidth 44 is exceeded by e.g. '2824px') and each matrix half is a flex cell whose intrinsic width depends on that text. Give the value column a fixed width so every row's control column starts at the same x, and make the Focused/Unfocused header labels line up with the cells they title (the header currently spaces with a bare 130px + 32px stand-in for the label and info button).
