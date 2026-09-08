# Glass noise Dulling spike results

**Date:** 2026-09-07
**Status:** prototype and distribution checks passed; hardware GPU preflight verified.
User screenshot preferences are recorded at 0.06. Repeated desktop performance
comparison and live visual acceptance remain unresolved. Task `prism-ba5f59`
remains in progress.
**Design:** [approved experiment](../specs/2026-09-07-glass-noise-dulling-spike-design.md).

## Current conclusion

Achromatic Dulling is mechanically feasible in the existing material shader. Both
strength policies produce the expected distribution on the tested software GLES
renderer. Matched RMS preserves useful numerical strength at amount 0.02 as Dulling
rises; GIMP-style strength decreases substantially. At 0.06 the user preferred
matched-RMS h=2 over fine on both warm and dark backgrounds, then preferred the
softer GIMP-style h=2 over matched-RMS h=2 on warm and bright backgrounds. This
supports **Dulling h=2 as the primary candidate for hardware cost and live visual
checks**, with amplitude semantics still open. It does not establish desktop GPU
cost or justify a production control yet.

No production code, Prism definition, installed compositor, or live settings were
changed. HSV, CIE LCh, and spatial grain sizing remain deferred: there is no user
observation yet that justifies a second variation. No shipping task has been filed.

The user chose to retain 0.02 for this comparison and reports approximately
0.05–0.06 as the subjective sweet spot for subtle but present white/fine noise.
The user subsequently found the 0.02 comparison barely perceptible and insufficient
to judge differences, and requested 0.06. That is an observation about this
screenshot comparison, not proof that Dulling is invisible on the live desktop.

## Reproducible prototype and evidence

Local evidence root: `/mnt/ssd3/tmp/prism-dulling-spike`, called `$SPIKE` below.
Keep this directory: raw evidence and the throwaway native clone are intentionally
outside the product repository.

- Native base: `691a13206bb090b2d434a84806564105ef23da76`.
- Throwaway clone: `$SPIKE/native`, branch `spike/glass-dulling`.
- Prototype commit: `56f368bb`; frozen practical-input driver: `ab59fe53`.
- Repeated benchmark drivers/checks: `17dfe00a`; `benchmark-driver.patch` and
  `benchmark-provenance.json` preserve this later script-only change and hashes.
  The native binaries and original prototype patch above remain unchanged.
- Both binaries were built with `cargo build --release --features profile-with-tracy`
  using separate target directories. The prototype reports
  `niri 26.04 (691a1320-modified)` because it was built before the prototype commit.
- Baseline binary SHA-256:
  `8d280251736a0f24de1a2869545a501a4c28796b1da1ca7e32916fe2326c70d2`.
- Prototype binary SHA-256:
  `f25a36cb5f5e936af46069348717fb02eaa7846cf2f1161da113c300155c9107`.
- `prototype.patch` SHA-256:
  `5de0940424852451c09568853cdd0c9707a47b622f78a510291c70f2008b66dc`.
  `provenance.json` also records the full native HEAD, script hashes, NumPy 2.5.3,
  and Pillow 12.3.0.

The prototype adds the runtime `mat_noise_dulling` uniform and validates
`NIRI_MATERIAL_SPIKE_DULLING` as an integer 1–8 before compositor startup. Default
is 2. Only the throwaway binary uses the native `lightness` dispatch slot for
Dulling. White/fine retain their formulas, and `fineGrain` executes only in the
fine branch. Artifacts use Dulling names; KDL necessarily records the reused slot.

The frozen salt schedule and float32 hash port are in
`native/docs/materials/scripts/glass-dulling-reference.py`. Sibling scripts
`glass-dulling-spike.py`, `glass-dulling-matrix.py`, and
`glass-dulling-analyze.py` own fixture execution, matrices, and shape gates.
Each case retains KDL, input image, binary hash/version, window/output metadata,
logs, and two screenshots. Each invocation owns an isolated compositor/runtime
directory and cleans up its child processes.

## Environment and measurement scope

The renderer was **llvmpipe (LLVM 22.1.8, 256 bits)**, Mesa 26.2.2-arch1.1,
OpenGL ES 3.2, nested under Weston 15.0.1 with its headless GL backend.
The fixture output was 1280×720, scale 1, advertised 60 Hz. This execution
environment has no accessible hardware render device; these are real material
shader executions on a software renderer, not desktop GPU evidence.

