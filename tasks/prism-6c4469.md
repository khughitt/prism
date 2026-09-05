---
id: prism-6c4469
title: unset of an orphaned key fails while another orphan remains
status: idea
priority: 2
created: 2026-09-05T08:21:27Z
updated: 2026-09-05T22:56:26Z
depends: []
tags: [cli, store]
---

Two failures in the same place, and context layers added the second. (1) prism unset <orphan> deletes the key and writes values.yaml, then writeResolved throws on any other orphan still present, so removing two retired params takes two runs and the first reports an error after it already wrote. (2) unset only reaches the write target — the topmost active layer, or base with --base — so an orphan sitting in a shadowed layer cannot be removed at all without deactivating the layer above it first. doctor already knows better than unset does: it walks base and every context, active or not, and names each orphan with the file that holds it. That asymmetry is the shape of the fix. Rather than teaching unset a layer selector, give the store a single prune pass — 'prism doctor --prune', or a 'prism prune' verb — that removes every orphan from every layer in one locked pass and re-resolves once at the end. That answers both halves: no run fails because another orphan remains, and no orphan is unreachable because something shadows its layer. unset keeps its current job, which is removing a key you can name from the layer you are writing to.

## Notes

- 2026-09-05T22:56:26Z (main): Context layers widened this: unset reaches only the write target, so an orphan in a shadowed layer is now unreachable while doctor still reports it by file. Body rewritten with both halves and a prune-pass proposal that covers them together.
