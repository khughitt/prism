---
id: prism-1514d3
title: "glass.ring.beamSpeed replaces sweepMs; gap and glow join the Ring group; the niri sink emits ring-beam-speed, ring-gap, ring-glow"
status: done
priority: 2
size: m
complexity: mid
process: direct
owner: prism-1514d3
created: 2026-09-20T10:11:49Z
updated: 2026-09-20T10:17:27Z
started: 2026-09-20T10:13:14Z
completed: 2026-09-20T10:17:26Z
depends: []
tags: [niri]
agent: claude-code/claude-opus-5
---

niri-material's ring beam (spec docs/specs/2026-09-19-ring-beam-design.md §4 there; plan docs/plans/2026-09-19-ring-beam.md Task 5). Replace glass.ring.sweepMs with glass.ring.beamSpeed (replaces:), add glass.ring.gap and glass.ring.glow; render.js responseBlock emits the three keys; manifest binds at liveness reload; starter profiles updated; tests per the sweep migration plan re-pointed. The branch is NOT merged in this task: main drives the live panel and the compatible compositor must be installed first (rollout in the niri-material plan Task 6 Step 6).

## Notes

- 2026-09-20T10:13:14Z (prism-1514d3): started
  provenance: {"harness_session":"claude-code:91b58500-0687-468f-b430-142cc24f6ede","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-09-20T10:17:26Z (prism-1514d3): done
  provenance: {"harness_session":"claude-code:91b58500-0687-468f-b430-142cc24f6ede","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-09-20T10:17:26Z (prism-1514d3): glass.ring.beamSpeed replaces sweepMs; gap and glow join the Ring group; niri sink emits ring-beam-speed/ring-gap/ring-glow
  provenance: {"harness_session":"claude-code:91b58500-0687-468f-b430-142cc24f6ede","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-09-20T10:17:27Z (prism-1514d3): ready on branch prism-1514d3; merge at the rollout after the niri package is installed (niri-material plan Task 6 Step 6)
