# Glass noise Dulling spike

**Date:** 2026-09-07
**Status:** isolated prototype and software-rendered distribution/capture checks executed;
user preferences recorded at 0.06 and the 60-case RTX 3070 matrix verified.
Incremental cost is inconclusive within repeat variation. Actual-output-resolution
and live visual acceptance checks remain pending. See the
[execution results](../notes/2026-09-07-glass-noise-dulling-spike-results.md).
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
control. The same shader already uses this pattern for uniform `mat_samples`
(`material.frag:459–463` at native `691a1320`); the loop form itself is not an
unanswered GLES feasibility question. A temporary process setting
`NIRI_MATERIAL_SPIKE_DULLING` may feed the uniform,
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
uniform while keeping the two policies unambiguous. Native `Noise::amount` is
`FloatOrInt<0, 1>` (`niri-config/src/material.rs:424`), so require
`a <= sqrt(6/((h+1)*(h+2)))`: the logical ceiling is 0.447214 at h=4 and
0.258199 at h=8. Validate every generated KDL with the tested binary and fail
on an excessive written amount; never silently clamp it. The matched-RMS
diagnostic uses logical `a=0.25`, reaching written 0.968246 at h=8.

### Predictions registered before measurement

The candidate uses `h+1` hashes: h=1/2/4/8 costs 2/3/5/9 hash evaluations,
versus one for white and nine for fine. Predict increasing candidate cost with
h, with h=2 a plausible cheaper alternative to fine and h=8 in the same broad
work class as fine. Min reductions, sign selection, uniform-loop overhead,
compiler scheduling, and GPU bottlenecks can change this ordering. Hash counts
are a cost hypothesis, not timing evidence or an assertion of equal GPU cost.

At Prism's actual inactive default `a=0.02`, the continuous GIMP-style RMS,
expressed in 8-bit encoded levels before quantization and compositing, is:

| h | 1 | 2 | 4 | 8 |
| --- | ---: | ---: | ---: | ---: |
| RMS in LSB | 1.47 | 1.04 | 0.66 | 0.38 |

Hypothesis: h≥4 may look much closer to noise-off on an 8-bit output, limiting
the useful GIMP-style range to around 1–2 at that amount. Matched RMS maintains
1.47 LSB before quantization and may keep more of the range useful. Sub-LSB RMS
does not prove invisibility: sparse changed pixels can remain visible, and
baseline code phase, compositing, dithering, and higher output precision matter.
For example, nearest rounding about an exact code center predicts about 83%
unchanged pixels at h=8, a=0.02, versus about 28% at a=0.1. These are conditional
predictions, not measured shares or a universal output model.

Record nested render-target/framebuffer formats, output format and bit depth,
screenshot bit depth, and whether spatial or temporal dithering is enabled at
each conversion. XRGB8888 is a hypothesis to verify, not an assumed fact. An
8-bit PNG cannot prove an 8-bit rendering pipeline. Report unknown stages and
test visibility against the actual output; do not interpret vanished grain as
evidence that the continuous distributions are identical.

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
change project registration or install the experimental binary. The native
repository is outside this session's declared working/writable directories;
that is not a claim about its filesystem permissions in another session. Check
execution permissions at run time and use a writable isolated checkout.

Reuse these native sources instead of building a benchmark framework:

- `docs/materials/scripts/glass-noise-type-smoke.sh`: material fixture, bounded
  startup, screenshots, ROI comparisons, and cleanup. It is a standalone script,
  not a library to source; adapt the needed functions into the spike script.
  Its lightness chroma assertions (`lightness_ab_rmse`, including the one-code
  bound) are invalid once that dispatch slot carries Dulling. Do not run the
  unmodified script against the prototype and count its result as acceptance.
  Replace those assertions with the Dulling distribution gates below; preserve
  noise-off/white/fine controls and the original smoke for the unmodified build.
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
binary mid-run. Run repository tests through its `just` recipes. `just test`
runs the Rust suite; it does not compile/exercise the material GLSL on a GPU.
The adapted GLES capture and distribution checks are a separate required gate.
Budget for the native commit gate on the throwaway branch: after staging the
prototype changes, regenerate and stage the divergence report, then run checks:

