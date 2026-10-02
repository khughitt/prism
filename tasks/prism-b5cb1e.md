---
id: prism-b5cb1e
title: Derive glass attenuation color and terminal palette from the Noctalia colorscheme
status: doing
priority: 1
size: m
complexity: high
process: planned
owner: feat/noctalia-glass-color
created: 2026-09-05T01:10:50Z
updated: 2026-10-02T09:27:10Z
started: 2026-10-02T08:08:45Z
depends: []
tags: [integration, noctalia, colors]
spec: docs/specs/2026-10-02-noctalia-glass-color-design.md
---

Outcome: the active terminal-glass material carries the Noctalia surface color at a short attenuation distance, refreshed on every palette change, so light terminal text stays legible over bright and dark wallpapers in Noctalia dark mode with kitty at background_opacity 0 (dots-a00088 landed 2026-09-06 with a hand-seeded #111317 at distance 30 on titan). Direction settled 2026-09-04: Noctalia colorscheme is the dominant source, flow noctalia -> prism -> glass. Transport: a Noctalia template post_hook (the path noctalia-glass-sync already uses) that writes the surface tone into Prism; decide in the brainstorm whether that is a base write, a derived value the resolver computes from a new colors input, or a state context. Keep the palette accent as a secondary mix; it is wallpaper-derived only for a wallpaper-generated scheme. Acceptance: change wallpaper twice; the active material's attenuation-color in prism.kdl follows the palette surface each time, the inactive variant follows too, and focused/unfocused light text is legible over both a bright and a dark wallpaper in dark mode. Light-mode legibility is outside this absorption-only task. Load-bearing for ops-500adb now that the terminal paints no background.

## Notes

- 2026-09-05T01:46:44Z (main): Focus-glass spike (material docs 2026-09-04) shows the active material must carry the terminal background color at a short attenuation distance once kitty is at 0; the wallpaper-derived attenuation color alone leaves text illegible. Direction: terminal background from the palette, wallpaper tint as a secondary mix.
- 2026-09-05T01:57:44Z (main): Direction 2026-09-04: Noctalia colorscheme is the dominant color source; flow is noctalia -> prism -> glass color/hue. familiar owns only accent/ring per window (fam-b32b3d).
- 2026-09-05T02:00:00Z (main): Correction: glass.attenuationColor is a manual value (values.yaml), not wallpaper-derived; Noctalia colors.json (mSurface #13140f, mPrimary #bad065 today) does not reach Prism yet. Noctalia's template post_hook path (as used by noctalia-glass-sync for nvim) is the candidate transport.
- 2026-09-05T18:51:00Z (main): Related 2026-09-05: prism-2f0b4b (context-specific profiles); an auto-derived tint shrinks what a wallpaper profile must store.
- 2026-09-07T08:21:16Z (main): 2026-09-07 promoted to todo P1: with kitty at 0 the glass is the only thing behind the text; a fixed attenuation color drifts out of step within one rotation.
- 2026-09-08T22:56:56Z (main): The focus matrix now has glass.inactive.attenuationColor as well (prism-a4ef9a), so a derived tint has two halves to fill; deriving only the focused one leaves the unfocused material on the shipped #dfe8ff.
- 2026-10-02T08:08:45Z (main): started
  provenance: {"harness_session":"codex:01a0fba1-797b-7612-ac6c-b272e5fc6832","harness_session_source":"CODEX_SESSION_ID"}
- 2026-10-02T08:08:45Z (main): process: planned — the existing palette hook can carry surface color, but tint source selection, secondary color mixing, and treatment of manual focus-state values need a reviewed design; no resolver or store mutation is required for the recommended sink approach.
- 2026-10-02T08:09:57Z (feat/noctalia-glass-color): resumed
  provenance: {"harness_session":"codex:01a0fba1-797b-7612-ac6c-b272e5fc6832","harness_session_source":"CODEX_SESSION_ID"}
- 2026-10-02T08:13:58Z (feat/noctalia-glass-color): design: extend the existing palette transport with surface, derive shared focus-state tint in the niri sink, retain a manual source and distance controls, and expose an adjustable secondary palette-accent mix; draft ready for user review. Baseline just test-fast: 490 Node tests passed, Lua panel checks passed.
- 2026-10-02T08:15:29Z (feat/noctalia-glass-color): self-review: draft has explicit source precedence, color interpolation, consumer-specific validation, bypass/neutral behavior, upgrade steps and desktop acceptance; no placeholders or conflicting requirements found. tasks check: zero errors and zero warnings.
- 2026-10-02T08:15:29Z (feat/noctalia-glass-color): parked (waiting on user, review): User reviews .worktrees/noctalia-glass-color/docs/specs/2026-10-02-noctalia-glass-color-design.md; after approval, the agent drafts the implementation plan there for review before coding.
  provenance: {"harness_session":"codex:01a0fba1-797b-7612-ac6c-b272e5fc6832","harness_session_source":"CODEX_SESSION_ID"}
- 2026-10-02T09:15:14Z (feat/noctalia-glass-color): resumed
  provenance: {"harness_session":"codex:01a0fba1-797b-7612-ac6c-b272e5fc6832","harness_session_source":"CODEX_SESSION_ID"}
- 2026-10-02T09:15:15Z (feat/noctalia-glass-color): review: spec round 1 — verdict: revise; findings: must 2, should 4, minor 2; reviewer: human
- 2026-10-02T09:26:18Z (feat/noctalia-glass-color): spec revision 1: recommend dark-mode-only legibility; palette accent terminology; pickers remain visible with stored manual values; manual or bypassed tint needs no palette with familiar/manual ring; distance defaults 30 focused/35 unfocused preserve 70:60 ratio at shipped depth 20. Review fixes are in the revised spec; plan remains unstarted.
- 2026-10-02T09:26:19Z (feat/noctalia-glass-color): refresh evidence: installed Noctalia v5.2.0 templates-apply returned ok, but unchanged template output showed no mtime change in 10s and 45s probes; no completed refresh inferred from acknowledgment. Exact documented direct noctalia theme shell command exited 0 and upgraded a primary-only palette to valid primary+surface in an isolated directory. Fixed dark/light token maps both rendered correctly. No product code deployed and no host pointers repointed.
- 2026-10-02T09:27:09Z (feat/noctalia-glass-color): self-review: all 8 findings addressed; niri's shader confirms pow(color, opticalDistance/distance). Exact documented refresh passed the primary-only upgrade check, and its predefined-scheme guard refused before rendering. tasks check and git diff --check are clean; no product files changed.
- 2026-10-02T09:27:09Z (feat/noctalia-glass-color): parked (waiting on user, review): User re-reviews .worktrees/noctalia-glass-color/docs/specs/2026-10-02-noctalia-glass-color-design.md (round 1 findings addressed, dark-mode scope recommended); after acceptance the agent records review round 2 and drafts the implementation plan in this worktree.
  provenance: {"harness_session":"codex:01a0fba1-797b-7612-ac6c-b272e5fc6832","harness_session_source":"CODEX_SESSION_ID"}
