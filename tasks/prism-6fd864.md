---
id: prism-6fd864
title: "Store: context layers resolved over base values"
status: doing
priority: 2
size: m
owner: feat/prism-6fd864
created: 2026-09-05T18:50:31Z
updated: 2026-09-05T19:07:17Z
depends: []
parent: prism-2f0b4b
tags: [store, profiles]
---

Outcome: the Prism store gains named contexts that layer over the base values file. Resolution order is defaults, base values, active context. A context is a keyed set of parameter values stored beside values.yaml (one file per context or one contexts file; decide in the brainstorm). New CLI verbs create, activate, deactivate, list, show, and delete contexts, and set/unset gain a target so a write can land in the active context instead of the base. Activation and every write inside an active context run the normal resolve and fan-out, so sinks see nothing new. Orphan and unknown keys inside a context fail the same way they do in values.yaml. describe --json reports the active context so the panel can show it. Prerequisite for the named-profile and wallpaper-profile pieces; both are thin clients of this layer. Keep the daemonless file bus: no watcher, no background process.
