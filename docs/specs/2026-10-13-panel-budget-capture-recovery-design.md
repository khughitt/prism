# Recover complete panel-budget measurements

**Date:** 2026-10-13
**Status:** proposed; written owner review required before implementation planning.
**Parent:** `prism-f15cbf`, original render-budget Task 6.
**Authority:** [the render-budget design](2026-10-10-panel-render-budget-design.md),
Parts 1–5, including the unchanged targets and token keep/revert rule.

## Intent and evidence

Obtain complete, matched in-host measurements with less owner coordination time.
Production tree shape, rendering, command order, refresh cadence and synchronous
release correction stay unchanged. This revision concerns the scratch experiment
and its controller. It does not select a release/completion optimization.

The stabilized B1→C1→C2→B2 pilot completed its owner actions with wallpaper rotation
paused, but did not establish its collection gate:

- B1, C1 and C2 preserve complete record sequences. Each has one cold and one
  release sample. C2 lacks the Q profile-render sample.
- C2 closed before its Q describe was accepted. Its reopening render occurred
  about 145 seconds later under the open classification. It cannot substitute
  for the absent deferred profile render. The records do not establish why the
  panel closed.
- B2 reused an earlier log inode. The collector overwrote that occurrence's
  archive and lost 1,096 records. A final settled drain does not repair the loss.
- Desktop occupancy was 95.976 minutes. Recorded owner-action windows include
  chat, settling and controller waits; they are not active hands time. The pilot
  does not supply complete inputs to the approved full-session estimator.

The portable evidence and collector correction are attached to `prism-4ba651` as
`task3-r2-evidence-and-collector-fix.tar.gz`. Complete cold samples range from
19.713 to 21.382 ms; releases from 18.528 to 25.524 ms. These are exploratory
single samples. Two single launch/control comparisons do not establish a primary
aggregate or a causal conclusion. B2's whole-activation budget-error count is
unknown, although live monitoring observed zero errors.

Disposition remains `comparison=inconclusive`, `accepted=false`,
`return_to_design=true`. Tokens remain on the isolated branch without performance
acceptance. Tasks 7–8 stay gated.

## Choice

Use grouped activation instructions and independent capture/settlement checks.
The owner receives one complete action card for each activation and confirms once
after those actions. The controller verifies intermediate boundaries from records
and canonical snapshots, rather than requiring a chat answer after every action.

Repeating the existing many-confirmation pilot would retain its observed pace and
the risk of closing between a profile action and its deferred render. Requesting
the full comparison immediately would scale a protocol whose collection gate
failed. Changing production scheduling would address a different question without
the required primary launch evidence. Those approaches are deferred.

## Capture integrity

Use the corrected collector committed in `0f54b6f`. Each observed file occurrence
has a monotonically increasing generation and its own archive, even when device
and inode repeat. Preserve the initial byte offset, all subsequent bytes and
generation order. Check saved archive bytes and the previously captured source
prefix before publishing the next manifest. Missing or changed bytes, truncation,
ambiguous files or missed rotations invalidate collection and preserve the files.
Old manifests are evidence; they are not migrated into successful captures.

The controller runs collection throughout owner actions through a foreground,
harness-tracked process with bounded resumable runs and explicit cleanup. It does
not depend on a chat reply to collect another segment. No detached job is used.
The collector never opens Prism, changes focus, changes profiles or writes settings.
A collection failure is reported promptly; it does not remove the installed probe
or restore state while an owner action may still be in progress.

Preserve raw originals. Portable copies must retain every measurement payload
byte exactly. Require contiguous record ids from startup through the final drain,
valid identities and complete callback endpoints before a dataset is complete.
An observed zero-error window cannot stand in for an incomplete activation's count.

## Grouped owner protocol

Keep the four fresh-runtime activations and opposite block order. The controller
still owns installation, nonce/hash verification, readiness, swaps and restoration.
Changing only the symlink or closing/reopening never counts as a fresh runtime.
Pause automatic wallpaper rotation before snapshots and restore its exact prior
runtime state after restoring Prism, including on failure or stop.

