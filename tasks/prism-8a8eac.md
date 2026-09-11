---
id: prism-8a8eac
title: "\"New profile\" button that starts a fresh profile and focuses the name field"
status: idea
priority: 2
created: 2026-09-11T01:13:09Z
updated: 2026-09-11T01:15:26Z
depends: []
tags: [quick-add, profiles, ui, noctalia]
source: "mindful:thought:1e2513d2f5ea48609022559f3c687d01"
---

Like New in any application: one click resets or initializes the working state, creates the name field, and focuses it; submit saves the profile.

Known: the name field already has a submit button and a fresh slot per mode (prism-0f4922); profiles are contexts saved from the current values (prism-ea6344); a loaded profile captures edits directly (prism-b8b589 explores an edited marker for that).

Open: what New starts from. Candidates: the current look (clone, the common expectation), base, or the neutral look (prism reset neutral). Interacts with prism-ad2b12 (reset semantics) and with wallpaper autosave (this seed), which changes which layer holds the values New would clone.

Revisit 2026-11-10, after the reset and autosave decisions land.

## Notes

- 2026-09-11T01:15:26Z (main): Revisit date lives in prose until tasks-be6fcc (one-shot defer date in tasks) lands; move it onto the field then.
