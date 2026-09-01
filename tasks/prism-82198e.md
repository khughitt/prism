---
id: prism-82198e
title: Add a Ghostty background-opacity sink
status: todo
priority: 2
size: m
created: 2026-09-01T15:48:11Z
updated: 2026-09-01T15:48:11Z
depends: []
tags: [migration, integration, terminal]
---

Outcome: Prism owns Ghostty background opacity so terminal.background.opacity.active and terminal.background.opacity.inactive update Ghostty alongside Kitty and the niri window rules, removing the hand-edited background-opacity drift. Acceptance evidence: add a validated Ghostty sink bound to both parameters with reload liveness; prove deterministic config or apply behavior and exact failure handling with runnable tests; migrate the dotfiles Ghostty background-opacity owner without unrelated changes; and verify systemd reload updates a live Linux Ghostty instance while restoration and prism doctor remain healthy. Sources: docs/superpowers/specs/2026-08-15-prism-visual-bus-design.md, integrations/kitty/manifest.yaml, and integrations/niri/manifest.yaml. Uncertainty: the authority verified Ghostty 1.3.1 reload_config and systemctl reload behavior, but the current checkout has no captured Ghostty config/apply contract and the live handoff must confirm the service-unit behavior still matches.
