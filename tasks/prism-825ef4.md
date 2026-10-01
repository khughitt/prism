---
id: prism-825ef4
title: Describe tools/cli.toml as an adopted landed version in the README
status: todo
priority: 3
size: xs
process: direct
created: 2026-10-01T11:16:27Z
updated: 2026-10-01T11:16:27Z
depends: []
tags: []
source: ops-be0fff
agent: claude-code/claude-opus-5-5
---

README's Tooling bullet says tools/cli.toml and tools/cli_surface.py are byte-identical copies of the ops table and helper and that a surface change is "re-vendored here". Under the ops vendoring rollout order (ops docs/specs/2026-10-01-vendoring-rollout-order-design.md) the copies hold a version ops's main has landed and may lag it; prism takes a new table with `vendored adopt cli.toml cli_surface.py` in its own checkout, in the commit that implements the change. Reword the bullet accordingly. Found in the ops-be0fff whole-branch review.
