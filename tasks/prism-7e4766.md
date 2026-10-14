---
id: prism-7e4766
title: Let an unset glass.inactive.* follow its focused value instead of a fixed default
status: dropped
priority: 2
size: m
complexity: high
created: 2026-09-08T22:56:48Z
updated: 2026-10-14T14:16:19Z
depends: []
tags: [defs, store, material]
---

Widening the focus matrix (prism-a4ef9a) made tuned focused values stop reaching the unfocused material: glass.backdropBlur=true on this host now frosts only the focused window, because glass.inactive.backdropBlur carries its own default of false. Every host that tuned attenuationColor, ior, thickness, distortionScale, or backdropBlur before the split has the same break.

Mechanism to design: a def-level marker (say 'inherits: focused') consulted when the twin is unset at every layer, so resolution falls back to the resolved focused value rather than the twin's default. It cannot be blanket inheritance - the six receding pairs (roughness, attenuationDistance, chromaticAberration, distortion, noise, saturation) ship divergent defaults on purpose, and an unset inactive.roughness must stay 0.5, not follow the focused 0.08. So the marker belongs on the five pairs that ship level.

Open question: what 'unset' means against context layers (prism-2f0b4b), where a wallpaper context may set the focused half only.

Cheaper alternative if this proves too subtle: a doctor check that warns when a focused optic is tuned and its twin still sits at the shipped default.

## Notes

- 2026-10-14T14:15:09Z (main): scope: drop; premise gone at 4bb72f3: the migration break on this host is historical (the active profile sets both halves of all five pairs), 22-24 of 24 saved profiles set both twins and diverge them in 17-22, and for backdropBlur 17 choose focused on/unfocused off with none unfocused on, so inheriting the focused value would go against the owner's own choices; 'Mirror focused onto unfocused' (reset symmetric, 06d568e) covers deliberate levelling; proposal: drop as superseded by the owner's tuning practice and reset symmetric; the receded-default question continues in prism-c3a7b9; prism-d2b31a (shelved, waits on this task's findings) should take this survey as that finding
- 2026-10-14T14:16:19Z (main): dropped
  provenance: {"harness_session":"claude-code:d5788b22-f738-480a-9afd-2f01dfa7045c","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-14T14:16:19Z (main): Dropped with owner approval 2026-10-14: 24 saved profiles set both twins and diverge them, so inheriting the focused value contradicts the owner's tuning; reset symmetric covers levelling; receded defaults continue in prism-c3a7b9
  provenance: {"harness_session":"claude-code:d5788b22-f738-480a-9afd-2f01dfa7045c","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