The first material draw reports framebuffer RGBA bits **10/10/10/2**. Niri's
screenshot path separately renders into **Abgr8888** (`src/niri.rs`,
`capture_screenshots`), yielding 8-bit PNG channels. The experiment explicitly
disables `GL_DITHER` in the niri renderer; logs show prior state 1 and first-draw
state 0, GL error 0. Weston's outer dithering was not established. These screenshots
come from niri's capture path and do not measure final physical output precision
or dithering. Do not equate the live framebuffer with the screenshot target.

Static captures use a transparent, text-free kitty pane and frozen quiet optics.
The timing preflight uses full-pane alternating text at 10 Hz; screenshots are
outside its timing interval. Live Prism edits cannot change these frozen inputs.

## Distribution and stability results

All 16 independent-uniform/real-hash reference rows passed the preregistered
mean, sign-share, MAD, variance, and CDF checks across both grid origins and
h=1/2/4/8 (`reference.json`). This screens the chosen salts for correlation; it
does not prove statistical independence or cross-driver floating-point hash equivalence.

All eight rendered Dulling diagnostic cases passed the quantization-bracketed
shape and RMS gates in all three channels. The diagnostic matrix has 14 captures,
including off/white/fine controls for each policy. Selected red-channel results:

| Policy and logical amount | h | RMS | Below a/4 | Top band [0.4a, 0.5a] | Beyond a/2 |
| --- | ---: | ---: | ---: | ---: | ---: |
| GIMP, 0.5 | 1 | 0.14419 | 0.49326 | 0.19286 | 0.00500 |
| GIMP, 0.5 | 2 | 0.10146 | 0.74704 | 0.03836 | 0.00006 |
| GIMP, 0.5 | 4 | 0.06380 | 0.93668 | 0.00138 | 0 |
| GIMP, 0.5 | 8 | 0.03686 | 0.99594 | 0 | 0 |
| Matched RMS, 0.25 | 1 | 0.07211 | 0.48565 | 0.18584 | 0.01190 |
| Matched RMS, 0.25 | 2 | 0.07174 | 0.57394 | 0.09769 | 0.08870 |
| Matched RMS, 0.25 | 4 | 0.07131 | 0.63141 | 0.07014 | 0.09400 |
| Matched RMS, 0.25 | 8 | 0.07129 | 0.66456 | 0.06154 | 0.09073 |

RMS uses encoded channel units 0–1. Shares include the documented quantization
tolerance; small apparent excursions beyond ideal support are not a shader
support violation. The eight diagnostic ROIs had no clipped channels.
Full CDF bounds and all channels are retained in `diagnostic/*/shape.json`.

Two negative controls matter: white presented as GIMP h=2 fails, and white
presented as matched-RMS h=2 passes the RMS check but fails the shape checks
(`white-as-h2-negative.json`, `matched-rms-negative.json`). A deliberately corrupted
copy of the binary's embedded shader is rejected by the capture driver on the
material compile error (`negative-shader-driver.log`). This validates rejection
of the renderer's shader fallback rather than treating an image as success.

The 44 visual cases cover warm, gray, dark, and bright backdrops at 0.02, each with
off/white/fine and both policies at h=1/2/4/8. Warm-background red-channel figures
illustrate the low-amplitude effect:

| Variant | RMS in 8-bit levels | Unchanged share |
| --- | ---: | ---: |
| White | 1.574 | 0.197 |
| Fine | 1.553 | 0.210 |
| GIMP h=2 | 1.144 | 0.332 |
| GIMP h=4 | 0.813 | 0.495 |
| GIMP h=8 | 0.617 | 0.634 |
| Matched RMS h=2 | 1.542 | 0.247 |
| Matched RMS h=4 | 1.533 | 0.286 |
| Matched RMS h=8 | 1.532 | 0.310 |

GIMP h=8 is sub-LSB but does not become identical to noise-off: unchanged shares
range approximately 55–83% across the four backgrounds/channels. Baseline code
phase affects both channel RMS and mean; the maximum absolute channel mean
change across these cases is 0.471 LSB. No clipping occurred in the sampled
visual ROIs. This is not a perceptual color-fidelity or visibility verdict.
`visual-summary.json` contains every channel and scene.

All **65 static capture/repeat pairs were pixel-identical**: 14 diagnostic,
44 visual, and seven practical snapshot cases (`static-repeat-check.json`).
Motion/refocus stability and multi-pane visibility remain untested.

