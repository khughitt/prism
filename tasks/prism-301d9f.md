---
id: prism-301d9f
title: Emit niri's surface-remap rule for the Noctalia bar and panels
status: todo
priority: 2
created: 2026-10-17T14:42:02Z
updated: 2026-10-17T14:42:02Z
depends: []
tags: []
agent: claude-code/claude-opus-5-5
---

Spec: niri-material docs/specs/2026-10-16-noctalia-glass-cohesion-design.md §6. Template: add surface_container and outline_variant to integrations/niri/noctalia-palette.template. Sink: emit one complete surface-remap node while glass.enabled and a new shell.remap (default on) are both on, whatever the tint source: the three family colors, the active glass material's name, hue-chroma from a new shell.hueChroma (default 0.03, the owner's pick from material-62347d on 2026-10-17). Omit it with 'shell remap off: Noctalia is in light mode' when the resolved surface is lighter than Oklab L 0.4. A missing palette fails the apply only when the rule is to be emitted. Tests: spec Verification, Prism tests (glass on, glass off with no palette requirement, remap off, light mode, niri validate on each fragment).
