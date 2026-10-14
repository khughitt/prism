# Recover complete panel-budget measurements

**Date:** 2026-10-13
**Status:** approved for planning by owner after spec review round 3 (accept,
Minor 3). The window, next-turn and clock-gate clarifications below fold those
minors into the approved design. Plan review round2 accepted; Task1 incremental collector/lifecycle is prepared and reviewed through d20c9c0. Task2 schema2 probe is prepared/reviewed through bfb6e68. Task3 analyzer is prepared/reviewed through d26c638 after two corrective rounds; Task4 controller/runbook/clock-verifier implementation is prepared/reviewed through0776753. Broad Tasks1–4 review and two corrective waves accepted through25ba964;48-file scratch pipeline prepared/reviewed with synthetic full-workload/capacity proofs. Accepted-freeze short proof passed; Task5 preparation and bounded phase instrumentation were independently reviewed through442689f. Three actual headless rehearsals failed (read metadata, timing guard, publication metadata); all are preserved, all owned processes have exited, and those failed captures remain incomplete. The active-source visibility correction and receipt/progression fixes are prepared and independently reviewed through `9243616`; exact-source short proofs passed. The fresh headless run launched on 2026-10-14 at 20:17:56 UTC passed root strict verification after a distinct human turn at 21:47:52 UTC, beyond the 21:02:56 UTC watchdog. It produced 2,424.882 seconds and 1,637,984,592 exact captured bytes across 1,600 segments, with complete protocol/phase/turn proof and all five owned identities and the socket gone. The [portable lifetime result](../../tasks/files/prism-ac904e/task5-active5-lifetime-result.tar.gz) imports saved evidence without rerunning the verifier. Independent Task5 result review remains pending and Task5 stays open. This verifies the synthetic named-wrapper lifetime gate; live-session clock rebinding, concrete host commands, fresh desktop permission and performance acceptance remain pending.
**Task:** `prism-111a3f`; parent `prism-f15cbf`, original render-budget Task 6.
**Authority:** [the render-budget design](2026-10-10-panel-render-budget-design.md),
Parts 1–5. The staging exception below is approved with this design and plan; all
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
incremental collector and tmux wrapper, runbook/action cards, analyzer and estimator, their focused
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
completeness inputs. **Evaluate the table in order; the first matching row wins.**
Complete cold evidence means ≥5 valid colds for each implementation in **both**
blocks, complete identity/reference/integrity and correctness evidence, and a
complete error count for the corresponding capture windows. Unknown is not zero.
Row 1 also rejects a known nonzero budget-error count or failed correctness check.
Only after these preconditions pass with zero errors may the analyzer compute the
original baseline MAD and strict gain >max(1 ms, MAD) independently in both blocks.
Do not pool blocks. A complete failing block cannot override an incomplete other
block or an incomplete error count.

| Stage 1 result | Disposition |
| --- | --- |
| Cold evidence as defined above is incomplete or invalid, or errors/correctness fail | `comparison=inconclusive`, `accepted=false`, `return_to_design=true`; no Stage 2. This row takes precedence over every later row. |
| Row 1 does not apply, and either cold block fails the gain rule | `comparison=revert`, `accepted=false`, `return_to_design=true`, reason `cold_gain_failed`; owner-heavy classes explicitly `not_run`. Revert the isolated token change through a fix subagent, green fast suite/gates and scoped review. |
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
prove the incomplete cold case cannot reach that exception, including **one
complete block failing gain with the other block incomplete**, and **both cold
blocks complete with error evidence incomplete**. Both must return inconclusive
without reverting. Equality at gain is failure, 15 ms is failure, a short launch
group cannot advance a cold pass, and pending Stage 2 is never accepted. After the
single recovery opportunity, short launch groups return to design; a separate
launch-only session is not authorized by this protocol.

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
For classes short of their required counts, it may request **one combined,
owner-approved replacement packet per activation**, covering all recoverable
deficits found after the initial card. This is a new hands request, not automatic
authorization from the allowance or original card. The packet has at most one
additional operation unit of each needed type; no class gets a later packet.

