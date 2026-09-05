---
id: prism-57960e
title: prism context list dies on one malformed context file
status: todo
priority: 2
size: s
created: 2026-09-05T22:55:53Z
updated: 2026-09-05T22:55:53Z
depends: []
tags: [cli]
---

context list reads each wallpaper context to print its _source beside the id, so a single malformed or _source-less file takes the whole listing down with 'prism: wallpaper <id>: missing _source' and the user cannot see what contexts exist. prism doctor reports the same file properly, by name and with the path to edit, so nobody is stranded — but the verb you reach for to find out what is there is the one that fails. The principle the store should hold to is that discovery verbs degrade and diagnosis verbs fail: enumerating what exists should not require every file to parse. Fix: separate enumeration from parsing — either have listContexts return an entry per file with any parse error attached, or give readContext a non-throwing sibling — and have list print the broken entry with a marker in the active column pointing at doctor. context show on a broken file deserves the same treatment: print the raw text rather than refusing, since showing you the file is exactly what you asked for when the file is what is wrong. Declined during the context-layers review as new behaviour no test pinned and the plan never specified.
