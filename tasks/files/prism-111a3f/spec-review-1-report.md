# Review: `.worktrees/panel-budget/docs/specs/2026-10-13-panel-budget-capture-recovery-design.md`

**Verdict: revise.** Five Important findings and four Minor ones. The disposition is sound: nothing gets relabelled, the thresholds and keep/revert rule are unchanged, and desktop permission stays gated. Grouping is the right direction. But the r2 records show a failure mechanism the spec says is unknown, and the protocol as written leaves that mechanism in place.

I checked the spec's factual claims against the r2 evidence archive and they all hold: the cold and release ranges, the 1,096 lost B2 records, the 145 s reopen and the 95.976 min occupancy. I extracted that archive to a temp directory and deleted it afterwards. Nothing in the repo, the task records or the host was changed.

## Important

**1. The panel-close race is systematic, it hit two classes, and the action card gives the owner no cue to avoid it** (spec lines 22–24, 85–88)
- **Profile switches:** across all 7 in r2, click-to-accepted-describe took 2.71–3.12 s. The owner closed the panel 2.8–6.6 s after clicking.
  - B1's Q render beat the close by 1 ms.
  - C2's Q lost by 150 ms (close record 2739, describe accepted in 2740).
- **Slider release:** C1's panel closed 0.607 s after release, 83 ms before that write's describe was accepted (0.690 s). C1's release deferred render is therefore missing too; its only ordinary deferred render came from the restore. The spec reports only the C2 loss.
- **Cause:** the records show 8–10 open/close pairs per activation, one for each return to chat. That handoff pattern is the cause, whichever key closed the panel.
- **What grouping leaves open:** it removes the mid-card handoffs. But the owner's apparent "done" cue arrives at the same moment as acceptance, the card's last action still ends in a return to chat, and nothing stops a P click before Q has settled.
- **Fix:** put fixed dwell times in the card, taken from these latencies. For example, keep the panel open at least 5 s after each profile click and at least 2 s after a release or restore. Base the cue on the Prism panel visibly changing, not the desktop changing. Add a fake-host case where P is clicked before Q's describe is accepted.

**2. One lost sample still voids the whole pilot, with no in-session recovery** (lines 105–110)
- Continuous collection lets the controller spot a missing class before the swap, while the probe is still installed.
- The parent plan already allows owner-approved additional actions while an activation remains valid (Task 3 Step 5).
- **Recommendation:** after each card, the controller checks class completeness from the records. It may then request one owner-approved replacement per missing class in that activation. The replacement is recorded as such and the original loss is kept.
- **Full session:** without dwell rules and at r2's loss rate (about 1 in 7 profile switches), 6 switches for ≥5 needed gives roughly a 60% chance that some activation comes up short.

**3. The collection mechanism is underspecified** (lines 65–70)
- **Hand-off to the owner:** a foreground collector blocks the controller's turn, but the owner's single confirmation arrives at a turn boundary. The spec needs a stop condition, such as records showing the card's final settle, and needs to say how collection covers the wait. The frozen runbook also says "No background collector is authorized."
- **Polling cadence:** `noctalia.log` rotates at 1 MiB and keeps a single `.1` backup. The collector refuses when two rotations fall between collects.
  - r2 peaked at 354–366 KiB/min, which fills 1 MiB in about 2.8 min, and that was with n=1 actions.
  - Full-session bursts (5 cold pairs, 5 launch pairs, 5 drags) will be denser.
  - The spec should set a polling interval derived from the measured peak rate with margin, and the end-to-end capture check should run at the full session's burst rate.

**4. The frozen implementations and raw originals live on tmpfs** (lines 57, 72, 125)
- `/tmp/prism-budget-task3-prep` (119 MB) holds the stabilized builds, the controller scripts and the private raw originals. `/tmp` is tmpfs, and the host has been up since 2026-10-10.
- The attached archive holds only normalized portable copies. Its original-file hashes refer to the private originals.
- A reboot before the next pilot would erase the "frozen implementations" that line 125 depends on.
- **Fix:** name a durable private location, or state that builds are reproduced from their commits and the portable archive is the record.

**5. The spec omits the cheapest path, which the approved rules already allow** (lines 42–53)
- Cold samples and launch/control pairs come from one diagnostics click per activation. In r2 the automated parts took 0.037 s (cold pair) and 0.2 s (launch pair).
- Part 5 already says complete cold comparisons that fail the gain rule mean revert, and a full-rebuild median ≥15 ms returns to design.
- Every exploratory sample misses the targets: colds 19.7–21.4 ms, profile renders 17.5–22.8 ms.
- **Proposed staging:**
  1. Stage 1: cold samples plus launch pairs in both blocks, with no slider or profile actions. This would likely settle revert/return-to-design and the launch question in minutes of owner time.
  2. Stage 2: collect the owner-heavy classes only if cold passes the gain rule.
- **What it needs:** your approval, since it amends Part 5's one-session requirement. It also needs a `decide()` path for it, because the plan's `decide()` returns inconclusive whenever any class is short, which is stricter than the parent spec's text.
- This is a priority call for you. I recommend staging.

**6. The readiness gate is ambiguous inside a grouped card** (lines 80–81, 94–97)
- Parent Step 4.5 has the controller verify expansion, P, canonical values and scratch before any samples count. In a grouped card the owner goes straight from expanding to the button.
- **Suggested split:**
  - The controller checks canonical values, scratch and P before giving the card, since expansion doesn't change them.
  - The probe confirms expansion (`allRackExpanded` and `expandedIds` already appear in drain records).
  - The diagnostics sequence refuses to run, or marks its samples ineligible, if any card is collapsed.

## Minor

1. **Time breakdown missing.** Controller-only work took about 2 of the 96 minutes. The owner/chat windows dominate:
   - expand: 24.0 min
   - diagnostics: 17.5 min, for an automated sequence of about 0.04 s
   - release/restore: 22.5 min
   - Q/P: 30.2 min

   That grounds the choice, and it should acknowledge the original "~10 minute" pilot estimate. Optionally, a probe-side "expand all" in the button's unmeasured callback would remove the largest bucket.
2. **Q-state check has no replacement.** r2 snapshotted canonical values while Q was active, and a grouped card leaves no pause for that. Name what replaces it, for example a canonical digest in the accepted-describe record, written outside the timed region.
3. **Scope not listed.** The spec doesn't say which artifacts change: the probe, controller loop, collector, runbook, analyzer or estimator. A changed probe means new builds and nonces.
4. **Readability:**
   - It is hard to review on its own: B1…B2, P/Q, "eligible drain", "frozen implementations" and "completion-state group" are never defined.
   - The header lacks the spec's own task, `prism-111a3f`.
   - "Most canonical values" (line 91) should say ">half", as the runbook does.
   - The 25.524 ms release reads like a budget overrun until you note it is `os.clock` elapsed time, an upper bound on thread CPU.

For the author's ledger: `review: spec round 1 — verdict: revise; findings: Important 6, Minor 4; reviewer: claude-code/claude-opus-5-5`
