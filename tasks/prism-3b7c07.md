---
id: prism-3b7c07
title: "Panel: wallpaper header row with pin toggle, and shadowed rows"
status: done
priority: 2
size: s
owner: panel-layers
created: 2026-09-07T01:37:19Z
updated: 2026-09-08T23:00:57Z
depends: []
parent: prism-2f0b4b
tags: [noctalia, ui, profiles]
---

Follow-up to prism-fc8491. describe --json now reports active.wallpaper.pinned and a target that is base under an unpinned wallpaper. The panel should show a header row for the active wallpaper (basename, count of overridden keys, pin toggle calling 'prism context pin|unpin wallpaper'), grey the toggle with a tooltip while a profile is loaded, and render rows whose layer sits above the target as shadowed (dimmed, hint 'overridden by wallpaper; pin to edit'), since dragging such a row writes base with no visible effect. The reset rule (visible when layer == target) is unchanged. Presentation and queue modules carry the layout contract, so the direct Lua tests must cover the new row.

## Notes

- 2026-09-08T23:00:57Z (panel-layers): describe gained a top-level layers (RESOLUTION_ORDER) so the panel ranks layer vs target instead of copying the order; a state layer will rank correctly with no panel change.
- 2026-09-08T23:00:57Z (panel-layers): Wallpaper header row (basename, override count, pin button) and shadowed rows: dimmed cell, layer-specific hint, per-cell in matrix rows. Noctalia toggles take no tooltip prop and a disabled Button's hit area (and so its tooltip) is off, so the pin is a Button greyed by opacity and guarded in its handler. 214 node tests + Lua panel tests pass; contract note and context-layers spec revised. Hover/tooltip appearance not confirmed live - no pointer automation on this machine.
