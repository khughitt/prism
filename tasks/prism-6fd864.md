---
id: prism-6fd864
title: "Store: context layers resolved over base values"
status: doing
priority: 2
size: m
owner: feat/prism-6fd864
created: 2026-09-05T18:50:31Z
updated: 2026-09-05T19:47:42Z
depends: []
parent: prism-2f0b4b
tags: [store, profiles]
spec: docs/specs/2026-09-05-prism-context-layers-design.md
---

Outcome: the Prism store gains named contexts that layer over the base values file. Resolution order is defaults, base values, active context. A context is a keyed set of parameter values stored beside values.yaml (one file per context or one contexts file; decide in the brainstorm). New CLI verbs create, activate, deactivate, list, show, and delete contexts, and set/unset gain a target so a write can land in the active context instead of the base. Activation and every write inside an active context run the normal resolve and fan-out, so sinks see nothing new. Orphan and unknown keys inside a context fail the same way they do in values.yaml. describe --json reports the active context so the panel can show it. Prerequisite for the named-profile and wallpaper-profile pieces; both are thin clients of this layer. Keep the daemonless file bus: no watcher, no background process.

## Notes

- 2026-09-05T19:47:42Z (feat/prism-6fd864): Review 2026-09-05: save is a full snapshot; describe replaces modified with target, layer, fallback and the panel reset semantics change in this piece; slot-changing verbs recover from a broken previous state by full fan-out; the wallpaper slot carries the path; get and list use the layered path.
