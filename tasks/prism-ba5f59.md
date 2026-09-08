---
id: prism-ba5f59
title: "Spike: evaluate glass noise Dulling and GIMP-inspired variants"
status: done
priority: 2
size: m
owner: glass-noise-spike-plan
created: 2026-09-07T21:34:19Z
updated: 2026-09-08T20:10:35Z
depends: []
tags: [noise, spike, performance]
source: docs/notes/2026-09-07-glass-noise-gimp-comparison.md
spec: docs/specs/2026-09-07-glass-noise-dulling-spike-design.md
---

Explore whether GIMP-style Dulling provides useful, affordable control over glass grain. The user found Dulling particularly useful in GIMP; prioritize that parameter over adding more named noise types. Build on docs/notes/2026-09-07-glass-noise-gimp-comparison.md (comparison task prism-fb0f3e).

Scope:
- Prototype adjustable Dulling (1–8; sample 1, 2, 4, 8) on a shared achromatic noise scalar in an isolated niri-material experiment. Compare against noise disabled and current white/fine. Compare GIMP's strength-reducing behavior with RMS-normalized strength so the choice of amount/Dulling semantics is explicit.
- If the first comparison warrants another variant, try full HSV with small independent channel distances. CIE LCh and interpolated grain size are optional alternatives, not required implementations; record why each is included or deferred. Keep spatial size distinct from amplitude distribution.
- Exercise the actual material GLES path. Use matched scenes and settings with neutral, saturated, dark, and bright backdrops, representative glass coverage, and one/multiple panes. Preserve reproducible settings and captures. User performs live visual comparisons and panel clicks where needed.

Performance and feasibility:
- Record hardware, driver, resolution/scale, refresh rate, native commit, build mode, and benchmark procedure. Warm up and repeat measurements; report median and p95 GPU/frame time and absolute/relative deltas against the baselines. Distinguish shader/GPU measurements from CPU timing or refresh-capped FPS; document unavailable instrumentation rather than claiming negligible cost.
- Check clipping/color shifts, temporal stability, shader portability, and whether Dulling remains visibly useful at practical amplitudes. Assess native parameter plumbing and Prism control feasibility without building production UI.

Done when a short evidence-backed report recommends a candidate and parameter semantics/range, or recommends stopping, with measured costs, visual observations, limitations, and links to reproducible prototype/evidence. Stop after Dulling plus at most one additional variation; file a separate implementation task only if the results support shipping. No production rollout is part of this spike.

## Notes

- 2026-09-07T21:39:39Z (glass-noise-spike-plan): Planning in .worktrees/glass-noise-spike-plan. Reuse MaterialRenderElement::draw GPU span and existing nested capture helpers; require renderer identity and protocol-matched Tracy tools. No spike execution yet.
- 2026-09-07T21:44:29Z (glass-noise-spike-plan): Proposed spike design written: runtime-uniform Dulling 1/2/4/8, GIMP-style versus matched RMS, existing material GPU span with repeated measurements and explicit hardware/visual limits. Single design includes staged execution; no implementation plan or experiment execution yet.
- 2026-09-07T22:11:14Z (glass-noise-spike-plan): Design review addressed: diagnostics use GIMP-style a=0.5 and matched-RMS a=0.25 within KDL limits; quantization-aware CDF/share shape gates, real float32 hash/salt reference, low-amplitude visibility and hash-cost predictions, output format/dithering evidence, native env naming and staged divergence-report gate. Spike remains unexecuted.
- 2026-09-07T23:10:24Z (glass-noise-spike-plan): Prototype committed in throwaway native clone (56f368bb, ab59fe53). All 16 reference rows and 8 rendered Dulling shape cases pass; 65 static repeat pairs are identical. Results and reproducible evidence recorded in docs/notes/2026-09-07-glass-noise-dulling-spike-results.md. User chose 0.02 comparison and reports 0.05-0.06 preference for existing white/fine; 0.84 remains a temporary snapshot. Hardware GPU matrix and user preference remain pending; no production rollout or shipping recommendation.
- 2026-09-07T23:21:41Z (glass-noise-spike-plan): User reports 0.02 images barely perceptible and insufficient to judge differences; requested 0.06. Generated comparison-006.html with 12 stable captures and 7 passing Dulling RGB shape cases. User hardware preflight verified RTX 3070/NVIDIA 610.57.04, 202 material GPU samples, median 0.032768 ms/p95 0.036864 ms for white 0.02; actual nested size 1651x1297. Variant cost and 0.06 preference remain pending.
- 2026-09-08T00:25:09Z (glass-noise-spike-plan): Decoded 0.06 favorites from frozen A/B key: matched-RMS h2 beats fine on warm/dark; GIMP h2 beats matched-RMS h2 on warm/bright; GIMP h8 beats h2 on warm (both good), while matched-RMS h2 beats h8 (both good). Shortlist h2 for hardware cost/live checks. Policy comparisons confound RMS with shape; no shipping decision yet. Full preferences retained in report and comparison-006-preferences.json.
- 2026-09-08T00:33:47Z (glass-noise-spike-plan): Prepared 60-case hardware matrix at 0.06 with baseline white/fine, all GIMP h values and matched-RMS h2; runtime renderer/geometry guards and repeated summary checks committed native 17dfe00a. Native just check passes 67 tooling tests, zero task warnings. Three-pane software fixture verified visible geometry and 1683 valid timed spans; no desktop cost inference. Awaiting user headless RTX renderer check before hardware matrix.
- 2026-09-08T01:33:56Z (glass-noise-spike-plan): Verified user hardware-headless-check: RTX 3070/NVIDIA 610.57.04, 1280x720 scale 1, three 358x680 panes fully visible in capture, RGBA8 and dithering off. Static headless preflight passes; full 60-case hardware matrix command ready for desktop execution.
- 2026-09-08T10:08:03Z (glass-noise-spike-plan): Verified all 60 RTX 3070 cases and 59975 raw GPU samples, expected binary hashes and stable geometry. Dulling h2 medians 0.023552/0.069632 ms (one/three panes); baseline repeat ranges overlap candidate deltas, so incremental cost remains inconclusive. Full run ranges/chart and audit recorded. Prepared 12-case 3440x1440 shortlist check with tested handoff; actual-resolution and live acceptance remain.
- 2026-09-08T20:10:35Z (glass-noise-spike-plan): Verified 12 actual-output-resolution RTX runs: 2474 valid samples, 3440x1440 scale 1, stable 2032x1400 pane. Dulling h2 aggregate median 0.043008 ms; run p95 0.036864-1.598464 ms, with noise-off also reaching 1.207296 ms. Conclude preferred achromatic h2 candidate but incremental/tail cost inconclusive. Stop bounded spike; defer rollout pending slow-draw investigation and live motion/refocus acceptance; no more broad reruns requested.
- 2026-09-08T20:10:35Z (glass-noise-spike-plan): Prototyped and assessed Dulling; h2 preferred visually, 72 hardware runs leave incremental/tail cost inconclusive, so production is deferred.
