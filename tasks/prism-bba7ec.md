---
id: prism-bba7ec
title: "debug-backdrop: depend on quickshell explicitly and skip cleanly when qs is absent"
status: done
priority: 2
size: s
owner: sink-error-legibility
created: 2026-09-08T15:13:04Z
updated: 2026-09-09T00:29:31Z
depends: []
tags: [robustness, quickshell]
spec: docs/specs/2026-09-08-sink-requirements-design.md
plan: docs/plans/2026-09-08-sink-requirements.md
step: "Task 2: Declared requirements, checked before apply"
---

Found bringing europa (laptop) up to date on 2026-09-08 after ~3 weeks. The sink spawns qs directly and aborted setup.sh when quickshell was ABI-broken; it would fail the same way with qs simply uninstalled, even with debug.backdrop=false. Note qs comes from extra/quickshell, not from Noctalia v5. Outcome: the dependency is declared, and an absent qs is a clear skip rather than a phase-ending crash.

## Notes

- 2026-09-09T00:29:31Z (sink-error-legibility): sinks declare prerequisites in the manifest; debug-backdrop declares qs and skips cleanly when the backdrop is off
