---
id: prism-efa8ff
title: Type-check the JavaScript sources in just check
status: todo
priority: 3
size: m
complexity: mid
process: direct
created: 2026-10-12T01:03:13Z
updated: 2026-10-12T01:04:01Z
depends: [ops-17cd42]
tags: [cross-project]
agent: claude-code/claude-opus-5-5
---

Piece of ops-a66936: adopt ops's type-check convention once it lands (tsc --noEmit with checkJs and JSDoc types, run from check_cmd). Type shared shapes first, then enable checking file by file.
