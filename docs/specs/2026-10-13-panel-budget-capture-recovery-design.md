# Recover complete panel-budget measurements

**Date:** 2026-10-13
**Status:** revised proposal after spec review round 1; owner review required before
implementation planning. No new probe, analyzer or live protocol is implemented.
**Task:** `prism-111a3f`; parent `prism-f15cbf`, original render-budget Task 6.
**Authority:** [the render-budget design](2026-10-10-panel-render-budget-design.md),
Parts 1–5. The staging exception below is proposed for explicit approval; all
correctness requirements, numerical thresholds and full acceptance counts remain.

## Intent and terms

Obtain complete, matched in-host evidence with fewer owner/chat handoffs. Production
tree shape, commands, refresh cadence and synchronous release correction do not
change. This design changes the scratch experiment and controller, not production
release/completion scheduling.

- **B1/C1:** baseline then token candidate in matched block 1. **C2/B2:** candidate
  then baseline in block 2. Each label denotes a fresh plugin runtime and nonce.
- **P:** the owner's starting profile. **Q:** an existing profile whose canonical
  parameter values differ from P on strictly >half of the keys, in both directions.
- **Canonical values:** effective parameter values resolved from the profile,
  wallpaper and scratch; a profile selector's optimistic label is not proof of them.
- **Eligible drain:** records prove queue, describes, drag, pending render, diagnostic
  sequence and commands have settled; log buffers are flushed; P, test scratch and
  expected expansion are verified. Initial idle state alone is not final completion.
- **Completion-state group:** valid read-only launch pairs whose command was actually
  pending, or actually complete, at the following-frame render. Five in one group
  plus five corresponding no-launch controls are needed for a primary aggregate.

## What r2 established

The stabilized four-activation pilot paused rotation and restored Prism and its
prior timer state. Its evidence disposition remains inconclusive/unaccepted.

| Observation | Evidence and implication |
| --- | --- |
| Complete records | B1/C1/C2 retain 1,136/1,810/3,093 records respectively. |
| C1 release loss | Close was 0.607 s after release, before the describe at 0.690 s. The release-origin deferred render is missing; C1's only ordinary deferred render came from restoration. |
| C2 Q loss | Close preceded accepted Q describe by 150 ms. Reopening about 145 s later rendered under the open class, not deferred profile rendering. |
| Profile latency | Seven observable profile changes took 2.71–3.12 s from click to accepted describe. B1's Q render beat close by about 1 ms. |
| Capture loss | B2 inode reuse overwrote an earlier occurrence and lost 1,096 records. Final drain does not repair that interval. |

Repeated returns to chat caused the close/open handoff pattern and exposed both
classes to this race. Identifying the particular dismissal key is unnecessary to
fix the protocol. Grouping removes intermediate handoffs, but the final handoff
also needs a dwell rule.

The original approximately ten-minute pilot estimate was too low. Actual desktop
occupancy was **95.976 minutes**, mostly owner/chat windows:

| Window | Minutes, rounded |
| --- | ---: |
| Reload/expand | 24.0 |
| Diagnostics | 17.5 |
| Release/restore | 22.5 |
| Q/P | 30.2 |
| Controller-only/remainder | about 2 |

These windows include reading, chat and settling, not just active hands time. The
cold unit took about 0.037 s and launch pair about 0.2 s automatically. Complete
exploratory cold samples were 19.713–21.382 ms and releases 18.528–25.524 ms.
These are **os.clock elapsed times**, upper bounds on thread CPU, not measured
25-ms CPU-budget overruns. Complete activation logs had zero budget errors;
whole-B2 error completeness is unknown. Two single launch/control pairs establish
no primary or causal result. No keep/revert conclusion follows from n=1.

Portable evidence is attached to `prism-4ba651` as
`task3-r2-evidence-and-collector-fix.tar.gz`, alongside the full scoped review.
The original raw loss remains preserved and explicit.

## Scope and chosen approach

Amend Part 5 to measure the cheap cold/launch evidence first. Collect owner-heavy
classes only if cold passes both its gain and absolute gates. This proposal changes
Part 5's one-session requirement and its all-classes-before-any-decision rule; it
requires written approval. It preserves the gain/no-regression thresholds and
full acceptance rule. An inconclusive stage is never a passing stage.

Artifacts that change after approval: scratch probe and builder, controller loop,
collector integration, runbook/action cards, analyzer and estimator, their focused
checks and new build manifests. Every changed probe produces new transformed hashes
and fresh nonces from the frozen baseline/candidate source commits. No production
module changes except a required, separately reviewed token revert.

