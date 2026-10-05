# Pipeline interactions

The interaction matrix of `docs/specs/2026-10-04-pipeline-schema-design.md`
Section 4, for today's pipeline. The structural block between the markers
is generated from `defs/rack/pipeline.json` and `integrations/niri/dry.yaml`
by `test/pipeline-interactions.test.js`; regenerate it with
`PRISM_DOCS_UPDATE=1 just test-fast`. The blocks outside the markers are
written by hand.

## Structural cells

<!-- interactions:begin -->
| Device | Depends on | Kind | Source | Mechanism | Decision |
| --- | --- | --- | --- | --- | --- |
| Backdrop | Refraction | attenuates | schema | the prefilter level is roughness * clamp(ior * 2 - 2, 0, 1), so ior 1 flattens Blur while frosted backdrop still selects the blurred source | expose |
| Fringing | Refraction | requires | dry | the glass.bypass.refraction dry entry writes chromatic-aberration | expose |
| Directional blur | Refraction | requires | dry | the glass.bypass.refraction dry entry writes anisotropic-blur | expose |
<!-- interactions:end -->

## Conditional dependencies

Not edges: each holds only under a condition, so it is described here and
never encoded.

| Device | Depends on | Condition | Mechanism |
| --- | --- | --- | --- |
| Directional blur | Refraction | chromatic aberration is 0 | at ior 1 the depth-jittered taps sample one point, so there is nothing to smear; with aberration above zero the green and blue taps keep raised indices and still smear |

## Perceptual cells

None recorded. Capture evidence under niri-material's `docs/materials/`
lands here with the document that measured it.
