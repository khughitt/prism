Plan re-review (round 2): .worktrees/panel-budget/docs/plans/2026-10-13-panel-budget-capture-recovery.md

Verdict: accept. All six round-1 findings are fixed. Three Minor points can be folded in during execution.

Round-1 findings resolved

- Turn-boundary proof: verify now needs a TURN_PROOF.json built from the Codex rollout with the session-logs tools. Task provenance is demoted to corroboration, and fixtures reject a single turn with two parks and session-only proof. I checked the rollout claims against the controller's own session file (Codex 0.162.1), and they hold:
  - task_started comes before the serialized user message.
  - task_started, task_complete and item_completed all carry turn_id.
  - AGENTS.md and environment_context text is injected as role=user messages, so the plan is right to require the session-logs classifier.
- Collector vs settlement: the collector now only checkpoints bytes and reports integrityComplete. The controller verifies cardSettled and publishes protocolComplete separately.
- Sample endpoints: target samples emit startTimestamp/endTimestamp, and overlap never reconstructs them from the record time. The wrappers it names exist as described: diagnosticCallback (probe.lua:29) and render around diagnosticPlainRender (tail.lua:1–10).
- Schema hook: switching the fake host to schema2 is now a setup step done before the failing test, so that test fails for the intended reason.
- Controller turns: the controller ends its turn for each card and reads records only on its own turns.
- Nits: the Lua version is corrected to 5.5.1, the synthetic raw log stays private with only an inventory attached, and the park carries a reason.

Minor

1. Use the rollout's explicit human-trigger fields. Each task_started carries turn_attribution.turn_trigger ("user" throughout this session), and each human message produces an item_completed record of type UserMessage with that turn's id. Requiring both is sturdier than relying on message position plus the classifier. It also excludes turns started by a child agent's message, which this multi-agent session can produce.
2. Say whether the card handoff parks. Task 6 Step 3 now says to restore "before any park that hands off beyond an authorized owner card". That implies a park during a card can happen with the probe installed and rotation paused. If the controller parks there, the global pointer rule requires that park note to name the standing plugin pointer and the paused timer, with how to restore each. If it only ends the turn without parking, say so.
3. Park reason nit. --reason review in Task 5 Step 4 doesn't describe waiting for your post-watchdog message. Nothing is under review at that point, and the reason feeds outcome measures. dependency fits better.

For the author's ledger: review: plan round 2 — verdict: accept; findings: Minor 3; reviewer: claude-code/claude-opus-5-5
