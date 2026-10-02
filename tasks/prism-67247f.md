---
id: prism-67247f
title: Derive glass tint from Noctalia with manual tuning and regression checks
status: done
priority: 1
size: m
complexity: mid
process: direct
owner: feat/noctalia-glass-color
created: 2026-10-02T09:44:26Z
updated: 2026-10-02T10:19:17Z
started: 2026-10-02T10:12:21Z
completed: 2026-10-02T10:19:16Z
depends: [prism-0bb71e]
parent: prism-b5cb1e
tags: []
agent: codex
spec: docs/specs/2026-10-02-noctalia-glass-color-design.md
plan: docs/plans/2026-10-02-noctalia-glass-color.md
step: "Task 3: Implement palette-driven tint, controls and regression checks"
---

After the first-landing refresh gate succeeds, implement the required-field palette reader, pure tint derivation, apply consumer selection, defs/rack/manifest controls and 30/35 px defaults. Preserve neutral, bypass, ring and starter profiles; cover both focus states, failure recovery and unchanged store across palette changes. Commit the complete second phase without merging it yet.

## Notes

- 2026-10-02T10:12:21Z (feat/noctalia-glass-color): started
  provenance: {"harness_session":"codex:01a0fba1-797b-7612-ac6c-b272e5fc6832","harness_session_source":"CODEX_SESSION_ID"}
- 2026-10-02T10:12:58Z (feat/noctalia-glass-color): Caller audit: integrations/niri/probe-material also renders defaults (extensionless executable missed by JS-only search). Set its synthetic tint source to manual; capability probing must require no palette while still exercising both materials and every native property. Existing probe failure tests verify this path.
- 2026-10-02T10:19:16Z (feat/noctalia-glass-color): Implemented validated consumer-specific palette reader, shared sRGB tint before bypass, Noctalia/manual controls and 30/35 distances. Template caller and palette-free capability probe updated; starter presets stay manual. CLI two-palette test exercises resolution/fan-out/lock and preserves base/profile/runtime/pending edits and effective params. RED observed for missing reader, tint output, required fields, controls and presets; final just test-fast: 499/499 Node, zero skipped, Lua checks pass; tasks check clean.
- 2026-10-02T10:19:16Z (feat/noctalia-glass-color): done
  provenance: {"harness_session":"codex:01a0fba1-797b-7612-ac6c-b272e5fc6832","harness_session_source":"CODEX_SESSION_ID"}
- 2026-10-02T10:19:16Z (feat/noctalia-glass-color): Palette-driven tint, controls, recovery and CLI store-preservation checks implemented; 499 Node tests plus Lua pass. Second landing awaits independent review and refresh recheck.
  provenance: {"harness_session":"codex:01a0fba1-797b-7612-ac6c-b272e5fc6832","harness_session_source":"CODEX_SESSION_ID"}
