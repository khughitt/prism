---
id: prism-10c518
title: Rewrite t@t commit authorship in this repository
status: doing
priority: 2
size: s
complexity: low
process: direct
owner: main
created: 2026-10-16T16:33:03Z
updated: 2026-10-17T00:35:35Z
started: 2026-10-17T00:35:34Z
depends: [ops-e5b39c]
tags: []
source: git-identity-leak-2026-10-07
agent: claude-code/claude-opus-5-5
---

Rewrite this repository's t <t@t> commits (from the 2026-10-07 global-config leak; see ops-5749d9) to Keith Hughitt <keith.hughitt@gmail.com>, following the runbook ops-e5b39c. Inventory on titan 2026-10-16: 248 t@t commits on all refs, 90 unpushed on main, 2 worktree(s); remote: khughitt/prism.

## Notes

- 2026-10-17T00:35:34Z (main): started
  provenance: {"harness_session":"claude-code:c6863573-34c2-470d-b394-259f7cc75503","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-17T00:35:35Z (main): Direct history maintenance under ops-e5b39c's pilot procedure (as obs-a20f0c). No agent session in prism on Titan or Europa; Europa has only the main checkout. Inventory: 832 commits, 248 t@t, on main and fix/panel-render-budget (unmerged, 158; worktree .worktrees/panel-budget on Titan WORK_ROOT, locked, clean); docs/material-cad932, glass-noise-acceptance, glass-noise-types, profile-selector, profile-ux are merged and predate the window (unchanged). One filter-repo pass; origin/main reaches 43 (pushed). No tags, stash, signatures, extra headers, repo-local user.*, or .git-blame-ignore-revs. Remote khughitt/prism main fa562c7025b83094ae188a1296729c3d9bb40f85 (lease). Functional pins outside git: the parked panel pilot's frozen build.py and integrity-check.py resolve baseline 9bf4e8e and candidate e7384b0 with git show; the packet driver itself runs prebuilt builds without git. Old objects stay resolvable via reflog (30 days) and the kept bundle; old->new ids get noted on prism-7ed2d3 and prism-111a3f. Steps: bundle --all; mirror; filter-repo --mailmap; byte-verify; citation check; one guarded update-ref transaction; attach map; tests; push main --force-with-lease.
