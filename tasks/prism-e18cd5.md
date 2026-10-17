---
id: prism-e18cd5
title: Re-anchor the parked panel pilot's packets to the rewritten commit ids
status: todo
priority: 2
size: xs
complexity: low
process: direct
created: 2026-10-17T02:02:01Z
updated: 2026-10-17T02:11:03Z
depends: []
tags: []
agent: claude-code/claude-opus-5-5
---

The authorship rewrite (prism-10c518, 2026-10-17) re-hashed every t@t commit with unchanged trees. The parked panel pilot (prism-7ed2d3, prism-111a3f, under prism-dac509, records only on fix/panel-render-budget in .worktrees/panel-budget) cites old ids: fe3f29a -> 0defb953c5, 2c37d73 -> afeb7852b4, build candidate e7384b0 -> 5f08fec31d, baseline 9bf4e8e -> bec721919f, branch tip 6f6e506 -> f9a1f6c90a (full map: tasks/files/prism-10c518/). The frozen build.py and integrity-check.py resolve baseline and candidate with git show; the old objects stay resolvable through the branch reflog (about 30 days) and the bundle on Titan at WORK_ROOT/prism/identity-rewrite-20261017T003536Z. When the pilot resumes, record the mapping on its own records and revalidate or regenerate the packet against the new ids before any approval request.

## Notes

- 2026-10-17T02:02:02Z (main): concerns: prism-10c518 extension — the rewrite could not note the new ids on the pilot's branch-only records
- 2026-10-17T02:11:03Z (main): Old ids also sit outside git in the pilot's run state, ~/.local/state/prism/panel-budget/capture-recovery-2026-10-13/runs/ (hundreds of files across the task5/task6/broad-fix runs); revalidation must read them through the map in tasks/files/prism-10c518/.