The alternatives are repeating the many-handoff protocol, or grouping every class
in another full pilot immediately. Both spend owner time on heavy classes before
the already-slow cold path has a complete result. Production scheduling changes
remain a separate design after sufficient launch evidence.

## Stages and decision contract

### Stage 1: cold and launch evidence

Run four fresh activations B1→C1→C2→B2. Each receives one diagnostics click and five
cold samples. In B1/C1 also collect five launch pairs and five controls per variant.
No slider or profile action is requested. The same snapshot/reference is required
through all four activations; cold setup clears the unchanged-describe shortcut,
creates fresh parameter tables and empties memo before each measured render.

A revised smallest Stage 1 pilot first exercises four activations with one cold
each and one launch/control pair per variant. It checks capture, readiness,
classification, parsing and exact restoration, with an insufficient-samples verdict.
Automated fixtures exercise the five-sample decision branches. Only a successful
collection pilot supports estimating and requesting the five-sample Stage 1 run.

The analyzer gets explicit stage, integrity-completeness and launch-group
completeness inputs. Stage 1
requires five valid colds for each implementation in each block, exact reference/
identity/correctness checks and a complete zero-budget-error count. With those
preconditions, compute the original baseline MAD and strict gain >max(1 ms, MAD)
independently in both blocks. Do not pool blocks.

| Stage 1 result | Disposition |
| --- | --- |
| Cold/identity/correctness/error evidence incomplete or invalid | `comparison=inconclusive`, `accepted=false`, `return_to_design=true`; no Stage 2. |
| Either complete cold block fails the gain rule | `comparison=revert`, `accepted=false`, `return_to_design=true`, reason `cold_gain_failed`; owner-heavy classes explicitly `not_run`. Revert the isolated token change through a fix subagent, green fast suite/gates and scoped review. |
| Gain passes both blocks, but either candidate cold median is ≥15 ms | `comparison=inconclusive`, `coldGainPassed=true`, `coldTargetPassed=false`, `accepted=false`, `return_to_design=true`; no Stage 2 and no overall keep claim. Tokens remain unaccepted pending design. |
| Gain passes, both candidate cold medians are <15 ms, and launch/control groups are complete | `comparison=pending_stage2`, `accepted=false`, `return_to_design=false`, `stage2Eligible=true`; warm/profile classes deliberately unmeasured, with no overall keep/no-regression claim. |
| Cold gates pass but launch/control groups remain short after the bounded recovery opportunity | `comparison=inconclusive`, `accepted=false`, `return_to_design=true`, `stage2Eligible=false`; launch question remains unresolved. |

Launch completeness is reported separately. A cold failure can settle revert or
return-to-design even if launch groups are short. A primary launch aggregate still
requires five valid pairs with the same actual completion state and five controls;
otherwise the launch question remains inconclusive. Stage 2 is requested only
when the cold gate passes and required launch/control groups are complete.

Missing classes inside a stage or a failed recovery remain inconclusive; the sole
early-revert exception is **complete cold evidence that fails gain**. Fixtures must
prove the incomplete cold case cannot reach that exception, equality at gain is
failure, 15 ms is failure, a short launch group cannot advance a cold pass, and
pending Stage 2 is never accepted.

### Stage 2: original full acceptance

Stage 1 ends with exact restoration, including rotation. Stage 2 needs fresh
permission and fresh snapshots; it may be a different session. Do not combine
Stage 1 colds with new-runtime Stage 2 warm/profile samples. Stage 2 repeats five
colds in each fresh B1/C1/C2/B2 activation and collects five actual releases with
restores, three P→Q→P cycles, dirty drag ticks, changed describes and ordinary
following deferred renders. Each required class needs ≥5 eligible samples per
implementation per block within that stage. Stage 1 launch evidence remains a
separately identified diagnostic on the same frozen source revisions; it is not
pooled into Stage 2 target classes.

Apply the original full `decide` rule to complete Stage 2 data: two-block cold gain,
no target-class regression beyond its own max(1 ms, baseline MAD), and correctness/
zero budget errors. Cold/profile medians must be <15 ms; drag, release,
changed-describe and ordinary deferred-render medians must be ≤12 ms. Incomplete
full evidence remains inconclusive/accepted=false/return_to_design=true. A useful
candidate with any failed absolute target returns to design; complete gain or
no-regression failure requires revert. Original Tasks 7–8 stay gated until full
acceptance and required launch evidence/restoration checks pass.

Before an extended Stage 2 request, its own smallest n=1 pilot exercises the
owner-heavy settlement/recovery gates through parsing and restoration. Stage 1
success does not prove those gates or grant permission for them.

## Readiness, action cards and Q/P proof

