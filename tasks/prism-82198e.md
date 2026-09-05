---
id: prism-82198e
title: Add a Ghostty background-opacity sink
status: todo
priority: 2
size: m
created: 2026-09-01T15:48:11Z
updated: 2026-09-05T08:20:23Z
depends: []
tags: [migration, integration, terminal]
---

Outcome: Prism owns Ghostty's single static background-opacity from terminal.background.opacity.active, removing the hand-edited drift without implying focus-aware Ghostty behavior. Acceptance evidence: add a validated Ghostty sink bound only to terminal.background.opacity.active with reload liveness; prove deterministic config or apply behavior and exact failure handling with runnable tests; migrate the dotfiles Ghostty background-opacity owner without unrelated changes; and verify systemd reload updates a live Linux Ghostty instance while restoration and prism doctor remain healthy. Kitty remains the focus-aware consumer of terminal.background.opacity.active and terminal.background.opacity.inactive; niri separately owns terminal.window.opacity.active and terminal.window.opacity.inactive. Sources: docs/superpowers/specs/2026-08-15-prism-visual-bus-design.md, integrations/kitty/manifest.yaml, and integrations/niri/manifest.yaml. Uncertainty: the authority verified Ghostty 1.3.1 reload_config and systemctl reload behavior, but the current checkout has no captured Ghostty config/apply contract and the live handoff must confirm the service-unit behavior still matches.

## Notes

- 2026-09-05T08:20:23Z (main): 2026-09-05: terminal.window.opacity.* were removed with the panel matrix (prism-aa9212); niri no longer emits whole-window opacity rules. The Ghostty sink binds only terminal.background.opacity.active as planned.
