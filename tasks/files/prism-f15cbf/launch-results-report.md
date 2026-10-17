# Frozen read-only launch comparison

Run `1791733401`, frozen collection 95.463 seconds. **Diagnostic only.**
Five valid comparisons: five launchButton, five warmWhileCommand, five successful
comparisonCompletion, zero warmAfterCommand. No budget/error-level lines. All ten
renders have one native/total and all three coarse phases in source/log order.
Metadata validates positive callback/comparison ids, identical model reference/
enqueue counter and expected inFlight transitions throughout. No interfering
describe/write/foreign launch/render appeared before any paired frame.

**The read-only launch did not reproduce slow release/write-completion rendering.**
RenderTotal median/max was **7.823 / 9.824 ms before launch**, versus
**6.788 / 7.669 ms while completion was pending**. Four paired frame renders were
faster and one 0.150 ms slower. This does not establish that launch improves render
or rule out actual write/apply, release-event or other context-dependent effects.

## Per-pair render durations (milliseconds)

Each slash-separated cell is **before / callback-pending frame**; completion
spacing is from logged launch-completion timestamps, not process lifetime.

| Comparison | Callbacks before/frame/complete | Total | Native | Residual | Frame−before total | Logged launch→completion ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 64/65/66 | 7.519 / 7.669 | 2.274 / 2.294 | 5.245 / 5.375 | 0.150 | 270 |
| 2 | 68/69/71 | 7.823 / 6.788 | 2.512 / 1.853 | 5.311 / 4.935 | -1.035 | 256 |
| 3 | 74/75/76 | 6.279 / 5.585 | 1.570 / 1.941 | 4.709 / 3.644 | -0.694 | 321 |
| 4 | 79/80/81 | 9.494 / 5.515 | 2.133 / 1.701 | 7.361 / 3.814 | -3.979 | 194 |
| 5 | 84/85/87 | 9.824 / 7.502 | 3.431 / 2.098 | 6.393 / 5.404 | -2.322 | 211 |

| Comparison | Top | Presentation | Assembly | Render gap | Span gap |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 1.311 / 1.911 | 0.390 / 0.373 | 3.515 / 3.067 | 0.029 / 0.024 | 0.008 / 0.020 |
| 2 | 1.779 / 1.456 | 0.333 / 0.340 | 3.161 / 3.109 | 0.038 / 0.030 | 0.019 / 0.025 |
| 3 | 1.366 / 1.288 | 0.306 / 0.275 | 3.021 / 2.057 | 0.016 / 0.024 | 0.006 / 0.017 |
| 4 | 2.410 / 1.397 | 0.547 / 0.324 | 4.379 / 2.073 | 0.025 / 0.020 | 0.009 / 0.017 |
| 5 | 2.030 / 1.658 | 0.434 / 0.360 | 3.888 / 3.340 | 0.041 / 0.046 | 0.021 / 0.022 |

Residual = total−native; render gap = total−top−presentation−assembly−native;
span gap = warmBeforeLaunch−total before, or warmWhileCommand−total after.
Every subtraction uses the **same callback sample**, not unrelated medians.
Outer launchButton also includes run/metadata/scheduler time and is not render time.

## Median / maximum (n=5 each, milliseconds)

| Metric | Before | Pending frame | Paired frame−before |
| --- | ---: | ---: | ---: |
| total | 7.823 / 9.824 | 6.788 / 7.669 | -1.035 / 0.150 |
| render_span | 7.842 / 9.845 | 6.813 / 7.689 | -1.029 / 0.162 |
| top | 1.779 / 2.410 | 1.456 / 1.911 | -0.323 / 0.600 |
| presentation | 0.390 / 0.547 | 0.340 / 0.373 | -0.031 / 0.007 |
| assembly | 3.515 / 4.379 | 3.067 / 3.340 | -0.548 / -0.052 |
| native | 2.274 / 3.431 | 1.941 / 2.294 | -0.432 / 0.371 |
| residual | 5.311 / 7.361 | 4.935 / 5.404 | -0.989 / 0.130 |
| render_gap | 0.029 / 0.041 | 0.024 / 0.046 | -0.005 / 0.008 |
| span_gap | 0.009 / 0.021 | 0.020 / 0.025 | 0.008 / 0.012 |

| Launch/completion or logged spacing | n | Median / maximum ms |
| --- | ---: | ---: |
| run_native | 5 | 0.129 / 0.172 |
| run_total | 5 | 0.241 / 0.304 |
| run_residual | 5 | 0.105 / 0.175 |
| launch_outer | 5 | 8.183 / 10.221 |
| launch_outer_minus_render | 5 | 0.269 / 0.397 |
| completion_callback | 5 | 0.005 / 0.009 |
| launch_to_frame | 5 | 14.000 / 14.000 |
| launch_to_completion | 5 | 256.000 / 321.000 |
| frame_to_completion | 5 | 242.000 / 307.000 |

Native launch median/max is **0.129 / 0.172 ms**; existing run helper
**0.241 / 0.304 ms**. Completion only validated/logged and took
**0.005 / 0.009 ms**. Logged launch→frame spacing was **14 / 14 ms**,
launch→completion **256 / 321 ms**; neither is measured process life or CPU.
Periodic production work occurred after some paired frames but before completion
(comparison 2: update/describe launch; comparison 5: describe callback). It did not
interrupt the selected render pair or fail its metadata checks; it can affect
completion/log spacing and prevents interpreting that spacing as isolated CLI cost.

## Interpretation and checks

All elapsed figures are Luau os.clock upper bounds on thread CPU. In-flight means
callback pending, not proof the OS process remained alive. sameModel is reference
identity, not a deep live value hash; source/fake-host checks guarantee the probe
itself makes no model/queue edit and never ingests command stdout. Ordinary
periodic refresh remains active. No after-command frames were sampled.

This controls one read-only describe launch, not writes/apply work or native
pointer-release reconciliation. Order is fixed; observer clocks/wrappers/buffers/
logs, GC, scheduling and native conditions remain unseparated. No tracing or
getfenv/setfenv is present. No unique CPU/GC/scheduling/vendor cause, production
fix, design revision, clean-production acceptance or original Task 6 gate is
inferred from this bounded comparison.

Representative parser assertions passed for comparison-id pairing, source/log
order, flags/invariants, interference including callback0, complete phases,
residual/gaps and stats. Independent raw extraction verified five primary records
per class, all ten phase sets, flags and every aggregate/derived value.

The controller reports original main pointer/plugin reload, exact original active
profile/scratch, all **23 profile bytes** and all canonical values verified;
host-load found nothing running. Analysis read frozen scratch only and made no
host, production/spec/task changes, suite run, new probe, subagent or background job.

Artifacts in `/tmp/prism-budget-launch-comparison-jx3_7ztr/`: `analyze-launch.py`,
`launch-results.json`, `launch-results-report.md`, and `analysis-verification.txt`;
inputs remain `diagnostic.log` and `run-state.json`. JSON retains all paired values,
metadata and interference records. Commands:

```sh
python3 /tmp/prism-budget-launch-comparison-jx3_7ztr/analyze-launch.py --self-check
python3 /tmp/prism-budget-launch-comparison-jx3_7ztr/analyze-launch.py /tmp/prism-budget-launch-comparison-jx3_7ztr/diagnostic.log --output /tmp/prism-budget-launch-comparison-jx3_7ztr/launch-results.json
```
