# Frozen warm-comparison results

Run `1791731787`; collection window **80.405 seconds**.
Figures are Luau `os.clock()` elapsed milliseconds, upper bounds on thread CPU.
**Diagnostic only; no acceptance decision or CPU-cause claim.** Frozen log budget
error lines: **0**. Five warmButton and five warmFrame callbacks were captured.
Every callback has exactly one total/native render span and all three coarse
phase spans in order. No unmatched warm callbacks.

## Pair validity

Four pairs have no logged intervening describe/write/launch/render/key/open work:
**74→75**, **78→79**, **86→87**, **90→91**. These are strict unchanged-input
candidates, not a live state-equality proof. Pair **82→84** has intervening describe
callback **83 (0.010 ms)** and is conservatively excluded from strict aggregates.
That fast describe may be a no-op; its elapsed time alone cannot prove it. All raw
callback samples remain available separately. Exclusion is not a user or probe
failure attribution.

## Per-pair total/native results

| Pair | Callback | Strict candidate | Callback ms | Total ms | Native ms | Residual ms |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| 1 | warmButton 74 | yes | 8.654 | 8.629 | 2.158 | 6.471 |
| 1 | warmFrame 75 | yes | 8.712 | 8.693 | 1.926 | 6.767 |
| 2 | warmButton 78 | yes | 9.052 | 9.037 | 2.019 | 7.018 |
| 2 | warmFrame 79 | yes | 6.945 | 6.929 | 1.714 | 5.215 |
| 3 | warmButton 82 | excluded | 8.405 | 8.388 | 2.299 | 6.089 |
| 3 | warmFrame 84 | excluded | 8.124 | 8.105 | 2.079 | 6.026 |
| 4 | warmButton 86 | yes | 8.522 | 8.504 | 1.820 | 6.684 |
| 4 | warmFrame 87 | yes | 8.408 | 8.392 | 1.696 | 6.696 |
| 5 | warmButton 90 | yes | 5.551 | 5.542 | 1.270 | 4.272 |
| 5 | warmFrame 91 | yes | 7.345 | 7.330 | 1.606 | 5.724 |

Residual is total minus native **within each callback**.

| Pair | Callback | Top ms | Presentation ms | Assembly ms | Render gap ms | Callback gap ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | warmButton 74 | 1.995 | 0.418 | 4.032 | 0.026 | 0.025 |
| 1 | warmFrame 75 | 2.042 | 0.419 | 4.281 | 0.025 | 0.019 |
| 2 | warmButton 78 | 2.502 | 0.466 | 4.030 | 0.020 | 0.015 |
| 2 | warmFrame 79 | 1.756 | 0.385 | 3.056 | 0.018 | 0.016 |
| 3 | warmButton 82 | 2.075 | 0.439 | 3.553 | 0.022 | 0.017 |
| 3 | warmFrame 84 | 2.018 | 0.421 | 3.566 | 0.021 | 0.019 |
| 4 | warmButton 86 | 2.035 | 0.432 | 4.188 | 0.029 | 0.018 |
| 4 | warmFrame 87 | 1.920 | 0.401 | 4.349 | 0.026 | 0.016 |
| 5 | warmButton 90 | 1.212 | 0.404 | 2.642 | 0.014 | 0.009 |
| 5 | warmFrame 91 | 1.961 | 0.425 | 3.316 | 0.022 | 0.015 |

Top covers root/header/profile/edit construction; presentation covers gates,
swatches and rack state; assembly includes sections/cards/signatures/focus and
final root construction. Render gap = total minus the three phases and native
**in that same sample**. Callback gap = outer callback minus its total render.
Gaps include instrumentation/bookkeeping between intervals and rounded-clock
precision; they are not uniquely assigned to CPU, GC or scheduling.

## Distributions: median / maximum, milliseconds

| Metric | All button n5 | All frame n5 | Strict button n4 | Strict frame n4 |
| --- | ---: | ---: | ---: | ---: |
| callback | 8.5220 / 9.052 | 8.1240 / 8.712 | 8.5880 / 9.052 | 7.8765 / 8.712 |
| total | 8.5040 / 9.037 | 8.1050 / 8.693 | 8.5665 / 9.037 | 7.8610 / 8.693 |
| top | 2.0350 / 2.502 | 1.9610 / 2.042 | 2.0150 / 2.502 | 1.9405 / 2.042 |
| presentation | 0.4320 / 0.466 | 0.4190 / 0.425 | 0.4250 / 0.466 | 0.4100 / 0.425 |
| assembly | 4.0300 / 4.188 | 3.5660 / 4.349 | 4.0310 / 4.188 | 3.7985 / 4.349 |
| native | 2.0190 / 2.299 | 1.7140 / 2.079 | 1.9195 / 2.158 | 1.7050 / 1.926 |
| residual | 6.4710 / 7.018 | 6.0260 / 6.767 | 6.5775 / 7.018 | 6.2100 / 6.767 |
| render_gap | 0.0220 / 0.029 | 0.0220 / 0.026 | 0.0230 / 0.029 | 0.0235 / 0.026 |
| callback_gap | 0.0170 / 0.025 | 0.0160 / 0.019 | 0.0165 / 0.025 | 0.0160 / 0.019 |