The request names the missing count and exact operations: one extra release plus
its restore; one extra P→Q→P cycle; one cold sample; or one launch/control pair,
as appropriate. If both a release-origin deferred render and a Q profile render
are missing, request **one packet containing one release/restore and one P→Q→P
cycle**, not two packets. Keep explicit operation ids and `replacementFor`
references for every supplied class. Diagnostic controls for an approved packet are administrative and
hidden before timing. Readiness/reference/capture checks still apply. A second
failure, a remaining deficit beyond that one packet, or an owner refusal makes
that stage inconclusive and returns to design. Capture loss, changed reference,
budget errors or identity faults are not repaired with replacement samples.

Ordinary callbacks continue on all observer failures. Never intercept/reorder
profile writes, drop queue work or defer the complete endDrag render. Wait for
explicit owner completion/stop, drain real work, then restore Prism and rotation.

## Continuous capture and durable originals

Retain the generation/integrity contract from `0f54b6f`, while changing collection
to one long-lived Python loop. Each file occurrence has a unique increasing
generation even when device/inode repeat. Open the interpreter once. Read only
new bytes after the current offset, append them to its private archive and update
an incremental hash. Ordinary polls check file identity/size and saved archive
metadata; they do not reread or rehash every prior archive.

Perform full hash and captured-source-prefix checks at readiness before target
collection, at rotation before sealing the outgoing occurrence, and at final
completion. A sealed archive is written once and checked again at the final
checkpoint. An unexpected identity/size change or integrity failure stops
certification. Truncation, missing bytes or missed/ambiguous rotation invalidates
collection; preserve without migration or reconstruction. Incremental polling is
provisional until the full checks pass. Strict parsing still requires contiguous
ids from activation through final drain and complete callback endpoints, and a
whole-activation error count needs a complete corresponding raw window.

Use a **dedicated named tmux server**, `prism-budget-capture-<run-nonce>`, with one
`capture` session, a private wrapper and `/dev/null` configuration. Set
`exit-unattached=off`, `exit-empty=on` and `remain-on-exit=off` explicitly. Refuse an
existing socket/session. Record the exact socket name, server/wrapper/collector
pids and process start identities in the run manifest. Never use or kill the
owner's default tmux server. The exact emergency stop is
`tmux -L prism-budget-capture-<run-nonce> kill-server`, with the actual nonce printed
in the controller's process report. Wrapper EXIT/TERM/INT/HUP traps signal and reap
only its recorded children and preserve an exit receipt; stopping the named server
must exercise that cleanup. The last pane's exit lets the isolated server exit.

This supersedes the frozen runbook's background-collector prohibition **only for
this named, cleanup-owned tmux mechanism**. Do not use a yielded Codex exec session
as the collector's lifetime owner. `hq-5e067c` remains unresolved; hq's
`docs/notes/2026-10-13-codex-command-lifetime-brief.md` records a yielded session
terminated by unexplained SIGTERM after about 13 minutes and a successful named
tmux workaround. Local tmux 3.8 documentation describes detached session lifetime;
the turn-boundary rehearsal below is an additional gate, not an assumed Codex fact.

The **maximum initial card window is 20 minutes**, announced before permission;
one approved combined recovery has a **10-minute maximum**. The same collector
runs uninterrupted across both, with a **35-minute total lifetime** including a
five-minute controller/checkpoint allowance. Its wrapper enforces that deadline
without requiring a controller restart. A window expiry makes the activation
incomplete and forbids further test operations; it is not permission to close the
probe or overwrite settings during an unfinished owner action. The controller
waits for explicit completion/stop and drains before restoring. No automatic restart
can repair a collector exit or missed gap, even if it was brief.

The collector starts **before enabling the probe**, at `collectorStarted`, so
activation startup cannot be lost. The initial 20-minute window begins at
`initialCardIssued` and ends at the owner's `initialCompleteReceived` or stop.
Recovery's 10-minute window begins at `recoveryCardIssued` after explicit approval
and ends at `recoveryCompleteReceived` or stop. Controller time comprises startup
through the initial card, checks after either completion, recovery request through
approval, preparation of its card, and final checkpoint/finish. Those intervals
consume the five-minute allowance; they are not silently charged to recovery.

Measure the pre-card, post-card and finish steps in the offline controller smoke.
Require `ceil(1.25 * sum(controllerStepSeconds)) + 120 s ≤300 s`, reserving at least
two minutes for an approval response. The smoke's IPC is fake; record that limit
and check actual elapsed controller time during live setup. If the requirement
does not fit, revise the allowance before requesting the desktop. Before initial
card issuance, reserve its full 20 minutes, a full 10-minute recovery and the smoke's
remaining controller-step reserve. Before offering recovery, set an explicit
approval deadline that reserves the full 10-minute card plus final checks within
the original 35-minute deadline and remaining controller allowance. After a late
approval, report that recovery is unavailable; never issue a shortened packet.

