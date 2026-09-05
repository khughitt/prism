---
id: prism-1d13bc
title: Fix context layers plan review follow-ups
status: done
priority: 2
size: xs
owner: feat/prism-6fd864
created: 2026-09-05T20:43:07Z
updated: 2026-09-05T20:45:31Z
depends: []
parent: prism-6fd864
tags: [docs]
---

Correct the repeated-wallpaper test ID, remove the parsing precheck from context deletion, and add a runnable malformed-active-context deletion regression to the implementation plan.

## Notes

- 2026-09-05T20:45:27Z (feat/prism-6fd864): Corrected the wallpaper fixture ID and removed the delete parsing precheck; all 14 planned context CLI tests pass in a temporary checkout, and restoring the precheck fails the new malformed-file regression.
- 2026-09-05T20:45:31Z (feat/prism-6fd864): Fixed the wallpaper ID and malformed-context deletion examples in the plan; 14 planned context CLI checks pass.
