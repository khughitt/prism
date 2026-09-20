---
id: prism-eff23a
title: Replace glass.ring.driftHz with sweepMs and migrate stored settings
status: done
priority: 2
size: s
complexity: mid
process: planned
owner: prism-eff23a
created: 2026-09-19T02:49:26Z
updated: 2026-09-20T00:11:06Z
started: 2026-09-19T22:56:32Z
completed: 2026-09-20T00:11:06Z
depends: [material-7fd09c]
tags: [niri, material]
source: "material:docs/specs/2026-09-18-ring-focus-motion-design.md"
agent: claude-code/claude-opus-5
plan: docs/plans/2026-09-19-ring-sweep-migration.md
---

Native ring-drift-hz is retired for ring-sweep-ms (niri-material docs/specs/2026-09-18-ring-focus-motion-design.md §5). Add glass.ring.sweepMs (integer 0-10000, default 1500) to defs/glass.yaml declaring replaces: glass.ring.driftHz; integrations/niri/render.js emits ring-sweep-ms in every response block and never ring-drift-hz. Add 'prism migrate': walk base and every profile and wallpaper context, active or not; driftHz 0 -> sweepMs 0, positive -> 1500, an existing sweepMs is kept and reported; copy every touched file into a timestamped directory under the state dir before writing; report each file, key, and the backup path; idempotent. doctor reports a pending migration (an orphan key some definition replaces) and names the command. Tests per spec §7: both materials, defaults and overrides, migration over all three stores including the collision case and byte-for-byte backup, second run a no-op, doctor hint. Live apply follows the spec §5 order: install the native build, migrate and apply, restart; rollback restores the backup before reinstalling the old Prism. Depends on the native config landing (material-7fd09c).

## Notes

- 2026-09-19T02:49:37Z (main): Add 'tasks dep prism-eff23a --on material-7fd09c' once the material-82323e branch merges; the step child exists only on that branch for now.
- 2026-09-19T22:56:32Z (prism-eff23a): started
  provenance: {"harness_session":"claude-code:49261570-0755-4b4b-ac00-f6343337242c","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-09-19T23:03:34Z (prism-eff23a): Plan: docs/plans/2026-09-19-ring-sweep-migration.md (4 tasks: def+sink, migrate.js, CLI verb + doctor hint, docs/close). Awaiting review.
- 2026-09-19T23:23:09Z (prism-eff23a): Plan review 2026-09-19: three P2 findings applied — glass-defs Hz test at :471 added to Task 1; backup dir created exclusively with COPYFILE_EXCL copies plus a collision test; migrate reports the backup before the first write, each file as it lands, and a failed write names what landed and the undo, tested with a failure on the third file.
- 2026-09-19T23:55:00Z (prism-eff23a): resumed
  provenance: {"harness_session":"codex:01a0bc06-ea0c-7423-baec-fb8f1b8ef747","harness_session_source":"CODEX_SESSION_ID"}
- 2026-09-19T23:55:00Z (prism-eff23a): took over session sid:3432998 (owner main, host titan, pid 3432998, worktree /mnt/ssd/Dropbox/prism, since 2026-09-19T23:54:41Z, age 19s, stale: pid 3432998 is gone)
- 2026-09-20T00:10:45Z (prism-eff23a): sweepMs replaces driftHz; niri sink emits ring-sweep-ms; prism migrate with backup under state/migrations; doctor hint. Rollout: install niri 26.04.r436.g597aba66, prism migrate + apply, restart session.
- 2026-09-20T00:11:06Z (prism-eff23a): done
- 2026-09-20T00:11:06Z (prism-eff23a): glass.ring.sweepMs replaces driftHz; prism migrate rewrites every store with a backup; doctor names it