The seven additional practical cases froze the user's wallpaper and material
settings while they were experimenting, including noise 0.84. They are explicitly
a **temporary snapshot**, not a normal preference or acceptance set. At that
amount, matched-RMS h=2/4/8 exceeds the native written-amount limit; generated
configs were rejected, with no clamping (`unsupported-rms.json`).

`comparison.html` provides six randomized A/B pairs at 0.02, names hidden until
revealed, with original-pixel crops and optional nearest-neighbor zoom. The page's
12 canvases, reveal button, and zoom were checked in Chromium. The user's 0.02
observation is recorded above; live nested-window visual observations remain
unresolved.

The requested **0.06** follow-up is `comparison-006.html`, generated by
`make-comparison-006.py`. `run-comparison-006.py` re-renders the same six pairs
with unchanged scenes/crops and a fresh A/B ordering; the original 0.02 page is
preserved. `visual-006/` contains 12 cases: nine distinct comparison images and
three noise-off controls. All 12 repeats are pixel-identical, and all seven
Dulling cases pass the RGB shape gates (`checks.json`). These follow-up captures
use the same software renderer and 8-bit screenshot path as the first visual set;
the hardware preflight below is a separate workload.

The user reported the following favorites at 0.06. The frozen key and verbatim
choice/alternative ratings are retained in `comparison-006-key.json` and
`comparison-006-preferences.json`.

| Pair | Scene | Favorite | Other image | User's qualification |
| --- | --- | --- | --- | --- |
| 1 | Warm | A: matched-RMS h=2 | Fine | — |
| 2 | Warm | B: GIMP h=2 | Matched-RMS h=2 | — |
| 3 | Warm | B: GIMP h=8 | GIMP h=2 | A also good |
| 4 | Warm | B: matched-RMS h=2 | Matched-RMS h=8 | A also good |
| 5 | Dark | A: matched-RMS h=2 | Fine | — |
| 6 | Bright | A: GIMP h=2 | Matched-RMS h=2 | B also good |

These are one user's pairwise screenshot preferences, not a general ranking.
The two fine comparisons favor Dulling at approximately matched RMS. Comparisons
between strength policies also change RMS: at the same logical amount, GIMP h=2
has about 71% of matched-RMS strength. Likewise GIMP h=8 has about 37% of GIMP
h=2's RMS. Thus the h=8 win in pair 3 could reflect a preference for weaker grain;
it does not isolate distribution shape. Matched-RMS h=2 winning pair 4 supports
keeping h=2 as the first candidate, with h=8 retained as an exploratory endpoint.
An amount-adjusted comparison and live viewing can resolve the remaining strength
versus distribution question. No colored-grain experiment is indicated by these
responses.

## Performance evidence and remaining work

The user ran `hardware-preflight/` successfully on **NVIDIA GeForce RTX 3070**,
OpenGL ES 3.2, NVIDIA driver **610.57.04**, using the prototype's white mode at
0.02 with one pane. The trace contains **202** valid material draw samples in
[20s, 40s): median **0.032768 ms**, p95 **0.036864 ms** (`timing.json`). This
establishes hardware instrumentation, not a Dulling cost result. The actual nested
output was **1651×1297, scale 1, advertised 60 Hz**, despite requesting 1280×720
from Weston; use recorded geometry when comparing subsequent runs. The first
material framebuffer was **8/8/8/8**, GL dithering disabled, GL error zero.
Keep these hardware results separate from the software preflight below.

The unmodified baseline instrumentation preflight exported 215
`MaterialRenderElement::draw` samples in [20s, 40s), using Tracy 0.13.1 and a
45-second capture. Its llvmpipe median was 5.169332 ms and p95 6.425267 ms.
This is one instrumentation preflight, **not a variant cost comparison**.
The initial driver reported failure after capturing because of a quit-IPC EOF
race; acknowledged clean compositor shutdown is now handled. Raw trace and CSV
remain in `baseline-preflight/`.

The predicted Dulling hash count is h+1: h=2 uses three hashes, h=8 nine, equal
to fine's nine. This prediction is not a measured cost. No repeated hardware
matrix, baseline variation, variant delta, or refresh-budget conclusion exists.
The prepared `gpu` matrix now runs at logical amount **0.06**, with ten variants,
one/three panes, and three repetitions in normal/reversed/rotated order: 60 cases.
It includes unmodified white/fine, prototype off/white/fine, GIMP h=1/2/4/8, and
matched-RMS h=2 (written amount about 0.08485). The renderer identity must match
the requested GPU. Geometry checks require the requested size/scale, all panes
fully visible, and unchanged geometry before/after capture and between variants.
Weston runs without personal configuration or idle sleep. Load averages are saved
before/after each run as context, not as GPU-load measurements.

