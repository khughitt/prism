---
id: prism-a56441
title: Vendor the pipeline schema with the noise site stages
status: done
priority: 2
size: xs
complexity: low
process: direct
owner: prism-a56441
created: 2026-10-06T03:55:41Z
updated: 2026-10-06T03:57:18Z
started: 2026-10-06T03:55:41Z
completed: 2026-10-06T03:57:18Z
depends: []
parent: prism-a03862
tags: [material]
model: claude-opus-5-5
agent: claude-code/claude-opus-5-5
---

Copy niri-material resources/materials/pipeline.json (merged at 1d2777aa, material-cf32e5) to defs/rack/pipeline.json: adds the backdrop-grain source stage and the noise site= reads. prism-be5abe builds the rack UI on it.

## Notes

- 2026-10-06T03:55:41Z (main): started
  provenance: {"harness_session":"claude-code:51715bc9-2053-49ae-bc45-d479866d8d8b","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-06T03:55:46Z (prism-a56441): resumed
  provenance: {"harness_session":"claude-code:51715bc9-2053-49ae-bc45-d479866d8d8b","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-06T03:57:18Z (prism-a56441): done
  provenance: {"harness_session":"claude-code:51715bc9-2053-49ae-bc45-d479866d8d8b","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-06T03:57:18Z (prism-a56441): Vendored the pipeline schema from niri-material 1d2777aa: backdrop-grain source stage and noise site= reads; the malformed-shape test now finds the blur stage by id since backdrop-grain is first.
  provenance: {"harness_session":"claude-code:51715bc9-2053-49ae-bc45-d479866d8d8b","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