For each activation, provide one action card listing expansion, the diagnostic
button, the selected unedited slider and its own restore control, and the P→Q→P
cycle. Include the instruction to keep Prism visible through each settled response
and to finish all actions before returning to chat. The smallest pilot retains one
case of each operation per activation; it does not silently add samples or retries.
Owner scratch, original profile and documents are saved from that session, and
the current P/Q pair must change most canonical values in both directions.

The observer records each actual operation and its ensuing settlement. Readiness
and verification work runs outside measured callbacks; measured trees remain
production-equivalent. The controller checks the restored slider, empty test
scratch, expected profile, canonical values and eligible drain before each swap.
An owner confirmation alone cannot satisfy those checks.

For Q and P separately require an accepted profile change and its following actual
deferred profile render while the panel is open. For the slider require the actual
release, completion, accepted changed response, following ordinary deferred render
and restoration. Keep origin/classification distinctions and periodic callbacks.
Do not relabel an opening render, cold setup or profile render to fill another class.

If the panel closes during an unsettled operation, preserve the close/describe/open
timeline and mark the affected class missing. The action card may instruct the
owner to reopen Prism and restore P, but reopening does not validate that sample.
No automatic repeat is authorized. A missing class, input conflict, budget error
or capture failure makes the pilot inconclusive. The controller waits for explicit
owner completion or stop, drains real work, and restores the exact saved state.
Ordinary production callbacks continue; observer failure must not reorder or drop
commands or postpone the complete release render.

## Verification before another desktop request

Add focused fake-host checks for the grouped protocol before live use. Exercise
the successful one-case path through classification, strict parsing, final drain
and an explicitly insufficient-samples verdict. Also exercise close before profile
describe acceptance, reopening, unchanged describes, periodic refreshes and a
failed settlement. Assert that a reopened render cannot fill the missing class,
and that failure leaves ordinary queue/frame behavior intact.

Use the deterministic A→B→A collector regression and integrity refusals. Add a
small end-to-end capture check that combines rotation with emitted protocol records
and proves that the first startup and final drain survive strict parsing. Run
these checks on both frozen implementations. Review changes before host use.

Obtain fresh permission for the revised smallest live pilot, naming the original
96-minute attempt, its failed collection gate, what the new protocol changes, and
a provisional duration clearly distinguished from a measured estimate. Written
spec and implementation-plan approval do not grant desktop use. Do not request the
extended comparison until the revised pilot has exercised every gate successfully.

## Duration and performance decisions

Record setup, reload/expansion, diagnostics, release/restore, Q/P settlement,
analysis and restoration boundaries on a declared monotonic clock. Record actual
desktop occupancy separately from action windows. For each estimator field,
state which timestamps supply it and whether the required gate was observed.
Do not replace absent analysis duration with diagnosis time or substitute a short
Luau cold interval for the owner/controller time needed to invoke that operation.
The implementation plan must resolve that accounting in the estimator and add a
boundary fixture before another extended-run duration is quoted.

The successful pilot is still inconclusive on performance because it has n=1.
Only then estimate and request the full session. Preserve the existing full counts:
four activations, five colds and five releases/restores per activation, three
P→Q→P cycles per activation, and five launch pairs plus five controls per variant
in block 1. Collect at least five valid samples in every required target class per
implementation per block. Extra/replacement actions need fresh permission.

Cold/profile medians must be <15 ms; drag, release, changed-describe and ordinary
deferred-render medians must be ≤12 ms; the complete session must add zero budget
errors. Require five valid pairs in the same completion-state group for each
primary launch/control aggregate. Keep/revert retains the exact two-block MAD/1-ms
rule from Part 5, without pooling blocks or crediting tokens for unexplained release
cost. Any incomplete comparison returns to design. A scheduling proposal requires
its own reviewed design and plan preserving FIFO and synchronous endDrag correction.
