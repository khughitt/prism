---
id: prism-eff23a
title: Replace glass.ring.driftHz with sweepMs and migrate stored settings
status: todo
priority: 2
size: s
complexity: mid
process: planned
created: 2026-09-19T02:49:26Z
updated: 2026-09-19T02:49:37Z
depends: []
tags: [niri, material]
source: "material:docs/specs/2026-09-18-ring-focus-motion-design.md"
agent: claude-code/claude-opus-5
---

Native ring-drift-hz is retired for ring-sweep-ms (niri-material docs/specs/2026-09-18-ring-focus-motion-design.md §5). Add glass.ring.sweepMs (integer 0-10000, default 1500) to defs/glass.yaml declaring replaces: glass.ring.driftHz; integrations/niri/render.js emits ring-sweep-ms in every response block and never ring-drift-hz. Add 'prism migrate': walk base and every profile and wallpaper context, active or not; driftHz 0 -> sweepMs 0, positive -> 1500, an existing sweepMs is kept and reported; copy every touched file into a timestamped directory under the state dir before writing; report each file, key, and the backup path; idempotent. doctor reports a pending migration (an orphan key some definition replaces) and names the command. Tests per spec §7: both materials, defaults and overrides, migration over all three stores including the collision case and byte-for-byte backup, second run a no-op, doctor hint. Live apply follows the spec §5 order: install the native build, migrate and apply, restart; rollback restores the backup before reinstalling the old Prism. Depends on the native config landing (material-7fd09c).

## Notes

- 2026-09-19T02:49:37Z (main): Add 'tasks dep prism-eff23a --on material-7fd09c' once the material-82323e branch merges; the step child exists only on that branch for now.
