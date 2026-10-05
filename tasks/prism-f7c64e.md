---
id: prism-f7c64e
title: Rack and dry loader edge cases from the pipeline schema review
status: done
priority: 4
size: s
complexity: low
process: direct
owner: prism-902869
created: 2026-10-05T12:08:05Z
updated: 2026-10-05T12:32:11Z
started: 2026-10-05T12:28:51Z
completed: 2026-10-05T12:32:09Z
depends: []
parent: prism-a03862
tags: [material]
agent: claude-code/claude-opus-5-5
---

Deferred minors from the prism-eef38f final review, one failing test each: (1) rack shared may list a stage that also has a device, or a stage twice; reject both. (2) an empty dry.yaml parses to null and dies in Object.entries with a TypeError; name the file instead. loadDry on a missing integrations dir throws ENOENT where loadManifests returns []; match it. (3) src/interactions.js finds schema edges by why-text equality; carry the source on each resolved interaction (or key on kind, from, on) instead. (4) the other describe tests in test/cli.test.js run with no dry tables or nodes, so none exercise derivation; decide whether the fixture sinks should declare them. (5) spec Section 3 says a resolved requires lands on the target device; it lands on the dependent (the spec's own Fringing example); fix the sentence.

## Notes

- 2026-10-05T12:28:51Z (prism-902869): started
  provenance: {"harness_session":"claude-code:23285ff0-fcf8-4e52-93eb-5ccb34db3e4c","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-05T12:32:09Z (prism-902869): decision (4): the cli.test.js fixture sinks keep declaring no dry tables and no nodes. Derivation is covered end to end by 'describe carries the resolved rack' (reads the real integrations) and by test/rack.test.js; a fixture copy of the niri node map would be a second source of that manifest that drifts, and a fixture dry table now needs matching nodes since a dry field with no node is a load error (prism-e11d93).
- 2026-10-05T12:32:09Z (prism-902869): decision (3): interactions carry source ('schema'|'dry') rather than keying on (kind, from, on), which cannot tell a schema requires edge from a dry coupling naming the same pair; renderInteractions(rack) drops its schema argument. (5): spec Section 3 now says a requires entry lands on the dependent (its source stage) and attenuates/shadows on the affected stage, and names source in the shape.
- 2026-10-05T12:32:09Z (prism-902869): done
  provenance: {"harness_session":"claude-code:23285ff0-fcf8-4e52-93eb-5ccb34db3e4c","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-05T12:32:09Z (prism-902869): rack rejects a shared stage listed twice or also held by a device; an empty or non-map dry.yaml is refused by name and a missing integrations dir is no dry tables; interactions carry source and renderInteractions reads it; spec Section 3 sentence fixed; fixture sinks stay without dry tables (noted)
  provenance: {"harness_session":"claude-code:23285ff0-fcf8-4e52-93eb-5ccb34db3e4c","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
