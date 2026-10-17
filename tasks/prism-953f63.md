---
id: prism-953f63
title: "Prepare an upstream Noctalia issue: per-safepoint clock_gettime metering, and no plugin-visible disabled state"
status: todo
priority: 3
size: s
complexity: mid
process: direct
created: 2026-10-17T21:19:38Z
updated: 2026-10-17T21:19:39Z
depends: []
tags: [noctalia, performance]
agent: claude-code/claude-opus-5-5
---

From prism-dac509's spec, Follow-ups. Search upstream first; prepare the issue to the project's templates; the owner approves posting.

## Notes

- 2026-10-17T21:19:38Z (fix/panel-render-budget): Upstream search 2026-10-17 (noctalia-dev/noctalia issues+PRs: 'CPU budget', 'clock_gettime', 'budget', 'interrupt', 'plugin disabled timeouts', 'runtime unhealthy'): nothing on interrupt metering cost. Related: #3893 (open) silent auto-disable when pcall swallows budget timeouts, no log line, one toast — https://github.com/noctalia-dev/noctalia/issues/3893; #3555 (closed as completed, sticky disable still on main per #3893) — https://github.com/noctalia-dev/noctalia/issues/3555. The disabled-state half may be a +1/new repro on #3893 rather than a new issue.
