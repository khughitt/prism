# Glass noise Dulling spike

**Date:** 2026-09-07
**Status:** proposed experiment; no prototype or measurements have been produced.
**Task:** `prism-ba5f59`.
**Prior research:** [GIMP comparison](../notes/2026-09-07-glass-noise-gimp-comparison.md).

## Question and scope

Does adjustable GIMP-style Dulling make glass grain usefully easier to tune,
and what does it cost on the desktop GPU? The user found Dulling particularly
useful in GIMP. Prioritize answering that question over adding named noise types.

The required experiment is one achromatic Dulling candidate against noise off,
`white`, and `fine`. Compare GIMP's decreasing-strength behavior with matched
RMS strength. At most one additional variation may be prototyped after reviewing
those results. The deliverable is a recommendation with reproducible evidence;
prototype code stays on an explicitly labeled throwaway branch.

Prism currently exposes `white` and `fine`, defaulting to `fine`. The native
shader also retains `lightness`; the user found it visually similar to `fine`.
Neither the native acceptance document's older pending status nor completed task
checkboxes override that recorded user observation.

## Approach

Use the actual `niri-material` GLES material path in an isolated checkout.
Noise remains after sRGB encoding and saturation, before coverage and window
compositing. Keep the existing opaque-pixel early return and all other optics.

Three possible approaches were considered:

| Approach | Value | Decision |
| --- | --- | --- |
| Offline image filter only | Fast visual exploration, but cannot establish material GPU cost | Insufficient as the main probe |
| Temporary shader uniform and existing nested compositor fixture | Exercises the real shader without committing to a public interface | Selected |
| Complete KDL/resolver/Prism control | Tests a shipping interface but adds work before usefulness is known | Defer until the spike supports shipping |

No production installation, main-session restart, Prism definition change, or
plugin reload is needed for this experiment. Use a visible nested compositor for
live comparison and a controlled nested fixture for measurements. A headless
software renderer can establish correctness, but cannot establish desktop GPU
performance. Record the renderer actually used by each run.

## Candidate and parameter semantics

For integer Dulling `h` in 1–8, draw independent uniforms `U1…Uh` and an
independent equiprobable sign `S`. Let `r = min(U1…Uh)` and add `S * A * r`
equally to encoded R, G, and B. This is the GEGL distribution, using the native
hash and separate sample salts rather than reproducing GEGL's random generator.
Keep the seed fixed across captures; the noise must not depend on frame time.

Test two amplitude policies. In both, `a` is the logical material noise amount:

| Policy | Bound `A` | Interpretation |
| --- | --- | --- |
| GIMP-style | `a / 2` | Increasing Dulling reduces both strong speckles and RMS strength |
| Matched RMS | `a * sqrt((h+1)*(h+2)/24)` | RMS remains `a / sqrt(12)`, matching native white before clipping |

The first policy scales GIMP's channel-distance concept into the native amount
units; it is not a claim that equal numeric GIMP and Prism settings match.
At `h=1`, both have white's uniform distribution. Pixel-for-pixel equality with
native white is not required because the random sampling differs. At `h=2`, the
distribution is triangular; higher values concentrate deviations near zero.
Matched RMS can increase the extremes and clipping, so it is an experiment,
not an assumed improvement.

Use a runtime uniform for `h`, with a fixed maximum-eight loop. Do not benchmark
only compile-time-specialized variants and infer the cost of an adjustable
control. A temporary process setting `PRISM_SPIKE_DULLING` may feed the uniform,
read once and rejected unless it is an integer in 1–8. Its default is 2. Restart
only the nested process to change it. The environment setting is experiment
plumbing, not a proposed product API.

The prototype can replace the native `lightness` branch in the isolated build,
using `type="lightness"` solely as the existing dispatch slot. Label every
artifact `dulling`, never `lightness`, and record this temporary mapping. Leave
white and fine behavior untouched. Evaluate `fineGrain` only inside its own
branch so the candidate cannot accidentally pay for the nine unused fine
hashes. Register a float `mat_noise_dulling` beside
`mat_noise_type` in `src/render_helpers/shaders/mod.rs`, bind it in
`src/render_helpers/material.rs`, and consume it in
`src/render_helpers/shaders/material.frag`.

Implement the matched-RMS policy by scaling the fixture's written noise amount
by `sqrt((h+1)*(h+2)/6)`; the shader still uses half the written amount as `A`.
Record both logical and written amounts. This avoids a second experimental
uniform while keeping the two policies unambiguous.

Dulling is not spatial grain size. Do not add a high-pass stage to the required
candidate: that would mix two independent changes. Current fine is the spatial
high-pass comparison, not a Gaussian distribution reference.

## Execution sequence

### 1. Establish an isolated, measurable baseline

Start `prism-ba5f59` through `tasks` in the Prism checkout before execution.
Resolve the native project with `tasks root material-6e7352`; read its
`AGENTS.md` and `docs/materials/render-pipeline.md`. Pin the current native commit
and verify `098bcdca` is an ancestor. Do not rely on repository ancestry to
identify a running binary: record each executable's version and SHA-256 too.

