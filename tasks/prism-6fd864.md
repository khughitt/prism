---
id: prism-6fd864
title: "Store: context layers resolved over base values"
status: done
priority: 2
size: m
owner: feat/prism-6fd864
created: 2026-09-05T18:50:31Z
updated: 2026-09-05T21:54:39Z
depends: []
parent: prism-2f0b4b
tags: [store, profiles]
spec: docs/specs/2026-09-05-prism-context-layers-design.md
plan: docs/plans/2026-09-05-prism-context-layers.md
---

Outcome: the Prism store gains named contexts that layer over the base values file. Resolution order is defaults, base values, active context. A context is a keyed set of parameter values stored beside values.yaml (one file per context or one contexts file; decide in the brainstorm). New CLI verbs create, activate, deactivate, list, show, and delete contexts, and set/unset gain a target so a write can land in the active context instead of the base. Activation and every write inside an active context run the normal resolve and fan-out, so sinks see nothing new. Orphan and unknown keys inside a context fail the same way they do in values.yaml. describe --json reports the active context so the panel can show it. Prerequisite for the named-profile and wallpaper-profile pieces; both are thin clients of this layer. Keep the daemonless file bus: no watcher, no background process.

## Notes

- 2026-09-05T19:47:42Z (feat/prism-6fd864): Review 2026-09-05: save is a full snapshot; describe replaces modified with target, layer, fallback and the panel reset semantics change in this piece; slot-changing verbs recover from a broken previous state by full fan-out; the wallpaper slot carries the path; get and list use the layered path.
- 2026-09-05T20:16:11Z (feat/prism-6fd864): Plan review 2026-09-05: changeSlots validates the result before committing a delete and never skips validation on an unchanged slot; fallback below base is the default; reads take the store lock; doctor validates values in every context; the resolver validates the selected default.
- 2026-09-05T21:54:35Z (feat/prism-6fd864): took over a live claim held by session fe81466a-372b-4ddd-a050-a0162becb063 (owner feat/prism-6fd864, host titan, pid 2125223, worktree /mnt/ssd/Dropbox/prism/.worktrees/store-contexts, since 2026-09-05T19:07:17Z, age 10038s, live)
- 2026-09-05T21:54:39Z (feat/prism-6fd864): context layers: storage, layered resolution, context CLI, set/unset targeting, panel reset; spec docs/specs/2026-09-05-prism-context-layers-design.md
