---
id: prism-6c4469
title: unset of an orphaned key fails while another orphan remains
status: idea
priority: 2
created: 2026-09-05T08:21:27Z
updated: 2026-09-29T22:48:49Z
depends: []
parent: prism-5a7c8a
tags: [cli, store]
---

Why: A store with multiple retired keys cannot be repaired one key at a time, and unset cannot reach saved profile or wallpaper-pair keys. Current unset validates the proposed fold before writing: ad17477 removed the old partial-write failure, but leaves the repair gap.

Current evidence (2026-09-29): An isolated base containing first.orphan and second.orphan rejects unset --base first.orphan and preserves the original bytes. doctor scans Default, every saved profile and pair, and runtime scratch. Known replacement keys already have prism migrate; cleanup must not discard those values as generic orphans.

Next: prism-d47f43 settles safe bulk cleanup using the existing readers, lock and backup primitives. Keep this an idea until its deletion/recovery contract is reviewed. Handoff: docs/notes/2026-09-29-store-maintenance-brief.md.

## Original capture

Two failures in the same place, and context layers added the second. (1) prism unset <orphan> deletes the key and writes values.yaml, then writeResolved throws on any other orphan still present, so removing two retired params takes two runs and the first reports an error after it already wrote. (2) unset only reaches the write target — the topmost active layer, or base with --base — so an orphan sitting in a shadowed layer cannot be removed at all without deactivating the layer above it first. doctor already knows better than unset does: it walks base and every context, active or not, and names each orphan with the file that holds it. That asymmetry is the shape of the fix. Rather than teaching unset a layer selector, give the store a single prune pass — 'prism doctor --prune', or a 'prism prune' verb — that removes every orphan from every layer in one locked pass and re-resolves once at the end. That answers both halves: no run fails because another orphan remains, and no orphan is unreachable because something shadows its layer. unset keeps its current job, which is removing a key you can name from the layer you are writing to.

## Notes

- 2026-09-05T22:56:26Z (main): Context layers widened this: unset reaches only the write target, so an orphan in a shadowed layer is now unreachable while doctor still reports it by file. Body rewritten with both halves and a prune-pass proposal that covers them together.
- 2026-09-29T22:48:49Z (main): scope: briefed; corrected obsolete partial-write premise; prism-d47f43 designs safe all-look/pair/scratch cleanup distinct from parameter migration; brief: docs/notes/2026-09-29-store-maintenance-brief.md
