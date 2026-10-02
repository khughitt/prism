---
id: prism-ad333a
title: Land the tint second and obtain dark-mode desktop acceptance
status: doing
priority: 1
size: s
complexity: mid
process: direct
owner: feat/noctalia-glass-color
created: 2026-10-02T09:44:26Z
updated: 2026-10-02T10:44:48Z
started: 2026-10-02T10:19:28Z
depends: [prism-67247f, prism-0bb71e]
parent: prism-b5cb1e
tags: []
agent: codex
spec: docs/specs/2026-10-02-noctalia-glass-color-design.md
plan: docs/plans/2026-10-02-noctalia-glass-color.md
step: "Task 4: Merge the tint implementation and accept the desktop result"
---

Review the complete implementation and revalidate all rollout hosts' primary/surface output before Merge 2. Land sink/defaults/controls only after that gate; verify apply and present bright/dark-wallpaper focused/unfocused text for the owner's judgment. Keep the parent open until acceptance and restore temporary live-state changes.

## Notes

- 2026-10-02T10:19:28Z (feat/noctalia-glass-color): started
  provenance: {"harness_session":"codex:01a0fba1-797b-7612-ac6c-b272e5fc6832","harness_session_source":"CODEX_SESSION_ID"}
- 2026-10-02T10:22:13Z (feat/noctalia-glass-color): Independent whole-branch review accepted without findings. Desktop/panel appearance remains owner judgment; light-mode legibility remains outside scope; other hosts have no readiness evidence and are not assumed upgraded. Recheck the recorded rollout host immediately before Merge 2.
- 2026-10-02T10:24:33Z (feat/noctalia-glass-color): Merge 2 landed at main 0263fb3 after independent acceptance, just gate (499 Node + Lua, zero skips) and valid host palette recheck. main bin/prism apply niri exited 0 using current niri socket; both materials #272522 at mix 0.1. Saved focused depth/distance 31.2/11 and unfocused 19.3/18 remain effective; defaults are not falsely claimed live. Preparing temporary visual comparison; no host pointers changed.
- 2026-10-02T10:27:17Z (feat/noctalia-glass-color): Visual bright: temporarily changing wallpaper from /mnt/ssd/Dropbox/linux/backgrounds/3440/PXL_20240513_034007235.jpg to /mnt/ssd/Dropbox/linux/backgrounds/3440/PXL_20210602_023858486.jpg; opening two test terminals on empty workspace 11. Default absorption is a direct sink apply of synthetic params, without changing any store values or pointers. Restore with wallpaper-set of original path, bin/prism apply niri and focus-window 5; script owns/reaps terminal pids.
- 2026-10-02T10:27:27Z (feat/noctalia-glass-color): Visual bright: restored wallpaper /mnt/ssd/Dropbox/linux/backgrounds/3440/PXL_20240513_034007235.jpg, stored tuning/pending edits unchanged; test terminal pids 2780267,2780480 reaped; generated material restored by normal apply.
- 2026-10-02T10:28:40Z (feat/noctalia-glass-color): Visual dark: temporarily changing wallpaper from /mnt/ssd/Dropbox/linux/backgrounds/3440/PXL_20240513_034007235.jpg to /mnt/ssd/Dropbox/linux/backgrounds/3440/PXL_20210602_204634474.jpg; opening two test terminals on empty workspace 11. Default absorption is a direct sink apply of synthetic params, without changing any store values or pointers. Restore with wallpaper-set of original path, bin/prism apply niri and focus-window 37; script owns/reaps terminal pids.
- 2026-10-02T10:28:50Z (feat/noctalia-glass-color): Visual dark: restored wallpaper /mnt/ssd/Dropbox/linux/backgrounds/3440/PXL_20240513_034007235.jpg, stored tuning/pending edits unchanged; test terminal pids 2795402,2795562 reaped; generated material restored by normal apply.
- 2026-10-02T10:32:58Z (feat/noctalia-glass-color): Visual bright: temporarily changing wallpaper from /mnt/ssd/Dropbox/linux/backgrounds/3440/PXL_20240513_034007235.jpg to /mnt/ssd/Dropbox/linux/backgrounds/3440/PXL_20210602_023858486.jpg; opening two test terminals on empty workspace 11. Default absorption is a direct sink apply of synthetic params, without changing any store values or pointers. Restore with wallpaper-set of original path, bin/prism apply niri and focus-window 27; script owns/reaps terminal pids.
- 2026-10-02T10:33:12Z (feat/noctalia-glass-color): Visual bright: restored wallpaper /mnt/ssd/Dropbox/linux/backgrounds/3440/PXL_20240513_034007235.jpg, stored tuning/pending edits unchanged; test terminal pids 2847381,2847678 reaped; generated material restored by normal apply.
- 2026-10-02T10:33:43Z (feat/noctalia-glass-color): Visual dark: temporarily changing wallpaper from /mnt/ssd/Dropbox/linux/backgrounds/3440/PXL_20240513_034007235.jpg to /mnt/ssd/Dropbox/linux/backgrounds/3440/PXL_20210602_204634474.jpg; opening two test terminals on empty workspace 11. Default absorption is a direct sink apply of synthetic params, without changing any store values or pointers. Restore with wallpaper-set of original path, bin/prism apply niri and focus-window 33; script owns/reaps terminal pids.
- 2026-10-02T10:33:55Z (feat/noctalia-glass-color): Visual dark: restored wallpaper /mnt/ssd/Dropbox/linux/backgrounds/3440/PXL_20240513_034007235.jpg, stored tuning/pending edits unchanged; test terminal pids 2858474,2858684 reaped; generated material restored by normal apply.
- 2026-10-02T10:36:11Z (feat/noctalia-glass-color): Visual bright: temporarily changing wallpaper from /mnt/ssd/Dropbox/linux/backgrounds/3440/PXL_20240513_034007235.jpg to /mnt/ssd/Dropbox/linux/backgrounds/3440/PXL_20210602_023858486.jpg; opening two test terminals on empty workspace 11. Default absorption is a direct sink apply of synthetic params, without changing any store values or pointers. Restore with wallpaper-set of original path, bin/prism apply niri and focus-window 36; script owns/reaps terminal pids.
- 2026-10-02T10:36:24Z (feat/noctalia-glass-color): Visual bright: restored wallpaper /mnt/ssd/Dropbox/linux/backgrounds/3440/PXL_20240513_034007235.jpg, stored tuning/pending edits unchanged; test terminal pids 2887086,2887157 reaped; generated material restored by normal apply.
- 2026-10-02T10:39:27Z (feat/noctalia-glass-color): Visual bright: temporarily changing wallpaper from /mnt/ssd/Dropbox/linux/backgrounds/3440/PXL_20220626_165940061.jpg to /mnt/ssd/Dropbox/linux/backgrounds/3440/PXL_20210602_023858486.jpg; opening two test terminals on empty workspace 11. Default absorption is a direct sink apply of synthetic params, without changing any store values or pointers. Restore with wallpaper-set of original path, bin/prism apply niri and focus-window 54; script owns/reaps terminal pids.
- 2026-10-02T10:39:43Z (feat/noctalia-glass-color): Visual bright: restored wallpaper /mnt/ssd/Dropbox/linux/backgrounds/3440/PXL_20220626_165940061.jpg, stored tuning/pending edits unchanged; test terminal pids 2918167,2918381 reaped; generated material restored by normal apply.
- 2026-10-02T10:40:23Z (feat/noctalia-glass-color): Visual dark: temporarily changing wallpaper from /mnt/ssd/Dropbox/linux/backgrounds/3440/PXL_20220626_165940061.jpg to /mnt/ssd/Dropbox/linux/backgrounds/3440/PXL_20210602_204634474.jpg; opening two test terminals on empty workspace 11. Default absorption is a direct sink apply of synthetic params, without changing any store values or pointers. Restore with wallpaper-set of original path, bin/prism apply niri and focus-window 53; script owns/reaps terminal pids.
- 2026-10-02T10:40:41Z (feat/noctalia-glass-color): Visual dark: restored wallpaper /mnt/ssd/Dropbox/linux/backgrounds/3440/PXL_20220626_165940061.jpg, stored tuning/pending edits unchanged; test terminal pids 2936821,2936978 reaped; generated material restored by normal apply.
- 2026-10-02T10:44:47Z (feat/noctalia-glass-color): Desktop evidence: corrected captures wait for a parsed palette change and both mapped test windows. Bright primary #a7c8fd/surface #121317 produces #21252e; dark primary #c1cba2/surface #131411 produces #242620 through the normal colors_changed CLI path. Both generated materials match. Comparison: .worktrees/noctalia-glass-color/.superpowers/sdd/2026-10-02-noctalia-glass-color/visual/comparison.png (top defaults 20 px depth and 30/35 distance; bottom saved 31.2/19.3 depths and 11/18 distances). Base/profile files and scratch preserved; wallpaper, focus and generated material restored after each run, then normal rotation advanced the wallpaper. All test terminals reaped, no host pointers changed. Owner legibility acceptance pending.
- 2026-10-02T10:44:47Z (feat/noctalia-glass-color): parked (waiting on user, review): User reviews .worktrees/noctalia-glass-color/.superpowers/sdd/2026-10-02-noctalia-glass-color/visual/comparison.png for dark-mode focused/unfocused legibility; after acceptance agent records the desktop review, closes this child and the parent, and integrates closing records. Nothing is running.
  provenance: {"harness_session":"codex:01a0fba1-797b-7612-ac6c-b272e5fc6832","harness_session_source":"CODEX_SESSION_ID"}
