# Bounded offline call-count experiment

Completed a scratch-only standalone measurement using production source and the
saved pre-follow-up describe model. No Task 7 test, ceiling, production code, spec,
host configuration/pointer, task, desktop or background process was changed.
**These are Lua 5.4 call counts, not host timing or acceptance data.**

## Inputs, harness and verification

Input: `/tmp/prism-budget-cache-diagnostic-gdlbu7zz/before-describe.json`.
Production source: `.worktrees/panel-budget/integrations/noctalia-plugin/`.
The harness reuses the fake host pattern in `contract.test.mjs`, the production
panel/Presentation/Retain modules, and existing `test_encode.lua` for stable
digests. Task 7 harness was read only as reference; its tests were not executed
or edited and no ceiling was installed. Runtime: installed `lua5.4`, version 5.4.9.

Python generated a Lua literal preserving numeric/boolean/string values and array
order/shape. Object nulls map to absent/nil keys, as the contract host does; the
actual saved model contains no JSON nulls. Independent Lua→Python leaf records
verified **1,907 scalar leaves with exact types and numeric values**, **821 table/
array-shape assertions**, **83 parameter keys in saved order**, and **12 expanded
rack cards**. Expansion used the production Show details handlers. Private render
and state slots were obtained read-only with debug.getupvalue, avoiding source edits.

Assertions verified 20 total renders, 3 describe callback invocations (including
one synthetic cold refresh), 3 frame callbacks, 1 release and 1 write completion,
and 3 fake asynchronous launches. Each measured phase checked its expected render
count and memo misses; warm/release/write-completion all miss zero. Final recorded
production source hashes still match disk. Lua execution exited 0 with no stderr.

## Explicit measured states

- `expandedColdRender`: 12 rack cards expanded; synthetic fresh describe decode/validation outside measured span; memo emptied; new entry metadata cold; step-precision cache remains warm as after real cold x; direct production render called once.
- `steadyWarmRender`: Same decoded model and populated memo from cold render; direct production render called once; all retained units hit.
- `dirtyDragTick`: Selected expanded-rack release-mode slider glass.inactive.roughness changed to 37% of its presented track before measurement; no render onChange; one dirty frame measured, four expected memo-path rebuilds.
- `release`: Same drag after that dirty frame, no further value change; one endDrag call final-enqueues then renders; no native reconciliation behavior in fake panel; zero memo misses.
- `writeCompletion`: Successful fake final-write result, queue drains, refresh launched, one immediate render; zero memo misses.
- `changedDescribe`: Fresh original snapshot entries reflect final drag value with scratch held and change compositor.gaps by one step; one queued describe response, no inline render.
- `deferredDescribeRender`: One following frame accepts pending render, five memo misses.

The cold span excludes its prior decode/validation, matching a cold-render frame;
the changed-describe span measures those production operations separately. Native
decode copying and canonical encoding bodies run unhooked, as in the reference
cost harness; their fake boundary and instrumentation helper calls stay visible.
Fake runAsync stores callbacks and never launches a real process. Fake panel.render
stores the tree, with no native readback/reconciliation or compositor work.

## Counts by phase

| Phase | Total call events | Production Lua | Standard-library C | Fake host Lua | Experiment helpers | Renders | Memo misses |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| expandedColdRender | 9742 | 3894 | 4353 | 1495 | 0 | 1 | 142 |
| steadyWarmRender | 3514 | 874 | 2555 | 85 | 0 | 1 | 0 |
| dirtyDragTick | 3982 | 957 | 2899 | 125 | 1 | 1 | 4 |
| release | 3572 | 907 | 2577 | 87 | 1 | 1 | 0 |
| writeCompletion | 3544 | 888 | 2568 | 86 | 2 | 1 | 0 |
| changedDescribe | 4426 | 470 | 3761 | 97 | 98 | 0 | 0 |
| deferredDescribeRender | 3737 | 992 | 2614 | 130 | 1 | 1 | 5 |