Before giving an activation's card, the controller verifies the fresh nonce and
source/instrumentation hashes, settled accepted model, P, exact test scratch and
canonical reference against the locked session snapshot. Expansion changes none
of those values. Record this reference in the activation manifest.

The diagnostics button expands all rack cards in its **unmeasured administrative
callback**, using the current structure's device ids, then hides itself. A separate
readiness observer confirms exact `expandedIds`, `rackIds`, `allRackExpanded=true`
and the settled reference before diagnostics begin. Collapsed/missing cards or
changed inputs refuse the sequence and admit no target samples. An administrative
warm render is allowed only before cold setup; it does not prewarm the fresh cold
parameter tables. During owner-heavy actions, collapsed-card samples are ineligible.
Measured trees must match the ordinary all-expanded production tree exactly.

One action card and one completion response cover each activation. Stage 1 asks
only for the diagnostics click. Keep Prism visible at least five seconds after
the button disappears, and until its controls have settled, before returning to
chat. The controller additionally requires the sequence's actual final drain.

A Stage 2 card adds the selected unedited slider/own restore and profile cycle.
It must state these minimum dwell rules explicitly:

1. After **every release and every restore**, keep Prism open for at least **2 s**;
   wait longer if controls have not settled. Do not immediately switch profiles.
2. After **every Q or P click**, keep Prism open for at least **5 s** and wait until
   Prism's parameter values visibly reflect the new profile. Desktop appearance
   or the profile selector's optimistic label is not the cue. Do not click P
   before Q has settled, or start another cycle before P has settled.
3. The last P click follows the same five-second rule before returning to chat.
   Closing/reopening is not a replacement for the actual deferred profile render.

The five-second minimum exceeds the observed 3.12-s profile maximum; two seconds
exceeds the observed approximately 0.7-s release response. Neither is a guarantee:
recorded acceptance/deferred-render boundaries remain authoritative.

For Q-state proof without a mid-card snapshot, an unmeasured observer records the
accepted model's complete canonical key/value map, profile, scratch and acceptance/
operation ids. The analyzer compares exact values with the locked P/Q snapshot.
Use full equality rather than a hash-only claim. Perform serialization after the
timed described callback, before subsequent owner work is certified; record capture
clock and observed generation, and reject a superseded/missing observation. No
queue work is postponed. If later input supersedes Q before observation or its
following profile render, that Q operation is ineligible. Final P/test-scratch
verification under lock and eligible drain precede any pointer swap.

## One bounded recovery opportunity

After each card, while that runtime remains installed and the reference still
matches, the controller checks record integrity, per-class counts and operation
settlement before swapping. A lost sample is retained with its exclusion reason.
For a class short of its required count, it may request **one owner-approved
replacement packet per missing class per activation**. This is a new hands request,
not automatic authorization from the allowance or original card.

The request names the missing count and exact operations: one extra release plus
its restore; one extra P→Q→P cycle; one cold sample; or one launch/control pair,
as appropriate. A packet can supply more than one affected class, with explicit
operation ids and `replacementFor` references; it does not create multiple retry
opportunities. Diagnostic controls for an approved packet are administrative and
hidden before timing. Readiness/reference/capture checks still apply. A second
failure, a remaining deficit beyond that one packet, or an owner refusal makes
that stage inconclusive and returns to design. Capture loss, changed reference,
budget errors or identity faults are not repaired with replacement samples.

Ordinary callbacks continue on all observer failures. Never intercept/reorder
profile writes, drop queue work or defer the complete endDrag render. Wait for
explicit owner completion/stop, drain real work, then restore Prism and rotation.

## Continuous capture and durable originals

Use the generation/integrity collector from `0f54b6f`. Each observed file occurrence
has a unique increasing generation even when device/inode repeat. Validate saved
archives and source prefixes before new writes. Truncation, missing bytes or a
missed/ambiguous rotation invalidates collection; preserve it without migration or
reconstruction. Strict parsing requires contiguous ids from activation through
final drain and complete callback endpoints. Whole-activation error counts require
a complete corresponding raw window.

Run a foreground collector under the harness's tracked command mechanism. In
Codex, launch with a short `exec_command` yield and retain its `session_id`; the
controller can then issue the owner card and receive its asynchronous answer while
the tracked foreground process keeps collecting. No shell `&`, `nohup` or detached
job is used. This explicitly supersedes the frozen runbook's prohibition on a
background collector for **this harness-tracked foreground mechanism only**.

