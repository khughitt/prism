# Frozen cold/release phase results

Run `1791735860`, 176.302-second collection. Controller recovered one log
rotation using the saved offset in rotated `.1`, then current segment; only the
chronological frozen scratch log was read. One run marker, five distinct alternating
setup/render pairs, one done marker; **0 budget/error-level lines**. Every selected
render has exact coarse/native/total spans and one correctly ordered heap record.

**Cold exceeded the 15-ms diagnostic comparison target; release remained slow.**
No acceptance is applied: profile switching is unmeasured and instrumentation/
heap reads remain observer overhead. Figures are Luau os.clock elapsed upper bounds
on thread CPU. Heap KB is read-only gcinfo, not allocation/GC duration or CPU cost.

## Callback distributions

| Class | n | Median ms | Maximum ms |
| --- | ---: | ---: | ---: |
| coldSetup | 5 | 7.1630 | 10.324 |
| coldRender | 5 | 19.8690 | 22.271 |
| dirtyDrag | 182 | 7.9690 | 11.060 |
| release | 5 | 20.6610 | 24.007 |
| completion | 10 | 20.6045 | 23.514 |
| changedDescribe | 11 | 8.6570 | 10.389 |
| deferredRender | 11 | 8.5320 | 9.567 |

coldSetup includes its nested describe; those five nested describes are **not**
ordinary changedDescribe samples. ChangedDescribe/deferredRender use ordinary
post-done callbacks >0.5 ms; this window includes release/revert and other changed
responses, not proven one-to-one causal assignment. Dirty drag requires an actual
render. Excluded **117 callback0 timing/heap records**, **437 idle/no-op records**
and startup loading render callback2 (which lacks loaded-model coarse phases).

## Cold and release per-render evidence

| Class/callback | Callback ms | Top | Presentation | Assembly | Native | Total | Residual | Heap before→after KB (delta) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| coldRender/67 | 22.271 | 1.507 | 0.316 | 17.932 | 2.459 | 22.247 | 19.788 | 1982→2796 (+814) |
| coldRender/69 | 15.397 | 2.265 | 0.497 | 11.478 | 1.123 | 15.383 | 14.260 | 1443→2257 (+814) |
| coldRender/71 | 19.869 | 1.122 | 0.417 | 16.774 | 1.491 | 19.841 | 18.350 | 2412→2234 (-178) |
| coldRender/73 | 10.730 | 1.091 | 0.240 | 8.261 | 1.113 | 10.718 | 9.605 | 1472→2286 (+814) |
| coldRender/75 | 20.171 | 1.917 | 0.410 | 15.479 | 2.318 | 20.149 | 17.831 | 2441→1679 (-762) |
| release/181 | 18.784 | 9.316 | 0.477 | 4.797 | 3.877 | 18.491 | 14.614 | 2234→2532 (+298) |
| release/317 | 23.136 | 13.682 | 0.513 | 5.487 | 3.145 | 22.863 | 19.718 | 2204→2502 (+298) |
| release/457 | 24.007 | 12.425 | 0.663 | 7.397 | 3.240 | 23.764 | 20.524 | 2180→2478 (+298) |
| release/586 | 20.661 | 1.469 | 10.954 | 5.029 | 2.929 | 20.419 | 17.490 | 1371→1666 (+295) |
| release/751 | 19.767 | 1.830 | 0.386 | 13.928 | 3.269 | 19.434 | 16.165 | 1669→1967 (+298) |

| Render metric | Cold median/max n5 | Release median/max n5 | Completion median/max n10 | Dirty median/max n182 |
| --- | ---: | ---: | ---: | ---: |
| top | 1.5070 / 2.265 | 9.3160 / 13.682 | 9.7570 / 14.037 | 1.9285 / 3.230 |
| presentation | 0.4100 / 0.497 | 0.5130 / 10.954 | 0.5950 / 8.639 | 0.4140 / 0.833 |
| assembly | 15.4790 / 17.932 | 5.4870 / 13.928 | 5.4695 / 15.510 | 3.6645 / 5.276 |
| native | 1.4910 / 2.459 | 3.2400 / 3.877 | 2.9195 / 4.778 | 1.8340 / 2.965 |
| total | 19.8410 / 22.247 | 20.4190 / 23.764 | 20.3980 / 23.281 | 7.9525 / 11.041 |
| residual | 17.8310 / 19.788 | 17.4900 / 20.524 | 16.8115 / 19.904 | 6.0280 / 8.245 |
| render_gap | 0.0250 / 0.037 | 0.0360 / 0.039 | 0.0400 / 0.093 | 0.0220 / 0.125 |

Residual = total−native and gap = total−three phases−native **within each sample**.
No unrelated medians are summed/subtracted. JSON retains every individual sample,
cold setup/nested-describe association, render/heap row and drain record.

## Location and heap associations

Cold assembly/signature/focus/control construction dominates this sample: median
**15.479 ms**, versus native **1.491 ms**. Cold frame median **19.869 ms**; four of
five exceeded 15 ms, one was 10.730 ms. Fresh setup/validation stayed in separate
callbacks (setup median7.163/max10.324). Measured trees have the diagnostic button
removed; readiness checks compare them to production ignoring function identity.

Release callback median **20.661 ms**, total render **20.419 ms**, versus dirty
render **7.9525 ms** and previous no-launch warm render about8 ms. Extra elapsed
interval moves: first three releases have top **9.316/13.682/12.425 ms**; fourth
has presentation **10.954 ms**; fifth has assembly **13.928 ms**. Completion shows
a similar moving interval. This locates elapsed time to coarse phases, **not one
fixed function or unique CPU/GC/scheduling/vendor cause**. Cold and release are
different paths; these measurements do not prescribe one production fix.

Cold heap deltas were **+814,+814,−178,+814,−762 KB**; high and lower elapsed
samples occur with positive deltas. All release deltas were **+295 to+298 KB**,
despite every release being slow. Thus a visible heap drop is not required for
slow release here; positive net movement does not rule out incremental GC work.
Two snapshots cannot measure allocation throughput, collection time or which
interval any collection occurred in. Heap is sampled immediately before/after
render total timing, with its record queued after timing. Outer callback timing
includes those reads; records/logs also affect host budget and surrounding state.

## Recovery, drain and verification

Last drain: callback **767**, phase describe, **queueIdle=true**,
**describeRunning=false**, before pointer restoration. Controller verified main
pointer restored/plugin reloaded, exact original profile/scratch, all **23 profile
document bytes** and all canonical values unchanged; **no restore write needed**.
Host-load found nothing running. No live state was read or changed by analysis.

Minimal parser assertions validate separate five-pair order, exact phases/heap
arithmetic, nested-vs-ordinary describes, callback0/idle exclusion, drain and bad
marker rejection. Independent raw extraction reproduced all class distributions,
recomputed stats/within-sample residuals and gaps, checked every heap delta and
exact source timer/heap/queue-record placement. Initial loading partial phases
are explicitly excluded; selected cold/release incomplete phases fail early.
No production/spec/task/host change, suite, new probe, subagent or background job.

Artifacts: `/tmp/prism-budget-cold-release-i1qwedih/` contains `analyze-cold-release.py`,
`cold-release-results.json`, `cold-release-results-report.md`, `analysis-verification.txt`;
frozen inputs remain `diagnostic.log` and `run-state.json`.
