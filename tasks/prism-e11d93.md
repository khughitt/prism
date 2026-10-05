---
id: prism-e11d93
title: "Map dry fields to native nodes through the manifest, not a camelCase rule"
status: todo
priority: 3
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

src/rack.js fieldNode turns a dry field (chromaticAberration) into a node by camelCase-to-kebab, a second spelling rule that must track the renderer and cannot express the = nodes (distortion scale=, noise type=, and noise site= once prism-be5abe adds it). Resolve each field through the manifest node map instead (nodes.get('glass.' + field)), and name the dry entry and sink in the error when a field has no node. Write the failing test with a dry entry on an = node first. Deferred minor from the prism-eef38f final review.
