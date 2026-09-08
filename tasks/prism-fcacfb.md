---
id: prism-fcacfb
title: Decide what context save snapshots when the target is not the topmost layer
status: done
priority: 2
size: s
created: 2026-09-05T22:55:40Z
updated: 2026-09-08T23:28:01Z
depends: []
parent: prism-2f0b4b
tags: [profiles, store]
spec: docs/specs/2026-09-05-prism-context-layers-design.md
---

prism context save <kind> <name> writes every effective parameter into the named context. When the target is active but NOT topmost — saving the active wallpaper while a profile is also active — the wallpaper context absorbs the profile's values: a two-line wallpaper file becomes a full snapshot carrying the profile's glass.ior. The spec's stated guarantee (save cannot change the effective values even when it replaces an active context) still holds at the moment of saving, but deactivating the profile afterwards then yields the profile's value rather than the wallpaper's. The implementation does exactly what the spec says; the spec never considered a non-topmost active save, and that sits in tension with its own decision that a wallpaper context holds only what was tuned while a saved profile is a full snapshot. A caveat is recorded in the spec and no behaviour was changed, because refusing the target is a user-visible restriction and this is a design call rather than a review fix. Options to weigh: (a) refuse a save whose target is active but not topmost; (b) snapshot the stack up to and including the target rather than the full effective params — honest about provenance, but then save is no longer inert for keys the upper layers do not set; (c) keep today's behaviour and have the panel never offer it. Settle before the panel grows save controls: prism-ea6344's save button and prism-648e0f's open question about whether every edit under a wallpaper goes to the wallpaper context both land here. No test pins the behaviour either way today.

## Notes

- 2026-09-07T01:23:13Z (main): 2026-09-06 decision (see prism-fc8491): option (a) plus restriction. save is limited to the profile kind and the target is always topmost by the new target rule, so a save can never absorb a layer above it. Wallpaper files come only from pinned edits.
- 2026-09-08T23:28:01Z (main): Settled by prism-fc8491 as option (a) plus a restriction: the write target is always the topmost explicit layer, and save is limited to the profile kind (src/context-cli.js:132), so a save can no longer absorb a layer above its target. Pinned by test/context-cli.test.js:131 and recorded in the context-layers spec. Wallpaper contexts come only from pinned edits.