```bash
just upstream-report
git add docs/materials/upstream-divergence.md
just check
```

`just check` includes both `tasks check` and `upstream-report --check`; the latter
compares the report with the staged tree. Restage and regenerate if source
changes again before committing. Do not bypass that hook for a prototype.

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

Before modifying the shader, check both the ideal distribution and the actual
hash sampling in a CPU reference. Keep the fixed-seed independent-uniform
reference for the algebra; add a float32 port of the native `hash12` using the
actual magnitude/sign salts proposed for GLSL. `hash12` uses fract, multiply,
add, and dot; it has no sine. Match the component order (`p.xyx`, `p3.yzx`) and
round intermediate operations to float32 rather than silently using Python's
double precision. GPU contraction/rounding may differ, so this is a correlation
screen, not a promise of CPU/GPU bit parity.

Freeze this initial salt schedule in the reference and shader:

```text
p = (pixel_x + 0.5, pixel_y + 0.5) + (47, 113)
magnitude salts = (0,0), (19,73), (101,29), (43,151),
                  (173,97), (227,41), (61,239), (251,181)
sign salt = (137,307), independent of h
```

Take the first h magnitude draws. Sample a 512×128 pixel grid at origins
(0,0) and (2048,1024), separately, to expose position-dependent artifacts.
The schedule is a proposal to test, not an assertion of independence. Before
GPU work, require both reference sources at each h to meet:

- Support within `±A`, mean within `0.02*A` of zero, and positive-sign share
  within 0.01 of 0.5.
- Mean absolute deviation within 5% of `A/(h+1)` and variance within 10% of
  `2*A*A/((h+1)*(h+2))`.
- Absolute-deviation CDF within 0.01 of `F(t)=1-(1-t/A)^h` at
  `t/A = 0.1, 0.25, 0.5, 0.8`.

These checks screen for harmful dependence in the min/sign draws; independent
uniforms alone cannot detect it, and finite tests cannot prove independence.
If the real hash fails, retain the failing evidence and revise the salt schedule
or generator explicitly before GPU implementation; do not loosen tolerances.

For rendered evidence, use a flat, fully transparent interior ROI with coverage
one and no text/edges. Compare encoded RGB code values against a matching
deterministic noise-off capture. Adapt the smoke's ROI and signed-difference
helpers, but extract channels without a grayscale/linear-light conversion that
would change the units. Check each channel independently on the warm fixture.
Retain at least 65,536 pixels, before clipping exclusions, per diagnostic case.

**Shape is a required gate for both policies.** Reuse the smoke's `top_band`,
`below_median`, and `beyond_white` concepts with explicit logical-amount units:

```text
below_median = P(|delta| < a/4)      predicted F(a/4)
top_band     = P(0.4a <= |delta| <= 0.5a)
                                      predicted F(0.5a) - F(0.4a)
beyond_white = P(|delta| > a/2)      predicted 1 - F(a/2)
```

Extend F with zero below 0 and one above A. For GIMP-style, these predictions
are `1-0.5^h`, `0.2^h`, and zero. For matched RMS use its actual A; beyond-white
mass is allowed and predicted. Also gate the CDF at `t/A = 0.1, 0.25, 0.5, 0.8`
so matching RMS cannot hide an incorrect shape. Sparse tail bins alone cannot
identify high h; the interior CDF checks provide that discrimination.

Account for output quantization **before** evaluating gates. For a verified
8-bit encoded path with nearest rounding and no dithering, a difference of two
quantized captures has at most `epsilon=1/255` error relative to the continuous
delta. At each threshold require the observed CDF to lie between
`F(max(0,t-epsilon))` and `F(min(A,t+epsilon))`, with 0.01 absolute sampling
allowance. Derive band intervals from the endpoint bounds. Use matching strict
or inclusive code-bin endpoints, and require no sample outside `±(A+epsilon)`.
For other verified output conversions, precompute corresponding bounds before
reading candidate results. Unknown dithering/precision leaves this gate
unresolved; do not silently assume the convenient model.

