---
id: prism-8a8e7b
title: Adopt ui.select notifyOnReselect in the panel's profile select
status: todo
priority: 3
size: xs
complexity: low
process: direct
created: 2026-09-29T18:36:51Z
updated: 2026-09-29T18:36:51Z
depends: []
tags: [noctalia, ui, profiles]
---

The noctalia fork now exposes notifyOnReselect on ui.select (plugin API 32, fork commit 7f547389f). Wire the panel's profile select to it so a genuine click on the already-selected profile fires onChange; needs the fork installed (API 32) before the panel can declare it, so the installed v5.0.1 shell gates this.