Call events are aggregated by source and function definition line; C functions
add a name to distinguish functions with definition line -1. Lua aliases can have
different first-observed names, so source/definition line is authoritative.
`results.json` contains every function row, category total and rebuilt id.
Standard-library C includes Lua generic-for iterator events and a few calls from
fake-host helpers; it is not a measured production-only CPU total. Fake UI lookup
and constructor calls differ from actual host bindings. Debug hook setup/gethook/
sethook calls themselves are excluded; no milliseconds were recorded.

## Dominant remaining calls

| Function / definition line | Warm render | Dirty drag | Release |
| --- | ---: | ---: | ---: |
| panel.luau:92 sig | 284 | 289 | 284 |
| panel.luau:79 gateOf | 156 | 158 | 156 |
| presentation.luau:281 holds | 79 | 79 | 79 |
| panel.luau:101 cellSignature | 75 | 83 | 75 |
| panel.luau:118 noteFocus | 74 | 74 | 74 |
| retain.luau:10 Retain.get | 34 | 39 | 34 |
| panel.luau:911 cardSignature | 12 | 12 | 12 |
| panel.luau:890 cardHeadSignature | 12 | 13 | 12 |
| presentation.luau:476 pairsOf | 7 | 9 | 7 |
| presentation.luau:288 editedCount | 5 | 6 | 5 |
| presentation.luau:501 neutralCount | 4 | 5 | 4 |

Warm C iterator events number **1,659**; dirty drag **1,970**; release **1,664**.
Warm also has 215 tostring, 198 ipairs, 102 concat and 70 format calls. These count
calls, not work duration. Cold production calls additionally concentrate in slider
metadata/formatting and full control construction; the full per-function rows
are preserved in the JSON. Changed describe concentrates in validation, structural
assembly and digest boundaries (95 fake encode calls plus one decode).

Dirty drag rebuilt precisely `s:Focus`, `c:glass.inactive.roughness`, `h:backdrop`,
and `d:backdrop`; release rebuilt none. This matches the expected changed cell/
header/card path and verifies retention setup. Despite no builders, warm and
release still recompute signatures, focus traversal, gates/swatches, rack state,
pair/edit/neutral counts and unretained header/root controls.

## What this supports and leaves unknown

The grounded remaining-work candidate is shared traversal/signature construction
and repeated presentation derivation/allocation. This identifies call volume, not
its CPU share, dominant wall-time contribution or the best production change.
For this sequence, release uses **58 more total calls than warm** but **410 fewer
calls than dirty drag**, with nearly identical warm/release signature counts.
Thus simply having more calls does not explain the higher live release elapsed
time. The offline model uses one chosen slider/sequence, not every live gesture.

Lua 5.4 call events—including generic-for C iterators—are not equivalent to Luau
bytecode, optimized imports/iterators or host budget interrupt events. Call counts
also omit instruction cost, table allocation volume, GC pauses, descheduling,
async process contention and native readback/compositor work. The fake host has no
native slider reconciliation. No unique CPU cause is established and the live
residual is not assumed to be entirely CPU. No guessed fix, new algorithm, design
revision, acceptance verdict or offline ceiling is proposed by this experiment.

## Reproduce and artifacts

From `.worktrees/panel-budget/`:

```sh
python3 /tmp/prism-budget-cache-diagnostic-gdlbu7zz/offline-cost/run-experiment.py integrations/noctalia-plugin /tmp/prism-budget-cache-diagnostic-gdlbu7zz/before-describe.json
```

Bounded synchronous command; the Lua child has a 60-second timeout and completed
in less than a second. This is a standalone measurement, not a test-suite runner.
No repository test recipe or dependency was added and no test suite ran.

Artifacts in `/tmp/prism-budget-cache-diagnostic-gdlbu7zz/offline-cost/`:
`run-experiment.py`, `experiment.lua`, generated `model.lua`, `expected-keys.lua`,
`assert-shapes.lua`, `raw-records.tsv`, empty `stderr.txt`, `results.json`, and
`report.md`. These inputs/output retain saved model details and production source
hashes for reproducibility. Nothing was left running.