`geometry-three-pane/` verified the headless 1280×720 layout on software GLES:
three 358×680 panes at x=20/398/776, y=20. The user's subsequent
`hardware-headless-check/` confirmed RTX 3070 / NVIDIA 610.57.04 on the headless
backend at 1280×720, scale 1, with three 358×680 panes; the saved capture shows
all three fully visible. Its first material framebuffer is 8/8/8/8 with dithering
disabled and GL error zero. This was a static renderer/geometry check, not a GPU
timing run. The shortlist still needs a run at the actual desktop output
dimensions/scale and live visual acceptance.

`geometry-three-pane-gpu/` additionally exercised the timed workload on software
GLES: 1,683 valid material draw spans in [20s, 40s), stable geometry, and a capture
showing text damage across all three panes with transparent material between
glyphs. Per-client 10 Hz damage can cause other visible panes to redraw too;
these are per-material-draw samples, not independent frame samples or 10 Hz
whole-compositor timing. This check validates instrumentation/coverage only.

`results.json` retains per-run sample counts, medians and p95. `summary.json`
reports median-of-medians, ranges of run medians/p95 and absolute/percentage deltas
against both prototype and unmodified white/fine. The new benchmark tests verify
hidden-pane/resize rejection, normalization limits, baseline binary selection,
60-case orchestration, timestamp filtering, and the summary arithmetic with
synthetic traces. They do not substitute for hardware captures.

Native `just test` passed 401 tests. The updated `just check` passed, including 67 tooling
tests and task validation with zero errors/warnings. Compiler output retains
existing Clippy/unused-import warnings and stable-rustfmt warnings about nightly
options. These gates do not execute GLSL; the captures and negative shader check
provide that evidence. The old noise smoke's lightness-specific assertions were
not used to validate the reused Dulling slot.

## Re-run commands and possible production path

From the evidence root, with fresh output directory names:

```sh
SPIKE="$PWD"
SCRIPTS="$SPIKE/native/docs/materials/scripts"
python3 "$SCRIPTS/glass-dulling-reference.py"
python3 "$SCRIPTS/glass-dulling-matrix.py" diagnostic --impl "$SPIKE/niri-prototype" --out "$SPIKE/diagnostic-new"
python3 "$SCRIPTS/glass-dulling-matrix.py" visual --impl "$SPIKE/niri-prototype" --out "$SPIKE/visual-new"
```

Hardware preflight, from a desktop terminal with the matching Tracy tools directory
assigned to `TRACY_TOOLS`:

```sh
python3 "$SCRIPTS/glass-dulling-spike.py" --impl "$SPIKE/niri-prototype" --out "$SPIKE/hardware-preflight" --visible --gpu --wall checker --tracy-tools "$TRACY_TOOLS"
```

The prepared hardware command is `sh "$SPIKE/run-hardware-matrix.sh"`. It uses
the headless backend to keep geometry fixed, requires the RTX 3070 renderer, and
runs 60 cases at 0.06 into `hardware-matrix-006/`; allow roughly an hour. The
headless hardware preflight has passed. The full case list can be reviewed using
`glass-dulling-matrix.py gpu --dry-run` with the same arguments, without starting
any compositor. `hardware-matrix-plan.json` retains that list. Fresh output roots
are required, so reruns cannot silently mix old and new results.

If visible benefit and hardware cost support shipping, a native optional integer
noise property can follow the existing `Noise` → `ResolvedGlass` → render uniform
path. The current noise-type tests already demonstrate layout propagation with
blur enabled/disabled and material commit advancement without replacing element
identity (`niri-config/src/material.rs`, `src/layout/tile.rs`,
`src/render_helpers/material.rs`). Add equivalent default/range and damage tests
for Dulling. Prism can expose a shared integer slider beside its shared type
select and render the native property; its existing slider and fragment tests
provide the pattern. The spike's process-global environment variable does not
exercise live parameter updates.

For production matched RMS, calculate support from logical amount inside the
shader instead of shipping the written-amount workaround. The workaround caps
logical amount at `sqrt(6/((h+1)(h+2)))`; this limit is not a fundamental obstacle
to a new native interface. Larger support still needs explicit clipping semantics.
Keep grain size separate. Retain h=1–8 for exploration; a useful shipping range
and default remain contingent on the user's comparison and hardware results.
