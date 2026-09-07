# Material glass noise versus GIMP/GEGL CIE LCh and HSV

Research snapshot: 2026-09-07 (US/Eastern). Proven source behavior and inferred
design recommendations are separated below. Comparison task: `prism-fb0f3e`.
Prism retained `white` and `fine` after desktop acceptance; the native shader
still supports `lightness`. No GIMP-derived shader or size control was implemented.

## Sources and versions

The local `niri-material` checkout was clean at
`691a13206bb090b2d434a84806564105ef23da76`; the noise implementation is commit
`098bcdcab2c16a1c92a69e6a07f8fe52cbe8637c`. Inspected files:

- `niri-material/src/render_helpers/shaders/material.frag`
  (`hash12`/`fineGrain` at 216–233, application at 576–590)
- `niri-material/docs/specs/2026-09-06-material-glass-noise-type-design.md`

GEGL `master` was observed at
[`ccdec52d4d98ae79106a5cbe032cff9a83467116`](https://github.com/GNOME/gegl/commit/ccdec52d4d98ae79106a5cbe032cff9a83467116)
(2026-09-07; `meson.build` version 0.4.73). The files were fetched and read from
the raw forms of these commit-pinned GNOME GitHub mirror links:

- [`noise-cie-lch.c`](https://github.com/GNOME/gegl/blob/ccdec52d4d98ae79106a5cbe032cff9a83467116/operations/common/noise-cie-lch.c)
- [`noise-hsv.c`](https://github.com/GNOME/gegl/blob/ccdec52d4d98ae79106a5cbe032cff9a83467116/operations/common/noise-hsv.c)
- [`gegl-random.h`](https://github.com/GNOME/gegl/blob/ccdec52d4d98ae79106a5cbe032cff9a83467116/gegl/gegl-random.h)
- [`gegl-random.c`](https://github.com/GNOME/gegl/blob/ccdec52d4d98ae79106a5cbe032cff9a83467116/gegl/gegl-random.c)

Official current manuals, observed 2026-09-07: [GIMP 3.0 CIE LCh
Noise](https://docs.gimp.org/3.0/en/gimp-filter-noise-cie-lch.html) and [GIMP
3.0 HSV Noise](https://docs.gimp.org/3.0/en/gimp-filter-noise-hsv.html).

## Proven behavior

### The common GEGL distribution

Both filters use the same `randomize_value()` logic for each enabled component
and pixel. For distance `A` and Dulling/holdness `h`:

```text
R = min(U1, ..., Uh), Ui uniform on [0,1)
S = an independent equiprobable -1 or +1
delta = S A R, followed by the component's boundary rule
```

Before boundary handling, the continuous idealization is:

```text
f_delta(d) = h/(2A) (1-|d|/A)^(h-1), |d| <= A
E|delta| = A/(h+1)
RMS(delta) = A sqrt(2/((h+1)(h+2))).
```

Thus `h=1` is uniform, the default `h=2` is exactly triangular and centered at
zero, and increasing `h` produces more weak changes and fewer strong changes.
GEGL does not RMS-normalize: higher dulling also lowers strength for fixed `A`.

Dulling is a marginal-distribution control, not spatial grain size. These are
point filters and sample no neighbors. GEGL's random API is deterministic from
seed and `(x,y,z,n)`; each coordinate has its own sequence. The operations base
channel sequence offsets on whole-image pixel position, so tiled evaluation is
stable. The manuals confirm that the same seed in the same situation reproduces
the same output. The source generator has 16-bit float granularity, so the
formula above models a finely quantized distribution.

### Channel handling and ranges

| Filter | Format and independent channels | Defaults; ranges | Boundaries and neutral pixels |
| --- | --- | --- | --- |
| CIE LCh | babl `CIE LCH(ab) alpha float`, carrying source space; independently randomizes h, C, L; alpha unchanged | dulling 2 (1–8); L 40 (0–100); C 40 (0–100); hue 3° (0–180°); seed | L/C clamp to 0–100; hue wraps (source uses 0–359 with a 359.5 step). Hue is skipped at C=0; enabling chroma noise first assigns neutral pixels random hue. |
| HSV | babl `HSVA float`; independently randomizes H, S, V; alpha unchanged | dulling 2 (1–8); hue 3° (0–180°); S .04 (0–1); V .04 (0–1); seed | S/V clamp to 0–1; H wraps. Hue is skipped at S=0; enabling saturation noise first assigns neutral pixels random hue. |

Clamping creates probability mass at an endpoint and biases output away from an
exceeded boundary. Hue wraps. The `fmod` inside `randomize_value()` has no effect
within the declared distances because `R<1`; boundary handling does the work.

CIE-LCh L-only keeps C and h (therefore Lab a* and b*) fixed before output gamut
handling. Material Oklab-lightness similarly holds Oklab a/b, but uses hardwired
linear-sRGB Oklab matrices and L near 0–1 rather than source-space-aware CIELAB
L* at 0–100. They have different lightness contours and gamut behavior, yet
both isolate a perceptual-lightness-like axis; similar appearance at small
amplitude is unsurprising. Default GIMP CIE LCh is not L-only: C=40 and hue=3°
provide independent chromatic variation.

HSV V-only holds HSV H and S. For nonblack RGB this generally scales components
together, unlike material's equal additive encoded-sRGB increment. HSV V is not
a perceptually uniform lightness. Full HSV gets its distinctive color grit from
the independently randomized H and S channels.

One manual/source mismatch: the GIMP HSV manual says S and V "increase", but
GEGL chooses a positive or negative sign equally before clamping, so they can
decrease too.

### Current material comparison

| Mode | Marginal and channels | Spatial behavior | Cost |
| --- | --- | --- | --- |
| `white` | `a(U-.5)`, support `[-a/2,a/2)`, SD `a/sqrt(12)`; one scalar added equally to encoded sRGB | One hash per device pixel, white-like | 1 hash |
| `fine` | `a sqrt(8/9)(U0-mean8)`, support about `±.9428a`, SD matched to white; one scalar added equally to encoded sRGB | Fixed 3x3 high-pass | 9 hashes |
| `lightness` | Same `fine` field applied to Oklab L | Same fixed high-pass | 9 hashes plus two color conversions |

All use `gl_FragCoord.xy + vec2(47,113)`: deterministic, frame-static,
framebuffer-anchored, and without a user seed. `white`/`fine` do not immediately
clamp their encoded-sRGB result; `lightness` clamps around its conversion.

`fine` has kernel `1` at center and `-1/8` at each of eight neighbors, scaled by
`sqrt(8/9)`. Its frequency response is

```text
H(wx,wy)=1-[cos(wx)+cos(wy)+2cos(wx)cos(wy)]/4, so H(0,0)=0.
```

That explicit high-pass spectrum is unlike GEGL dulling, which does not couple
pixels. The native "bell-shaped" description is too strong. `Var(U0)=1/12` and
`Var(mean8)=1/96`, so the center uniform supplies 8/9 of `fine`'s variance. The
density has a broad, nearly flat center with tapered tails, not a Gaussian-like
bell. Its zero mean, matched variance, and high-pass claim remain sound.

Equal encoded-sRGB addition is an achromatic increment, but does not preserve
colorfulness: adding gray changes RGB ratios except on neutral pixels. GIMP's
default filters instead use independent component noise.

## Grain-size feasibility: proven distinction

Neither GIMP filter has spatial size control. Material `fine` uses a fixed
one-device-pixel neighborhood. Statistical concentration (Dulling) and spatial
correlation length (grain size) are independent properties.

`hash12(p/size)` is not controlled coarse noise: `hash12` is a discontinuous
mapping, so dividing continuous input changes sampled values without defining a
predictable correlation length. `hash12(floor(p/size))` creates correlation but
as obvious square blocks.

A smooth explicit size requires a random lattice and interpolation: compute
`q=(gl_FragCoord.xy-.5+seed)/size`, hash its four integer corners, and bilinearly
interpolate with `w=f*f*(3-2*f)`. This costs four hashes; center and RMS-calibrate
the result if `amount` must retain its meaning. `size>1` yields soft, correlated
grains and restores low-frequency energy, so it is a different/coarser look,
not a scaled version of `fine`. Stable subpixel grains need supersampling or a
prefiltered texture.

Worley/cellular noise is another distinct look: random feature points and
distance-to-nearest evaluation, conventionally over a 3x3 cell neighborhood.
It is realtime-feasible but costs feature hashes plus roughly nine distance/min
operations and produces recognizable cells/ridges/spots. It has no connection
to the GIMP algorithms.

## Inferred GLSL options and recommendation (not benchmarked)

| Candidate | Random work per fragment | Added character | Assessment |
| --- | ---: | --- | --- |
| Shared GIMP-style dulling scalar | `h+1` hashes; 3 at default h=2 | Triangular/zero-centered speckle amplitudes, same white spatial spectrum | Cheapest faithful GIMP trait; less harsh but does not solve spatial clumps |
| HSV value only | `h+1` hashes plus RGB↔HSV | Content-dependent brightness grain preserving HSV H/S | Likely repeats the lightness-only redundancy |
| Full HSV | `3(h+1)` hashes; 9 at h=2, plus RGB↔HSV | Independent hue/saturation/value flecks | Best cost-to-distinctiveness GIMP match |
| CIE-LCh L only | `h+1` hashes plus RGB↔XYZ↔Lab | CIELAB lightness grain | Feasible, low expected value after Oklab L looked similar |
| Full CIE LCh | `3(h+1)` plus RGB↔XYZ↔Lab↔LCh/angle work | Independent perceptual cylindrical components | Feasible but highest complexity; require a visible win over HSV |
| Bilinear lattice size | 4 hashes plus interpolation | Explicit soft/coarse correlation scale | Cheap separate mode, not GIMP fidelity |

Neutral pixels skip hue perturbation and instead use one random draw to assign
hue when chroma/saturation noise is enabled, as described above.

A fixed maximum-eight GLSL loop can implement dulling on GLES. Exact GEGL
pseudorandom bit parity would require its lookup-table generator and adds no
visual value; independent `hash12` salts are enough. A configurable seed changes
only the pattern instance, not distribution or spectrum, so keep the current
fixed seed unless users need reproducible variants.

If dulling settings should preserve material strength, match white's SD by using
`A_h = a sqrt((h+1)(h+2)/24)`. Then `h=1` gives `A=a/2` (the current white
distribution), while `h=2` gives `A=a/sqrt(2)`. GEGL itself does not normalize.

Dropping `lightness` is supported: LCh-L, HSV-V, and Oklab-L differ technically,
but remain scalar brightness grain. If one GIMP-inspired experiment is wanted,
start with full HSV at dulling 2 and small independent H/S/V distances; it adds
both missing GIMP traits, triangular amplitudes and chromatic variation, at less
conversion cost than CIE LCh. If the material must stay achromatic, test only a
shared dulling-2 scalar in the existing encoded-sRGB branch (three hashes).

Keep spatial size separate from dulling. Add the four-corner interpolated mode
only for an explicitly desired soft/coarse granule. Reserve Worley for an
explicitly cellular motif.
