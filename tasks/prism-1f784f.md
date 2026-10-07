---
id: prism-1f784f
title: "Light bending, Head wander and Wander rate are wired but read as inert"
status: done
priority: 2
size: s
complexity: mid
process: direct
owner: fix/prism-1f784f
created: 2026-10-02T00:09:28Z
updated: 2026-10-07T10:13:29Z
started: 2026-10-07T10:06:38Z
completed: 2026-10-07T10:13:28Z
depends: []
tags: [noctalia, ui, material]
agent: claude-code/claude-opus-5-5
---

Owner report (2026-10-01): the three Ring knobs seem to do nothing. They are wired: prism.kdl carries light-ior 4.5, ring-beam-noise 0.55 and ring-beam-noise-hz 12, and the native build reads them. Their effects are small. Light bending (light-ior) moves only the band's halo on the chamfer, and aurora if enabled. The native shader caps the shift at half ring-gap (material-a85a18 kept that cap), and the band core on the flat face never moves. Head wander and Wander rate modulate only the head's brightness while the beam runs, which at beamSpeed 4350 and decay 4150 is under a second, so 12 Hz flicker on a fast, fading head barely registers. Decide per knob: rewrite the label and description to say what it moves, narrow or move it to an advanced group, or ask niri-material for a stronger effect (material-4e3e9c covers embedding the band in the glass). Do not drop them without the owner's word.

## Notes

- 2026-10-02T00:14:54Z (main): Light bending: the 'no effect' finding (material-a85a18, byte-identical light-ior 1 vs 6) was at ring-gap 2. The owner now runs gap 6, which triples the cap to 3 px, so light-ior 4.5 may now move the halo. Re-measure with niri-material's ring_pair test at gap 6 before deciding this knob.
- 2026-10-02T00:14:54Z (main): Head wander: brightness flicker at 12 Hz on a fast, decaying head is below notice. Option to weigh against relabelling: wander the head's position or width (or default to about 3 Hz), visible at the same strength; that is a native change in niri-material ring.rs head_gain.
- 2026-10-07T10:06:38Z (main): started
  provenance: {"harness_session":"codex:01a115d3-f017-7310-9b8f-d57428601236","harness_session_source":"CODEX_THREAD_ID"}
- 2026-10-07T10:06:56Z (fix/prism-1f784f): resumed
  provenance: {"harness_session":"codex:01a115d3-f017-7310-9b8f-d57428601236","harness_session_source":"CODEX_THREAD_ID"}
- 2026-10-07T10:08:14Z (fix/prism-1f784f): Investigation: wiring reaches native head_gain and lightShift. Head noise changes amplitude only; ring shared shift is half-gap capped, with aberration/ripple/aurora still dependent on light-ior. Baseline passed (557 Node tests plus Lua) after README npm install. Re-measure gap 6 in an isolated native probe; no live desktop or host pointers needed.
- 2026-10-07T10:09:18Z (fix/prism-1f784f): Decision: retain all three controls and saved/default values; relabel lightIor as Halo bending, beamNoise as Head shimmer, beamNoiseHz as Shimmer rate. Tooltips explain halo/aurora versus backdrop, half-Gap saturation, brightness rather than positional motion, and focus-gain/transient visibility. Prefer this scoped presentation fix over changing the accepted native look or removing knobs.
- 2026-10-07T10:11:09Z (fix/prism-1f784f): Verification: just test-fast passed 557 Node tests and Lua checks; just check and tasks check exit 0 with no warnings. An isolated describe --json run exposes all three new labels/tooltips and the unchanged defaults (4.5, 0.55, 12). Native source confirms noise rate 0 disables head modulation.
- 2026-10-07T10:11:23Z (fix/prism-1f784f): review: impl round 1 — verdict: revise; findings: Minor 1; reviewer: codex
- 2026-10-07T10:11:23Z (fix/prism-1f784f): Review detail: Decay distance 0 removes distance fading but leaves the native head fade-in/out envelope; qualify the tooltip accordingly. Native gap-6 result remains pending inspection.
- 2026-10-07T10:12:02Z (fix/prism-1f784f): review: impl round 2 — verdict: revise; findings: Minor 1; reviewer: codex
- 2026-10-07T10:12:02Z (fix/prism-1f784f): Review detail: Beam speed is snapshotted at focus gain, so setting it to 0 prevents new beams but does not cancel a running beam. Describe effects on the moving focus beam rather than gating on the current slider value.
- 2026-10-07T10:12:02Z (fix/prism-1f784f): attached: prism-1f784f-gap6-report.log (3721 bytes): Native headless ring_pair at gap 6, ior 1.28 / thickness 31.2 / bevel 10: light-ior 1 vs 6 changes halo pixels but not the band core. One test passed; frozen repeats were byte-identical.
- 2026-10-07T10:12:02Z (fix/prism-1f784f): Measurement: native 651494ea, isolated ring_pair probe changes only BINDING name and gap from 2 to 6. just test-one -p niri ring_pair_is_reproducible_at_a_frozen_instant --no-capture passed (5.37s after 2m30 build). light-ior 1 vs 6: 18,516 px differ, max 9/255; all four peak positions and half-maximum centroids unchanged. Fixture has aberration/distortion/aurora/ripple 0 and base flex 0; this isolates halo behavior rather than predicting the full live look. Report attached. Pre-existing compiler warning: unused MergeWith import in native layout/tests.rs.
- 2026-10-07T10:12:52Z (fix/prism-1f784f): review: impl round 3 — verdict: accept; findings: none; reviewer: codex
- 2026-10-07T10:12:52Z (fix/prism-1f784f): Review disposition: two Minor tooltip issues fixed (distance fading, speed snapshotted at focus gain). Final independent review accepted against native code and gap-6 report; no Critical/Important/Minor findings remain. Live subjective visibility/readability and other hardware/optic combinations were not judged; stronger native effects and advanced grouping were declined as outside this presentation-only scope.
- 2026-10-07T10:13:28Z (fix/prism-1f784f): Final verification: revised tooltips pass just test-fast (557 Node tests plus Lua); tasks check and git diff --check exit 0, no warnings. Native probe timing harvested, its two-line fixture change reversed, no host pointers found, and its worktree removed. All three knobs are retained with clearer labels and help; no defaults, native behavior or host configuration changed.
- 2026-10-07T10:13:28Z (fix/prism-1f784f): done
  provenance: {"harness_session":"codex:01a115d3-f017-7310-9b8f-d57428601236","harness_session_source":"CODEX_THREAD_ID"}
- 2026-10-07T10:13:28Z (fix/prism-1f784f): Clarified Halo bending, Head shimmer and Shimmer rate; gap-6 native measurement confirms halo response; retained controls/defaults and passed tests/review.
  provenance: {"harness_session":"codex:01a115d3-f017-7310-9b8f-d57428601236","harness_session_source":"CODEX_THREAD_ID"}
