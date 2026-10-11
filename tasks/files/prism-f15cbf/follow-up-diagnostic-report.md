# Frozen follow-up diagnostic analysis

Run `1791729887`; diagnostic-only Luau `os.clock()` elapsed milliseconds, upper
bounds on thread CPU. **No original Task 6 acceptance decision is applied.**
Five cold callbacks and six releases were captured. The frozen collection window
was 174.721 seconds. Budget-error lines in the frozen file: **0**.

| Class | Callback n | Callback median/max ms | Render median/max ms | Native median/max ms | Residual median/max ms |
| --- | ---: | --- | --- | --- | --- |
| coldRender | 5 | 20.5970 / 21.149 | 20.5780 / 21.119 | 2.2750 / 2.451 | 18.2590 / 18.844 |
| dirtyDrag | 238 | 7.8985 / 11.613 | 7.8845 / 11.590 | 1.8050 / 3.529 | 6.0355 / 8.596 |
| dragEnd | 6 | 19.7795 / 21.816 | 19.5230 / 21.610 | 2.9990 / 3.879 | 16.1520 / 18.591 |
| describeRender | 15 | 8.0660 / 15.871 | 8.0350 / 15.841 | 1.8810 / 3.081 | 5.9240 / 14.411 |
| writeCompletion | 12 | 18.6265 / 23.058 | 18.4160 / 22.860 | 2.4590 / 3.269 | 16.0600 / 20.020 |

Callback and render statistics use separate sample units; these selected classes
have one render per sampled callback. Dirty drag requires >0.5 ms and an actual
render record. Active describeRender excludes idle/no-render ticks and is not a
formal changed-describe phase classification. Excluded: **72 callback-0 records**
and **669 idle drag ticks**. Callback 0 never enters causal timing/cache comparisons.

## Cold and release distributions

| Class | Callback id | Callback ms | Render ms | Native ms | Residual ms | Rebuilt |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| coldRender | 103 | 20.597 | 20.578 | 2.408 | 18.170 | 142 |
| coldRender | 112 | 21.149 | 21.119 | 2.275 | 18.844 | 142 |
| coldRender | 118 | 20.735 | 20.710 | 2.451 | 18.259 | 142 |
| coldRender | 124 | 19.650 | 19.635 | 1.294 | 18.341 | 142 |
| coldRender | 129 | 20.374 | 20.346 | 2.150 | 18.196 | 142 |
| dragEnd | 269 | 20.613 | 20.354 | 3.879 | 16.475 | 0 |
| dragEnd | 429 | 21.816 | 21.610 | 3.019 | 18.591 | 0 |
| dragEnd | 561 | 18.946 | 18.692 | 2.863 | 15.829 | 0 |
| dragEnd | 738 | 18.937 | 18.640 | 3.502 | 15.138 | 0 |
| dragEnd | 930 | 21.235 | 20.913 | 2.816 | 18.097 | 0 |
| dragEnd | 1142 | 16.787 | 16.546 | 2.979 | 13.567 | 0 |

Release enqueue med/max: **0.198 / 0.241 ms**; run med/max:
**0.1655 / 0.207 ms**; native async-launch med/max: **0.0875 / 0.131 ms** (n=6 each).
These are nested launch spans, not command completion latency, and are not summed.

## Cache reach and interpretation

All five cold renders rebuilt **142 units** and logged identical rebuilt-id lists.
Dirty drag rebuilt **2 units in 130 renders**, **3 in 100**, and **4 in 8**.
All six releases and all twelve write-completion renders rebuilt **0 units**.
Trace counts are misses, not exact hit counts: a retained parent skips child lookups.
The complete per-render count/id text and parsed escaped-id list for all **278**
positive-callback renders are in `analyzed-results.json` under `renders`, with
callback id, render index, native/total/residual timings, and source/cache line
numbers. Cache records pair to their preceding renderTotal in callback/log order;
no missing or ambiguous pairs were found. NUL remains displayed as literal `\0`.

This probe shows repeatable roughly 20-ms cold callbacks and roughly 20-ms release
callbacks despite zero release memo rebuilds. Native render and launch costs are
smaller than the render residual. That residual is elapsed work outside the native
call, including non-memo rendering, instrumentation, allocation/GC and scheduling;
it does not identify their individual contributions or establish a root cause.
Zero trace rebuilds do not mean zero tree traversal or signature work.

