# Actual diagnostic results

Run `1791663060`, 297 seconds. Saved inputs:
`/tmp/prism-budget-diagnostic-3_avin1d/diagnostic-results.json` and
`/tmp/prism-budget-diagnostic-3_avin1d/diagnostic.log`. All 761 parsed timing records
were checked and match the saved log exactly. These are diagnostic Luau
`os.clock()` elapsed upper bounds on thread CPU, **not acceptance data**.
Recorded budget errors: **0**.

One release callback (`436`) yielded:

| Span | Elapsed ms |
| --- | ---: |
| `dragEnd` | 14.706 |
| `renderTotal` | 14.473 |
| `panelRenderNative` | 2.200 |
| `enqueueTotal` | 0.174 |
| `runTotal` | 0.146 |
| `runAsyncNative` | 0.071 |

Rendering accounts for most of this sample; synchronous launch/enqueue accounts
for little. The render-minus-native residual is 12.273 ms, an approximate Luau
construction/other-work residual including instrumentation, scheduling, and any GC
cost. It does not identify a builder or root cause. Nested spans overlap and must
not be summed. There is only one release; no acceptance median is established.

Active dirty drag ticks (>0.5 ms, n=18) had median **6.2495 ms** and maximum
**8.507 ms**. Idle ticks are excluded. Subsequent write-completion callbacks
`438` and `445` took 18.496 and 18.797 ms; their render totals were 18.253 and
18.545 ms, with native spans 3.514 and 2.489 ms. These are distinct completion
callbacks, not additional release samples.

There were **zero key callbacks and zero coldRender records**. The requested cold
case was not captured; the record does not establish why. No user attribution or
cause is inferred. Actual expanded cold samples plus cache reach are still needed
before considering redesign. The earlier acceptance probe used `getfenv(1)` and
may have inflated measurements by deoptimizing its entry environment; magnitude
unknown. This diagnostic contains no `getfenv`/`setfenv`, but still has clock,
buffering, wrapper, allocation, and log overhead. GC and scheduling causes remain
unknown.

Some UI handlers in the first diagnostic were not outer wrappers: their buffered
spans could be flushed under a later callback id. Such mixed records are not used
as causal per-callback evidence here. The selected release and active frame ticks
have outer wrappers. The follow-up captures callback ids when records are created,
marking unwrapped work as callback 0 so it cannot be mistaken for later work.

The controller reports original plugin pointer restored/main reloaded, all profile
bytes and exact scratch verified, and no processes left running. This analysis
performed no live host, source, task, or process changes. It proposes no production
algorithm or spec revision from one release sample. Next: a fresh authorized
scratch exercise with five cold-button clicks and five drag/releases, collecting
cache rebuild ids alongside coarse timing. No profile switching is needed for
this diagnostic; it still does not complete original Task 6 acceptance.
