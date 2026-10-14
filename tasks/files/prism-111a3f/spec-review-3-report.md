Re-review (round 3): .worktrees/panel-budget/docs/specs/2026-10-13-panel-budget-capture-recovery-design.md

Verdict: accept. Nothing Critical or Important remains. Three Minor findings can be fixed in the spec or carried into the plan.

Round-2 findings, all resolved

- Collector lifetime: a yielded exec session no longer owns the collector. It now runs in a named tmux server with its own deadline and traps, and an emergency stop that never touches your default server. A 40-minute rehearsal across a real turn boundary comes before any desktop request. I checked the tmux claims locally: the install is tmux 3.8, and exit-empty, exit-unattached and remain-on-exit all exist as named.
- Decision precedence: the first matching row wins, "complete cold evidence" requires both blocks, and unknown is not zero. Fixtures now cover one complete failing block with the other incomplete, and complete colds with an incomplete error count.
- Collector cost: collection is one long-lived loop that reads only new bytes, with full checks at readiness, rotation and finish. Poll and sample overlap is reported and nothing is discarded.
- Recovery packet: one combined packet per activation, with a worked example.
- Directory modes: the wording now matches the actual 0755 parent and 0700 contents.

Keeping row 5's return-to-design policy is consistent with the rest of the table.

Minor

1. The 5-minute controller allowance has no stated boundaries. The 35-minute collector lifetime is 20 (card) + 10 (recovery) + 5 (controller). The collector has to start before the plugin is enabled, because strict parsing needs records from activation startup. So that 5 minutes must cover three things:
   - the controller's checks before the card;
   - the completeness check after the card;
   - your delay in approving a recovery packet.

   If those overrun, the 10-minute recovery window shrinks without anyone noticing. The cost is a lost recovery opportunity, not corrupt data. State where each window starts and ends, and size the allowance from controller step times measured in the smoke run.
2. Who starts the rehearsal's next turn. In Codex the next turn starts only when you send a message. "Explicitly arrange the next controller turn" should say that you send it after the 45-minute watchdog, and the park should name that as your action (--waiting-on user).
3. The clock check sits in the wrong gate. A headless rehearsal with a synthetic producer can't exercise Noctalia's os.clock binding. If the producer uses Python's time.monotonic, it would pass the shared-origin check trivially. Base that check on reading the binding's source plus r2's existing agreement: in C2, a probe record's timestamp was 294942.885 and the controller's next phase stamp was 294942.898. Make the plan's pre-pilot check the one that fails, not the rehearsal.

For the author's ledger: review: spec round 3 — verdict: accept; findings: Minor 3; reviewer: claude-code/claude-opus-5-5

Keith: approved for planning
