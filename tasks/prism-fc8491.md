---
id: prism-fc8491
title: "Write target: topmost explicit layer, with a per-activation wallpaper pin"
status: done
priority: 2
size: s
owner: main
created: 2026-09-07T01:22:57Z
updated: 2026-09-07T01:39:34Z
depends: []
parent: prism-2f0b4b
tags: [profiles, store, noctalia]
---

Decision 2026-09-06 (brainstorm on dots-88dc34): layers split into explicit (profile, base) and automatic (wallpaper, future state). The write target for set/unset is the topmost explicit layer: the loaded profile if any, else base. An automatic layer is an overlay: activation reapplies its delta and never captures edits. A pin on the wallpaper slot (runtime state in active.json) makes the active wallpaper the target; 'prism context wallpaper <path>' clears the pin when a different wallpaper arrives, so per-wallpaper mode is always about the wallpaper on screen. Pinning while a profile is active is refused (profile stays topmost). describe --json reports target accordingly and gains the pin so the panel can show a wallpaper header row (name, override count, pin toggle) and dim rows whose layer sits above the target. save is restricted to the profile kind, which closes prism-fcacfb by construction: the target is always topmost, so a save can never absorb a layer above it. Panel header row and shadowed-row rendering may be a follow-up; the CLI rule, pin, and describe contract are this piece. Revise docs/specs/2026-09-05-prism-context-layers-design.md in the same change.

## Notes

- 2026-09-07T01:31:09Z (main): 2026-09-06: normalise the wallpaper path before hashing (realpath). On titan Noctalia reports the same image as /home/keith/d/linux/backgrounds/... (automation, configured dir) and /mnt/ssd/Dropbox/linux/backgrounds/... (walictl), which would give one wallpaper two ids.
- 2026-09-07T01:39:34Z (main): writeTarget(active): profile, else pinned wallpaper, else base; pin/unpin verbs; save profiles only; canonical wallpaper path; describe reports pinned. 210 tests pass; spec and README revised.
