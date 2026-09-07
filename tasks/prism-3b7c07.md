---
id: prism-3b7c07
title: "Panel: wallpaper header row with pin toggle, and shadowed rows"
status: todo
priority: 2
size: s
created: 2026-09-07T01:37:19Z
updated: 2026-09-07T01:37:19Z
depends: []
parent: prism-2f0b4b
tags: [noctalia, ui, profiles]
---

Follow-up to prism-fc8491. describe --json now reports active.wallpaper.pinned and a target that is base under an unpinned wallpaper. The panel should show a header row for the active wallpaper (basename, count of overridden keys, pin toggle calling 'prism context pin|unpin wallpaper'), grey the toggle with a tooltip while a profile is loaded, and render rows whose layer sits above the target as shadowed (dimmed, hint 'overridden by wallpaper; pin to edit'), since dragging such a row writes base with no visible effect. The reset rule (visible when layer == target) is unchanged. Presentation and queue modules carry the layout contract, so the direct Lua tests must cover the new row.