Each median is computed from its own actual sample list. Phase medians are never
summed or subtracted to invent a total/residual. Full values are retained in JSON.

## Paired frame-minus-button differences

| Strict pair | Callback difference ms | Total difference ms | Native difference ms | Residual difference ms |
| --- | ---: | ---: | ---: | ---: |
| 74→75 | 0.058 | 0.064 | -0.232 | 0.296 |
| 78→79 | -2.107 | -2.108 | -0.305 | -1.803 |
| 86→87 | -0.114 | -0.112 | -0.124 | 0.012 |
| 90→91 | 1.794 | 1.788 | 0.336 | 1.452 |

| Paired metric | n | Median difference ms | Maximum difference ms |
| --- | ---: | ---: | ---: |
| callback | 4 | -0.0280 | 1.794 |
| total | 4 | -0.0240 | 1.788 |
| top | 4 | -0.0340 | 0.749 |
| presentation | 4 | -0.0150 | 0.021 |
| assembly | 4 | 0.2050 | 0.674 |
| native | 4 | -0.1780 | 0.336 |
| residual | 4 | 0.1540 | 1.452 |
| render_gap | 4 | -0.0015 | 0.008 |
| callback_gap | 4 | -0.0005 | 0.006 |

Positive means the frame took longer. Strict callback differences are
**+0.058, −2.107, −0.114, +1.794 ms**; median **−0.028 ms**. Two frames were
faster and two slower. This sample does **not show a consistent ordinary-button
callback penalty** for unchanged warm rendering. It does not prove callback
context never matters, or isolate the earlier release-specific slow path.
Button/frame order is fixed; context and temporal order are confounded.

Assembly is the largest nonnative coarse interval in these warm samples, but
neither interval duration nor residual identifies a unique CPU, allocation/GC,
scheduling or vendor cause. Native spans also vary between matching contexts.
No host/vendor defect, replacement algorithm, production fix or design revision
is inferred. This pair exercise does not include final-release enqueue, native
pointer-release handling, changed describe or cold construction.

## Guarantees and live limitations

No memo tracing exists in this probe. Source review and standalone fake-host
self-check guarantee that its button performs ordinary unchanged rendering,
requests exactly the existing one-pending-frame path, and intrinsically performs
no write, launch, fake describe or model-value edit. The self-check also preserved
memo node/signature identity. Those are source/fake-host guarantees, not measured
live state hashes. Periodic refresh and independent live changes remain possible;
even strict pairs mean only no recorded interfering callback between them.
Added button, phase clocks, helpers/buffers and after-timing logs remain observer
overhead. Log writes remain inside host callback budget and may affect subsequent
frame conditions. Logged completion spacing in JSON is timestamp spacing, not a
separate scheduler or execution-latency measurement.

## Verification and restoration

Parser representative asserts cover ordered/exact spans, strict pairing,
interference including callback0, residual/gaps, stats, unmatched callbacks and
malformed input. Independent regex extraction reproduced all raw primary samples,
checked all ten callback span sets and within-sample derived values, recalculated
every aggregate and confirmed the excluded describe-interrupted pair. All checks
passed. Only frozen scratch files were read; no live host log was opened.

The controller reports original main pointer restored/plugin reloaded; original
active profile, exact scratch, all **23 profile document bytes** and all canonical
values verified, with nothing running. This worker performed no host, production,
spec or task mutations, new probe, suite execution, subagent dispatch or background
process. Analysis is complete.

## Artifacts

Scratch: `/tmp/prism-budget-warm-comparison-n3_7du6c/` containing
`diagnostic.log`, `run-state.json`, `analyze-warm.py`, `warm-results.json`,
`warm-results-report.md` and `warm-analysis-verification.txt`.

```sh
python3 /tmp/prism-budget-warm-comparison-n3_7du6c/analyze-warm.py --self-check
python3 /tmp/prism-budget-warm-comparison-n3_7du6c/analyze-warm.py /tmp/prism-budget-warm-comparison-n3_7du6c/diagnostic.log --output /tmp/prism-budget-warm-comparison-n3_7du6c/warm-results.json
```
