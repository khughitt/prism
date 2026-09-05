---
id: prism-ebbd33
title: resolved.json can fall behind the store after a failed write
status: idea
priority: 2
created: 2026-09-05T22:56:03Z
updated: 2026-09-05T22:56:03Z
depends: []
tags: [store, cli]
---

A store mutation writes two or three files under one store lock — the context or values file, then active.json for a slot change, then resolved.json — and each write is individually atomic (temp file plus rename) but the set is not. A throw or crash between them leaves active.json naming the new state while resolved.json still holds the old params; and in changeSlots the file delete (commit()) runs before writeActive, so a failure there leaves a slot naming a context that is gone. Neither is a data-loss path. resolved.json is derived, every writer recomputes it from the inputs, and prism doctor compares each sink's recorded params against a fresh resolve, so it reports the sinks stale and prism apply rewrites it; a dangling slot is reported by doctor and cleared with prism context deactivate <kind>. The windows are the gap between two renames under a held lock. Journalling the store would be out of proportion to that. The cheap, honest improvement is to make the derived-ness explicit rather than transactional: have doctor compare resolved.json itself against a fresh resolve and say so on its own line ('resolved.json is stale — run prism apply') instead of only inferring it from sink status, and state the invariant in the design doc — resolved.json is derived, any writer may recompute it, divergence is detected rather than prevented. Reordering changeSlots so the slot write precedes the file delete was considered and declined during the review: the no-op early return sits between the two statements, so the swap is a restructure of logic that nine tests pin, bought for a strictly smaller window than the one above.
