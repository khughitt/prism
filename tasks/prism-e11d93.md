---
id: prism-e11d93
title: "Map dry fields to native nodes through the manifest, not a camelCase rule"
status: done
priority: 3
size: s
complexity: low
process: direct
owner: prism-902869
created: 2026-10-05T12:08:05Z
updated: 2026-10-05T12:28:50Z
started: 2026-10-05T12:25:54Z
completed: 2026-10-05T12:28:50Z
depends: []
parent: prism-a03862
tags: [material]
agent: claude-code/claude-opus-5-5
---

src/rack.js fieldNode turns a dry field (chromaticAberration) into a node by camelCase-to-kebab, a second spelling rule that must track the renderer and cannot express the = nodes (distortion scale=, noise type=, and noise site= once prism-be5abe adds it). Resolve each field through the manifest node map instead (nodes.get('glass.' + field)), and name the dry entry and sink in the error when a field has no node. Write the failing test with a dry entry on an = node first. Deferred minor from the prism-eef38f final review.

## Notes

- 2026-10-05T12:25:54Z (prism-902869): started
  provenance: {"harness_session":"claude-code:23285ff0-fcf8-4e52-93eb-5ccb34db3e4c","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-05T12:28:50Z (prism-902869): done
  provenance: {"harness_session":"claude-code:23285ff0-fcf8-4e52-93eb-5ccb34db3e4c","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-05T12:28:50Z (prism-902869): rack resolves dry fields through the manifest node map (<namespace>.<field> -> node), so = nodes derive requires; loadDry carries each entry's sink and a field with no node fails naming the entry and sink
  provenance: {"harness_session":"claude-code:23285ff0-fcf8-4e52-93eb-5ccb34db3e4c","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
