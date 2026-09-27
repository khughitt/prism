---
id: prism-aab172
title: Should explicit profile selection stop autosaving scratch into the outgoing pair?
status: idea
priority: 2
created: 2026-09-27T16:00:56Z
updated: 2026-09-27T16:00:56Z
depends: []
parent: prism-2f0b4b
tags: [profiles, wallpaper]
agent: claude-code/claude-opus-5-5
---

After prism-5f6046, rotation carries pending edits (including values from a previously shown wallpaper's pair) instead of saving them. Profile selection still saves scratch to the outgoing look-wallpaper pair (2026-09-20 pairs design), so carried values land in the current wallpaper's pair on a profile switch. Decide whether selection should keep, discard, or ask.
