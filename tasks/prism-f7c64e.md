---
id: prism-f7c64e
title: Rack and dry loader edge cases from the pipeline schema review
status: todo
priority: 4
size: s
complexity: low
process: direct
created: 2026-10-05T12:08:05Z
updated: 2026-10-05T12:08:05Z
depends: []
parent: prism-a03862
tags: [material]
agent: claude-code/claude-opus-5-5
---

Deferred minors from the prism-eef38f final review, one failing test each: (1) rack shared may list a stage that also has a device, or a stage twice; reject both. (2) an empty dry.yaml parses to null and dies in Object.entries with a TypeError; name the file instead. loadDry on a missing integrations dir throws ENOENT where loadManifests returns []; match it. (3) src/interactions.js finds schema edges by why-text equality; carry the source on each resolved interaction (or key on kind, from, on) instead. (4) the other describe tests in test/cli.test.js run with no dry tables or nodes, so none exercise derivation; decide whether the fixture sinks should declare them. (5) spec Section 3 says a resolved requires lands on the target device; it lands on the dependent (the spec's own Fringing example); fix the sentence.