No `getfenv`/`setfenv` occurs in this probe. It avoids the earlier probe-induced
environment deoptimization, but the scratch button, trace appends, wrappers,
buffer allocation and logging still affect execution and native tree work.
Logging is after callback timing but inside the host budget. The observed cold
and release medians exceed the original diagnostic comparison targets, but this
tracing/tree-altered probe cannot by itself establish clean-production acceptance.
GC, scheduling, and observer overhead remain unmeasured causes. No production
algorithm or redesign is inferred from the residual alone.

## Verification and state

Parser representative assertions cover escaped NUL, callback-0 and idle exclusion,
multiple renders per callback, ordered pairing, medians/residuals, delimiter
ambiguity and fail-early malformed/orphan/multi-run cases. Independent raw-log
checks reproduced primary class distributions, recomputed every aggregate, and
verified count/list agreement and residual/native pairing for all 278 renders.
No parser warnings. Only the frozen scratch log was read.

The controller reports original main plugin pointer restored/reloaded, original
active profile and exact scratch verified, all **23 profile files** byte-verified,
and no processes left running. This worker made no host, production, spec or task
changes and launched no background process.

## Files and reuse

Scratch files: `analyze-diagnostic.py`, frozen `diagnostic.log`,
`analyzed-results.json`, and this `frozen-diagnostic-report.md`.

```sh
python3 analyze-diagnostic.py --self-check
python3 analyze-diagnostic.py diagnostic.log --run 1791729887 --output analyzed-results.json
```

Use a frozen log path only. Missing runs/invalid diagnostic records fail early;
unmatched timing/cache metadata is surfaced rather than silently counted. The
parser never opens host state, changes pointers, or runs a background monitor.

## Bounded read-only production path comparison

Sources reviewed under `.worktrees/panel-budget/integrations/noctalia-plugin/`:
`panel.luau` (endDrag:560, cellSignature:101, retainedCard:954,
sectionHeaderSignature:1017, render:1465, onFrameTick:1570),
`retain.luau` (get:9), and `presentation.luau` (gates:233,
rackState:440, pairsOf:476, symmetricCount:493, visibleParams:509).
No source edit, test run, or additional probe was prepared for this comparison.

**Both paths invoke the same render function.** A dirty frame clears the drag's
dirty flag, calls render while drag remains active, then may enqueue a throttled
live sample after rendering. Release computes any canonical step correction,
clears drag, always enqueues the final nonsample write, sets a temporary slider
correction if needed, renders synchronously, clears that correction, and adjusts
frame-tick subscription. Unlike frame rendering, release therefore occurs after
its launch/enqueue and always renders even if the last dirty frame already showed
the final value. The recorded release enqueue/launch itself is small; work or
contention following a launch is not separately attributed by those spans.

**No explicit drag-versus-release branch occurs in render or its retained
signatures.** Neither `state.drag` nor the temporary slider correction is a render
signature input. Correction is read by beginDrag to suppress reconciliation-driven
changes. Release can change the canonical value and error state, but its zero
rebuilt counts show no retained signature miss in these sampled release renders.
This is a state/path distinction, not proof that the two callbacks have identical
machine conditions or host interactions.

**Zero builders still leaves substantial shared work.** Every render resets its
signature cache and focus list, constructs the top/header/edit controls and root
containers, derives profile/wallpaper/edit counts, recomputes gates and attached
swatches, recomputes rack bypass/attenuation state, and traverses sections/cards
for focus order and placement. Before a retained lookup can hit, its signature is
constructed: cells stringify values and concatenate fields; cards visit expanded
rows/shared controls; section headers recompute pair/edit/symmetric/neutral counts.
`pairsOf` itself allocates group/row maps and lists. The callable builder closure
is also supplied before Retain.get returns a hit. Unretained separators, matrix
headers, subgroup headings and root/profile/edit controls are still constructed.
Finally the complete root tree is passed to native panel.render. Retain.get only
skips its build function on a matching signature; it does not skip caller-side
signature/traversal or unretained work. Parent hits skip child lookups, so trace 0
is not a count of all visited nodes or all work avoided.

A grounded next investigation candidate is the common render traversal/signature
and allocation work, including repeated pairs/count derivation and unretained
headers, together with why elapsed conditions differ after release/async launch.
That identifies source work to inspect, not its measured cost or a replacement
algorithm. The approximately 16-ms release residual is **not established as all
CPU**, nor as all construction: GC, scheduling and trace/wrapper overhead remain
unmeasured. No production redesign or another live probe is proposed here.