Use a **2-s maximum polling interval**. Log rotation is 1 MiB with only `.1` retained; r2 peaked near
366 KiB/min, about 168 s per file. Use **4 MiB/min** (over ten times that observed
peak) as the minimum covering-test rate, giving 15 s per file. Tests also emit the actual full
five-cold/five-launch/five-control/five-drag burst; use the higher of its measured
peak and 4 MiB/min, preserving host frame/input cadence and batched flushes rather
than averaging it over idle time or using offline Lua execution speed. Let T be
one file's fill time at that rate. Set the interval ≤min(2 s, T/4) and maximum
permitted collection gap ≤min(10 s, T/2); record both in the run manifest. At the
4-MiB/min test floor these are 2 s and 7.5 s respectively. Tighten them if the actual
full burst requires it. A gap beyond the bound is a fault, not a safe assumption.
If two rotations occur before collection, refuse even if the cadence seemed safe.

The stop condition is the card's identified diagnostic/owner operations complete,
expected P/test scratch verified and an eligible final drain archived. Emit a
checkpoint and finish the collector, but keep the probe installed until the owner
confirms completion or stop. An initial idle drain cannot satisfy the operation
ids. A tracked process timeout checkpoints and reports incomplete; the controller
resumes within the gap bound or invalidates the capture. Explicit stop or integrity
failure preserves files; it never swaps/restores the plugin during an unfinished
owner action. EXIT/TERM/INT cleanup reaps any collector children. The collector
itself changes no host state. The controller records process status and cleanup.

Keep private originals and scripts under
`$XDG_STATE_HOME/prism/panel-budget/` (default `~/.local/state/prism/panel-budget/`),
on a durable filesystem with private directories mode0700/files mode0600. Current
r2 evidence and builds are already hash-verified there in
`task3-2026-10-13-preserved`; its sibling manifest records all 565 files and bytes.
Do not launch its used nonces. New builds are reproduced from baseline
`9bf4e8e920c005f8a4d1666b32b4e1a516856ac2` and candidate
`e7384b0d7ab3e8e935cdf0776043839441132af5`, plus reviewed probe/builder revisions,
with new hashes/nonces and an explicit worktree CLI path. `/tmp` copies are not the
record. Portable attached archives remain the reviewable record, asserting every
measurement payload byte unchanged; raw originals remain private and durable.

## Verification and estimates before host requests

Focused fake-host checks cover both implementations and the complete stage paths:
readiness before sampling, automatic expansion/tree equality, cold rebuilding,
periodic callbacks, completed endpoint parsing and final operation-qualified drain.
Exercise closing before both release and Q describe acceptance, reopening, **P
clicked before Q describe acceptance**, collapsed cards and superseded Q evidence.
Assert the original callbacks/queue remain unchanged and missing classes cannot
be relabelled. Cover successful approved replacement, refusal and exhausted recovery.
Stage-aware numerical fixtures prove the decision table and unchanged full gate.

Collector checks cover deterministic A→B→A reuse, integrity refusal, polling gaps,
multiple rotations, and strict end-to-end parsing at the full burst rate defined
above. The first startup and final drain and all payload bytes must survive. Review
probe/controller/analyzer/estimator/runbook changes before any live request.

Record setup, every activation's reload/start-card, automatic intervals, actual
manual operation windows, final confirmation/verification, clean analysis and
restoration on declared monotonic clocks. Do not subtract different clock origins
without calibration. Never call owner/chat windows active hands time or replace
absent clean analysis with diagnosis/correction time.

Estimate each extended stage from its successful revised n=1 pilot. Its total is
measured desktop occupancy plus clean analysis, so fixed card/chat/controller costs
are counted once per activation. For Stage 1 add the four extra automatic cold units
per activation and four extra launch/control units per variant. For Stage 2 add four
extra cold units, four release/restore units and two profile round-trip units per
activation. Automatic unit intervals include setup/frame, completion and normal
between-unit readiness waits; manual units include the prescribed dwells. Apply
`ceil(seconds * 1.25 / 60)`, naming the 25% allowance. A missing field/gate means
no estimate; do not multiply one card's chat wait by every automated sample.
The implementation plan must provide exact timestamp mappings and numeric/boundary
fixtures for these stage-specific estimators.

Fresh host requests name the applicable pilot, its verdict, stage/counts, what
appears, rotation pause/restoration, expected occupancy and owner action windows.
An initial revised-pilot allowance is explicitly provisional, informed by r2's
17.5-minute diagnostics and roughly two-minute controller windows; the old
approximately ten-minute claim is not reused. The plan must name that allowance
before asking. A time estimate never terminates an unconfirmed owner action, and
25% allowance authorizes no replacement. Written spec and plan reviews precede
implementation; each pilot, stage or replacement needs fresh desktop permission.