Create a native worktree for the throwaway experiment. If permissions prevent
writing to the native repository, a local clone into a writable scratch root is
sufficient; keep its commits and patch outside the native main checkout. Do not
change project registration or install the experimental binary. In the current
sandbox the native repository is read-only; Prism and temporary directories are
writable.

Reuse these native sources instead of building a benchmark framework:

- `docs/materials/scripts/glass-noise-type-smoke.sh`: material fixture, bounded
  startup, screenshots, ROI comparisons, and cleanup. It is a standalone script,
  not a library to source; adapt the needed functions into the spike script.
- `docs/materials/scripts/material-signals-smoke.sh`: unique Tracy port and
  lock, capture connection checks, matching tools, and GPU CSV export.
- `src/render_helpers/material.rs`: existing GPU span
  `MaterialRenderElement::draw`. The generic `draw shader` span also includes
  unrelated draws and is not the primary metric.
- `docs/materials/2026-09-02-material-roughness-smoke.md`: documented Tracy
  protocol mismatch and software-renderer limitations.

Keep the small adapted driver at
`docs/materials/scripts/glass-dulling-spike.sh` in the throwaway native checkout.
Retain raw artifacts outside the product tree under a unique run directory in
`NIRI_MATERIAL_WORK_ROOT`. Preserve the driver, patch, configs, inputs, and hashes
with the final report so an abandoned branch does not lose reproducibility.

Build the unmodified baseline and prototype with identical release/profile
features and separate target directories. The build command is
`cargo build --release --features profile-with-tracy`; resolve the binary location
using `cargo metadata --format-version 1 --no-deps` and copy each executable into
its run directory before capturing. This avoids a concurrent build replacing a
binary mid-run. Run repository tests through its `just` recipes.

The inspected lockfile uses `tracy-client-sys 0.28.0`, embedding Tracy 0.13.1;
recheck this at execution. The signals script's `tools_ready` documents matching
capture/export tools. Do not assume tools on PATH speak the same protocol.
Use its reserved `TRACY_PORT` and bounded connection checks. A representative
capture/export pair, after selecting matching tools and starting the nested
client, is:

```bash
timeout 90 "$TOOLS/tracy-capture" -a 127.0.0.1 -p "$TRACY_PORT" \
  -s 45 -o "$RUN/case.tracy"
"$TOOLS/tracy-csvexport" --gpu "$RUN/case.tracy" > "$RUN/case.gpu.csv"
```

Before the candidate is implemented, prove that a baseline run produces valid
material GPU samples on the intended renderer. The previous smoke's first-14
sample rule is insufficient for this spike's p95; use the sample policy below.
If instrumentation or hardware access is unavailable, retain visual findings
and report performance as unresolved. Do not replace GPU evidence with CPU
wall time, hash counts, or refresh-capped FPS.

### 2. Implement and compare Dulling

Add only the temporary uniform, its one-time validated input, and the candidate
shader helper. Keep the `mat_noise > 0` guard. Reject Dulling inputs `0`, `9`,
`1.5`, and nonnumeric text before collecting evidence. Confirm a deliberate
invalid GLSL edit makes the driver fail rather than silently accepting a
fallback renderer; restore the valid shader before the experiment.

Check the distribution in a deterministic CPU reference using fixed-seed
independent uniforms: zero mean, support within `±A`, and variance
`2*A*A/((h+1)*(h+2))`. Use at least 65,536 samples, mean tolerance `0.02*A`,
and relative variance tolerance 10%. This checks the formula and normalization;
it does not substitute for executing the GLSL hash and material path.

For rendered evidence, use the existing signed ROI difference against a matching
noise-off capture. Record mean, RMS, clipping share, and the distribution of
absolute deviations. On a neutral diagnostic fixture, measured RMS should
follow the predicted policy within 15%; investigate failures rather than widening
the tolerance. Separate clipping and 8-bit quantization from implementation errors.
Record high-pass versus point-noise spatial differences without requiring Dulling
to reproduce fine's clump suppression. Repeat a static capture in the same
session; unchanged content must not develop temporal noise.

Use this staged matrix rather than a full Cartesian product:

| Stage | Cases | Scenes and amounts |
| --- | --- | --- |
| Primary visual comparison | off, white, fine; Dulling 1/2/4/8 under both policies | Four flat backdrops: neutral mid-gray, warm mid-tone, near-black, near-white; logical `a=0.02` |
| Practical preference check | white, fine, preferred Dulling settings | One representative wallpaper with saturated/detail regions; `a=0.02` and the user's normal amount if different |
| Diagnostic statistics | off, white, fine; Dulling 1/2/4/8 under both policies | Neutral mid-gray at logical `a=0.1`; inspect clipping before interpreting moments |
| GPU comparison | off, white, fine; Dulling 1/2/4/8 | Same detailed backdrop, logical `a=0.02`, GIMP-style policy; one pane, then three visible panes with fixed geometry |
| Normalization timing control | preferred Dulling with both policies | Same GPU fixture; retain the second timing matrix only if this control reveals a material difference |

