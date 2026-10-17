# Plan review (round 1): `.worktrees/panel-budget/docs/plans/2026-10-13-panel-budget-capture-recovery.md`

**Verdict: revise.** One Important finding and five Minor ones. The plan is well grounded: nearly every claim it makes about the frozen code holds, and every numeric fixture is correct.

## What I verified

- **Preserved inputs:** every file named in Workspace exists under `~/.local/state/prism/panel-budget/task3-2026-10-13-preserved`, including all of `frozen-task2/`.
- **Fake host:** `self-check.lua` really has `host(dir, probe)` with two arguments and the manual 12-card expansion. `h.tick` is a function, `h.frame` is the boolean, and `button` matches on `props.text`. The modes `pending-ready`, `readiness`, `periodic` and `sequence` all exist, and `integrity-check.py` takes the flags exactly as written.
- **Diagnostics button:** `Sample diagnostics` (`build.py:67`) appears whenever the model is present and the button isn't hidden, so it can be clicked with cards collapsed.
- **Production code:**
  - Expanding a card is just `state.expanded[device]` followed by `render()`, so setting it directly is equivalent.
  - `selectionPending` is set when a profile is picked and cleared when the describe is accepted, so an early P click really is ignored.
  - `Presentation.holds(param, "scratch")` exists.
  - No commit after `e7384b0` touches `integrations/`, so the token revert would apply cleanly.
- **Tools:** `luac -p panel.luau` passes, `noctalia plugins lint` exists, and `tasks park … --waiting-on user` is valid syntax.
- **Arithmetic:**
  - The decision fixture's precedence cases come out right.
  - Gain at exactly 1.0 fails and 1.000001 passes.
  - The estimator fixtures give 5 and 8 minutes, and the formulas match the spec.
  - Step reserves of 144 s and 144.000001 s give 180 (fits) and 181 (refused).
  - Remaining lifetimes of 620 s and 630 s are refused and allowed.
  - The overlap fixture gives exactly one overlap.
- **Task chain:** the seven children run Task 1 → Task 7 in a straight line. Task 1 is blocked until the plan is approved.

## Important

**1. The turn-boundary proof in Task 5 names a source that can't show a turn boundary.** Task 5 says "Root supplies first/next real harness-turn identifiers via task lifecycle provenance", and `verify` fails without next-turn proof. But task provenance records only `harness_session: codex:<CODEX_THREAD_ID>`. That id is the same for every turn of a session: the controller's notes from 19:52 and 22:11 carry the same one. So `verify` would either always fail, or pass on proof that can't tell one turn from two.
- **Fix:** read the Codex rollout with the session-logs tools. Record the turn that started the rehearsal and ended, and your message after the watchdog that opened the verify turn, with their timestamps. Keep the task's park and resume notes as corroboration only.

## Minor

1. **The collector's `finish` depends on a schema that doesn't exist yet.** Task 1 says `finish` needs "settled proof for its operation ids", but `cardSettled` is only defined in Task 2. Either define the minimal record contract in Task 1 (`schema: 2`, `class: cardSettled`, `operationIds`, run and nonce), or make the controller the verifier and have `finish` only checkpoint.
2. **Overlap needs sample start and end times, and nothing emits them.** Probe records set `timestamp=os.clock()` when the record is built, after the timed region (`probe.lua:16`). Task 3 Step 4 consumes sample start and end, but Task 2 adds no such fields. Have Task 2 emit `startTimestamp`/`endTimestamp` for target samples, as the cold-pair and launch-pair intervals already do (`tail.lua:48`, `tail.lua:165`).
3. **Task 2's first failing test would fail for the wrong reason.** The fake host's `json.encode` only copies records with `schema == 1` into `h.emitted` (`self-check.lua:34`). After the switch to schema2, `lastRecord(h, 'ready')` would fail because nothing was captured, not because the feature is missing. Update the hook in Task 2 Step 1, accepting 2 and rejecting 1.
4. **The wording suggests the controller stays active during a card.** "Poll readiness/phase records independent of chat" (Task 4 Step 5) and "controller receives records continuously" (Task 6 Step 3) can be read that way. The spec's design is that the collector captures continuously while the controller has ended its turn, and the controller reads the records at its own turns. Say so, so nobody builds a loop that keeps the turn open and blocks your reply.
5. **Nits:**
   - The tech stack says Lua 5.4, but this host's `lua` and `luac` are 5.5.1.
   - The 40-minute rehearsal at 4 MiB/min or more writes at least 160 MiB of synthetic raw log. State that it stays private and only a hash inventory is attached.
   - The Task 5 park could carry `--reason`.

For the author's ledger: `review: plan round 1 — verdict: revise; findings: Important 1, Minor 5; reviewer: claude-code/claude-opus-5-5`

Next comes the controller's plan revision, then your written plan approval to unblock `prism-73a117`.
