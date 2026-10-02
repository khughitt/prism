---
id: prism-0bb71e
title: Land the template first and verify the host palette refresh
status: done
priority: 1
size: s
complexity: mid
process: direct
owner: feat/noctalia-glass-color
created: 2026-10-02T09:44:25Z
updated: 2026-10-02T10:11:32Z
started: 2026-10-02T10:09:24Z
completed: 2026-10-02T10:11:31Z
depends: [prism-47da20]
parent: prism-b5cb1e
tags: []
agent: codex
spec: docs/specs/2026-10-02-noctalia-glass-color-design.md
plan: docs/plans/2026-10-02-noctalia-glass-color.md
step: "Task 2: Merge the template and verify the host palette"
---

Merge only the template/tests/README phase into main while the original sink remains installed; refresh each rollout host and verify valid primary plus surface before allowing the second phase. Record live paths, main revision, host and output. Failed refresh blocks the second landing; no host pointers may be repointed.

## Notes

- 2026-10-02T10:09:24Z (feat/noctalia-glass-color): started
  provenance: {"harness_session":"codex:01a0fba1-797b-7612-ac6c-b272e5fc6832","harness_session_source":"CODEX_SESSION_ID"}
- 2026-10-02T10:10:45Z (feat/noctalia-glass-color): Merge 1: main 6029ec5; wrapper and registered template resolve to main on titan, no tint source/sink/default changes. just gate: 490 Node tests plus Lua checks passed. templates-apply acknowledged but immediate validation found no surface; documented direct wallpaper render exited 0 and produced primary #c5cb8d, surface #131410. Old bin/prism apply niri validated but reload failed connecting to its niri socket; investigating environment before closing the gate.
- 2026-10-02T10:11:31Z (feat/noctalia-glass-color): Refresh gate passed on rollout host titan: direct render primary #c5cb8d surface #131410 validated; old main apply exited 0 using per-command NIRI_SOCKET=/run/user/1000/niri.wayland-1.1598212.sock. Harness inherited stale socket for pid 2649; current compositor is pid 1598212, version 26.04. No persistent environment/config pointer changed. Merge 1 remains 6029ec5; no other rollout host accessed or assumed ready.
- 2026-10-02T10:11:31Z (feat/noctalia-glass-color): done
  provenance: {"harness_session":"codex:01a0fba1-797b-7612-ac6c-b272e5fc6832","harness_session_source":"CODEX_SESSION_ID"}
- 2026-10-02T10:11:31Z (feat/noctalia-glass-color): Merge 1 6029ec5 landed template-only phase; titan primary/surface validated after synchronous refresh; old apply exited 0 with current compositor socket. Gate passed 490 tests plus Lua.
  provenance: {"harness_session":"codex:01a0fba1-797b-7612-ac6c-b272e5fc6832","harness_session_source":"CODEX_SESSION_ID"}