If a collector spans a controller turn boundary, that turn's process report names
its pids/socket, deadline and exact stop command, alongside `host-load`. The next
turn inspects the independently saved heartbeat/exit receipt and archives. No
collector exit is assumed to wake Codex. The controller does not end a turn merely
to await the collector's result; the independently running collector exists to
cover the separately authorized owner card or turn-boundary rehearsal.

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

Record each poll's start/end, bytes and verification/checkpoint work on the same
host monotonic origin as samples, verified by the separate pre-pilot clock gate.
If a shared origin cannot be established, that gate fails before desktop permission;
do not infer overlap from log-arrival times. Analysis reports overlap counts and
timing distributions by class/block and collector/checkpoint duration. Preserve
all target samples; do not subtract collector work from elapsed times or discard
overlap solely to improve a verdict. Include collector cost in both matched runs.

An operation-qualified eligible drain creates a full checkpoint and a `cardSettled`
receipt. Keep the loop alive while the controller checks completeness and offers
the single combined recovery. Its normal stop is an explicit controller `finish`
after that decision and final verification. On finish, checkpoint and exit, keeping
the probe installed until owner completion/stop. Initial idle state cannot satisfy
the card's operation ids. Deadline, stop, integrity failure or unexpected exit
preserves incomplete evidence; none changes the plugin or owner state. The
controller records receipts, process status and cleanup before parking.

Keep private originals and scripts under
`$XDG_STATE_HOME/prism/panel-budget/` (default `~/.local/state/prism/panel-budget/`),
on a durable filesystem. Private capture subdirectories and the preserved root
are mode 0700, their regular files and manifest mode 0600; the namespace parent
`panel-budget/` may be 0755 and contains no readable private data. Current r2
evidence and builds are already hash-verified there in
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
above. Cover incremental reads, modified sealed archives, captured-prefix changes
detected at sealing/checkpoints, and exact poll/sample overlap reporting. The first
startup and final drain and all payload bytes must survive. Review
probe/controller/analyzer/estimator/runbook changes before any live request.

First run a seconds-long synthetic smoke of the same wrapper through normal finish,
full integrity checks and emergency cleanup. Then, before any desktop request, run
a **40-minute headless rehearsal across a real controller turn boundary**, longer
than both the 20-minute initial card and the 35-minute live collector limit. Use
only a synthetic rotating log and the isolated named tmux server. Publish its
process identity/deadline/stop command in the first turn; explicitly arrange the
next controller turn: **Keith sends a message after the 45-minute watchdog**.
Park with `--waiting-on user` naming that message as his next action. Inspect
persisted receipts on that turn. A tool yield inside one turn is not a turn-boundary test.

This lifetime rehearsal has a fixed, **headless-only 45-minute watchdog**, so it
can test persistence beyond the live 35-minute cap. The synthetic producer emits
for at least 40 minutes, then emits a final operation-qualified drain and `finish`.
The collector must capture all records, checkpoint and exit without restart; the
producer is reaped and the dedicated server disappears. Test the live 35-minute
expiry separately with a controlled clock and require an incomplete exit receipt.
The headless watchdog exception grants no longer live card window.

No real plugin, focus, profile or timer is changed. Separately prove emergency
`kill-server` reaps the wrapper/collector/producer and leaves receipts. Report poll
gaps, all captured ids/bytes and server/process exits; any unexplained exit or gap
fails. The rehearsal wrapper owns its 45-minute watchdog and cleanup, so a late
next turn leaves no process running. Do not rely on the process to notify or wake
the harness.

The synthetic rehearsal proves process lifetime, polling and cleanup, not the
Noctalia clock. A separate **pre-pilot gate** reads the installed host's os.clock
binding and its clock implementation, records source/version evidence that its
origin agrees with Python time.monotonic, and checks r2's existing agreement:
C2's probe timestamp294942.885 was followed by the controller phase stamp294942.898.
That approximately13-ms difference is consistent with event/receipt ordering;
it is corroboration, not a clock-source proof. Missing, mismatched or unverifiable
binding evidence blocks the live request. A synthetic Python producer cannot
satisfy this gate.

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
