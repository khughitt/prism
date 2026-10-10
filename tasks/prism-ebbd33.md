---
id: prism-ebbd33
title: Have doctor diagnose a stale or missing resolved.json directly
status: doing
priority: 2
size: s
complexity: low
process: direct
owner: main
created: 2026-09-05T22:56:03Z
updated: 2026-10-10T12:20:25Z
started: 2026-10-10T12:20:25Z
depends: []
parent: prism-5a7c8a
tags: [store, cli]
---

Why: resolved.json is derived and may lag committed inputs after interruption. doctor checks sink snapshots against a fresh resolution but never checks the bus itself. At 85f8be4, an isolated store with no sinks and an intentionally wrong resolved.params returns doctor: ok (exit 0). This gap remains after the atomic runtime cutover.

Done:
- In doctor's existing locked store read, after store validation succeeds, compare the saved bus's params with the fresh complete params using the existing deep-equality convention.
- Report a missing, malformed/invalid-shaped, or unequal bus as an explicit problem with the remedy "run 'prism apply'"; exit 1. Diagnose absence/corrupt data without hiding unrelated filesystem errors. A matching bus adds no finding.
- Continue sink diagnostics when the valid store can resolve; preserve blocked-store handling and the existing JSON {ok, problems} and pretty output contracts. doctor stays read-only.
- Add regression cases in test/cli.test.js for each bus condition, including healthy/no sinks so sink staleness cannot mask the gap; prove apply repairs it and diagnosis preserves files. Verify through just test-fast (no test-one recipe currently).
- Document in README.md that resolved.json is a derived snapshot, interruption can leave it stale, and doctor detects / apply repairs divergence. Retain the existing write order and interruption guarantees; no transaction or journal work.

Where: src/cli.js doctor/apply, src/resolve.js writeResolved, src/paths.js resolvedPath, src/store.js readJson, test/cli.test.js, test/write-order.test.js, README.md failure/retry table. The old changeSlots deletion claim below predates current context transitions and is historical context, not this task's scope.

## Original capture

A store mutation writes two or three files under one store lock — the context or values file, then active.json for a slot change, then resolved.json — and each write is individually atomic (temp file plus rename) but the set is not. A throw or crash between them leaves active.json naming the new state while resolved.json still holds the old params; and in changeSlots the file delete (commit()) runs before writeActive, so a failure there leaves a slot naming a context that is gone. Neither is a data-loss path. resolved.json is derived, every writer recomputes it from the inputs, and prism doctor compares each sink's recorded params against a fresh resolve, so it reports the sinks stale and prism apply rewrites it; a dangling slot is reported by doctor and cleared with prism context deactivate <kind>. The windows are the gap between two renames under a held lock. Journalling the store would be out of proportion to that. The cheap, honest improvement is to make the derived-ness explicit rather than transactional: have doctor compare resolved.json itself against a fresh resolve and say so on its own line ('resolved.json is stale — run prism apply') instead of only inferring it from sink status, and state the invariant in the design doc — resolved.json is derived, any writer may recompute it, divergence is detected rather than prevented. Reordering changeSlots so the slot write precedes the file delete was considered and declined during the review: the no-op early return sits between the two statements, so the swap is a restructure of logic that nine tests pin, bought for a strictly smaller window than the one above.

## Notes

- 2026-09-29T22:48:50Z (main): scope: scoped; isolated reproduction confirms doctor misses stale bus; promoted P2/s/low/direct with locked comparison, recovery cases and documentation acceptance; brief: docs/notes/2026-09-29-store-maintenance-brief.md
- 2026-10-10T12:20:25Z (main): started
  provenance: {"harness_session":"claude-code:278111ef-4125-4213-8e3c-7758b3cad216","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
