---
id: prism-ba8c59
title: "Rack order is stale: saturation and noise run before tint since the behind hook landed"
status: done
priority: 2
size: xs
complexity: low
process: direct
owner: prism-ba8c59
created: 2026-10-05T01:45:48Z
updated: 2026-10-05T01:51:02Z
started: 2026-10-05T01:48:01Z
completed: 2026-10-05T01:51:02Z
depends: []
parent: prism-a03862
tags: [ui, material, bug]
model: claude-fable-5-1
agent: claude-code/claude-fable-5-1
---

defs/rack/devices.yaml lists tint, iridescence, aurora, saturation, noise; since niri-material e013edc0 (2026-09-18, depth-ordered render hooks) main.frag applies saturation_behind and noise_behind on the sampled backdrop before Beer-Lambert tint, aurora (within), and iridescence (specular). The rack claims a processing order the shader no longer has.

Fix the order in devices.yaml and the rack golden; keep the post category or rename it to match the behind site, whichever the spec's category story settles first (a plain reorder is acceptable now). The lasting guard is the schema validation in prism-eef38f; this task is the honest-chain fix that need not wait for it.

## Notes

- 2026-10-05T01:48:01Z (main): started
  provenance: {"harness_session":"claude-code:23285ff0-fcf8-4e52-93eb-5ccb34db3e4c","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-05T01:48:49Z (prism-ba8c59): resumed
  provenance: {"harness_session":"claude-code:23285ff0-fcf8-4e52-93eb-5ccb34db3e4c","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-05T01:51:02Z (prism-ba8c59): done
  provenance: {"harness_session":"claude-code:23285ff0-fcf8-4e52-93eb-5ccb34db3e4c","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-05T01:51:02Z (prism-ba8c59): Reordered defs/rack/devices.yaml to the shader's order (saturation, noise before tint; aurora before iridescence), pinned it in the rack and describe tests, updated README and the rack spec's revision note; 520/520 pass
  provenance: {"harness_session":"claude-code:23285ff0-fcf8-4e52-93eb-5ccb34db3e4c","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