Record clipping share separately and include the predicted clamp in the forward
model. If a share c is excluded, normalize on the retained pixels and transform
CDF bounds conservatively as `max(0,(lower-c)/(1-c))` and
`min(1,upper/(1-c))`; do not compare a clipped subset directly with the original
unconditional CDF. Confirm with the unclipped diagnostic ROI where available.
For negligible clipping, retain RMS as a normalization check with tolerance
`max(0.15*predicted_RMS, epsilon)`, not as the shape criterion. Material clipping
and screenshot quantization must not be confused with a hash/min implementation
failure. Do not assume a universal clipping fraction from another fixture.

Record high-pass versus point-noise spatial differences without requiring Dulling
to reproduce fine's clump suppression. Repeat a static capture in the same
session; unchanged content must not develop temporal noise. If output dithering
is temporal, distinguish that behavior from a frame-dependent grain seed.

Use this staged matrix rather than a full Cartesian product:

| Stage | Cases | Scenes and amounts |
| --- | --- | --- |
| Primary visual comparison | off, white, fine; Dulling 1/2/4/8 under both policies | Four flat backdrops: neutral mid-gray, warm mid-tone, near-black, near-white; logical `a=0.02` |
| Practical preference check | white, fine, preferred Dulling settings | One representative wallpaper with saturated/detail regions; `a=0.02` and the user's normal amount if different |
| GIMP-style diagnostic | off, white, fine; Dulling 1/2/4/8 | Existing warm mid-tone fixture at logical/written `a=0.5`; retain clipping and per-channel statistics |
| Matched-RMS diagnostic | off, white, fine; Dulling 1/2/4/8 | Neutral mid-gray at logical `a=0.25`; maximum written amount 0.968246; measure actual clipping |
| GPU comparison | off, white, fine; Dulling 1/2/4/8 | Same detailed backdrop, logical `a=0.02`, GIMP-style policy; one pane, then three visible panes with fixed geometry |
| Normalization timing control | preferred Dulling with both policies | Same GPU fixture; retain the second timing matrix only if this control reveals a material difference |

The stronger diagnostics test shape, not desktop preference. GIMP-style a=0.5
matches the existing smoke's diagnostic strength and gives h=8 about 9.5 LSB
RMS before quantization. Do not raise matched-RMS a to 0.5: it exceeds the KDL
amount ceiling for h≥4. Visual and performance cases stay at practical amounts.

Use 1280×720 at scale 1 for the repeatable fixture. Add a hardware run at the
user's output resolution/scale for the shortlisted setting. Record actual pane
rectangles, alpha, damaged area, and visible coverage; verify all three panes are
visible rather than assuming three spawned windows imply three material draws.
Pin all other material settings, animations, focus, and ring drift across cases.
Use the existing noise smoke's quiet optics as the controlled fixture and a saved
copy of the user's material settings for the practical comparison. Do not mutate
Prism's live values or generated fragment.

### 3. Measure, review visually, and recommend

**Execution refinement after visual review:** use logical amount 0.06 for the
hardware matrix. Retain off/white/fine and GIMP h=1/2/4/8; interleave unmodified
white/fine and matched-RMS h=2 controls in the same repeated matrix (60 cases
across one/three panes). The visible preflight resized to 1651×1297. Prefer
headless hardware rendering after verifying its GPU identity; fail on unexpected
output dimensions, hidden panes or geometry changes instead of mixing coverage.

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
  hardware, driver, renderer/backend, framebuffer/output/capture formats and
  dithering, build flags, resolution/scale/refresh, and
  exact run commands. No raw profiling dumps in the product repository.
- Ideal and real-hash reference checks, quantization-aware shape gates, and
  same-scale comparisons; actual user observations versus the preregistered
  low-amplitude visibility prediction.
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