Use 1280×720 at scale 1 for the repeatable fixture. Add a hardware run at the
user's output resolution/scale for the shortlisted setting. Record actual pane
rectangles, alpha, damaged area, and visible coverage; verify all three panes are
visible rather than assuming three spawned windows imply three material draws.
Pin all other material settings, animations, focus, and ring drift across cases.
Use the existing noise smoke's quiet optics as the controlled fixture and a saved
copy of the user's material settings for the practical comparison. Do not mutate
Prism's live values or generated fragment.

### 3. Measure, review visually, and recommend

For timings, cause controlled damage at 10 Hz across each probe pane with the
same client workload in every case. Redraw a full-pane pattern of changing text,
not merely a timestamp in one corner. Keep transparent background regions so the
material's opaque-pixel early return does not bypass the grain. Capture the
workload and verify the damage coverage; a static desktop can sleep and is not a
shader-throughput benchmark. Keep screenshot capture outside timing intervals.

Warm each run for 20 seconds and analyze material GPU events in `[20s, 40s)`
using program-relative timestamps. Capture 45 seconds and require at least 100
valid material draw samples in the window. Run three repetitions per case;
reverse case order on the second repetition and rotate it on the third. Record
background load and renderer identity for each run. Do not mix software and
hardware samples in one summary.

Read CSV columns by their headers. Tracy 0.13.1 uses `Time from start of program`
and `GPU execution time`; require the exact zone `MaterialRenderElement::draw`.
Fail on missing columns, nonfinite/nonpositive durations, or insufficient samples.
Convert nanoseconds to milliseconds. For each repetition report sample count,
median, and nearest-rank p95 (`sorted[ceil(0.95*n)-1]`). Summarize the median of
the three medians and the range of per-run medians and p95 values. Preserve the
per-run results; a pooled percentile alone can hide variation between runs.

Compare absolute and percentage deltas with both white and fine for the same
scene and pane count; include noise-off as context. Also compare white/fine in
the prototype with the unmodified baseline to detect instrumentation or shader
layout effects. These are per-material-draw GPU timings, not whole-frame times.
Do not sum per-draw p95 values or call them a frame p95. Whole-frame timing may
be reported only when independently measured with its scope and method named.
Relate costs to the recorded refresh budget without claiming frame compliance
from a partial GPU span. Differences within baseline repeat variation are
inconclusive, not proof of zero overhead.

Show labeled same-scale images for analysis and randomized A/B pairs for the
user's preference check, revealing labels afterward. Ask whether changing
Dulling improves grain character, whether normalization helps, and which range
is useful at normal viewing distance. The user handles live nested-window
interaction; this machine has no scripted pointer automation. Record the actual
observations separately from automated checks. Check dark/bright clipping, color
movement, and motion/refocus stability on the shortlisted setting. If the user
is unavailable, leave visual preference unresolved.

## Optional second variation

The default next candidate is full HSV with Dulling 2 and small independent
H/S/V distances, because it adds chromatic variation. Only prototype it if the
user wants colored grain after seeing the achromatic result. If spatial sizing
is the outstanding need instead, choose a four-corner interpolated noise lattice.
CIE LCh is an alternative when the GIMP reference has a specific visible quality
that HSV cannot reproduce. Do not try all three or revisit L-only modes merely
to increase the candidate count.

Before implementing a second variation, append its exact algorithm, channel
units/ranges, comparison settings, and any additional instrumentation to this
design. That is a separate experiment decision, not a missing step in the
required Dulling probe. If no second variation is justified, record that and
finish after Dulling. No cellular/Worley experiment is required.

## Deliverable and decision

Write `docs/notes/2026-09-07-glass-noise-dulling-spike-results.md` in Prism with:

- Native source and patch/binary hashes; driver/config/input/capture locations;
  hardware, driver, renderer/backend, build flags, resolution/scale/refresh, and
  exact run commands. No raw profiling dumps in the product repository.
- Distribution checks and same-scale comparisons; actual user observations.
- Per-run timing results, baseline variation, deltas, and interpretation limits.
- Recommended amplitude semantics, useful Dulling range, and whether the
  improvement justifies a production control. A negative or inconclusive result
  is a valid outcome when its missing evidence is named.
- Feasibility of a future native noise property through parser, resolved state,
  uniform and damage/commit tracking, plus a shared Prism numeric control. Inspect
  the existing type path and tests; do not implement that interface in this spike.
- A separate implementation task only if the evidence supports shipping, with
  unresolved hardware or visual checks retained as explicit prerequisites.

No arbitrary performance pass threshold is asserted before measurement. A
recommendation must weigh the user's visible benefit against measured cost and
repeat variation. Software-only measurements cannot close desktop performance
feasibility. Update this design's status and task notes to the evidence actually
obtained, run `tasks check`, and close the spike with the resulting recommendation.
