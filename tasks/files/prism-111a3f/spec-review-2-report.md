Re-review (round 2): .worktrees/panel-budget/docs/specs/2026-10-13-panel-budget-capture-recovery-design.md

Verdict: revise. Two Important findings and three Minor ones. Both Important fixes are small.

All ten round-1 findings are addressed, and the claims I could check hold:
- Durable originals: 565 files under ~/.local/state/prism/panel-budget/task3-2026-10-13-preserved, on ext4. The directory is mode 0700 and the manifest 0600.
- Auto-expand: panel.luau never persists expansion, so expanding the cards in the probe changes no owner state.
- Stage 1 dwell: r2's diagnostics ran from click to sequence-complete in about 0.33 s for one cold plus one pair. Five units should still finish well inside the 5 s dwell.
- Arithmetic: the time table sums to about 96 min, and 4 MiB/min gives 15 s per file, a 2 s polling interval and a 7.5 s gap bound, as stated.
- Decision table: the staging table matches Part 5's keep rule and its rule that a cold median ≥15 ms returns to design.

Important

1. The collection mechanism relies on an unverified Codex capability, and hq recorded a counterexample today (lines 239–244, 262–263)
- The counterexample: hq's docs/notes/2026-10-13-codex-command-lifetime-brief.md describes a yielded exec_command session (Codex 0.162.1) killed by an unexplained SIGTERM about 13 minutes in, while its controller was waiting. The research that would settle Codex's exec-session lifetime, hq-5e067c, is still todo. That research also covers the case of a turn ending, which is exactly what the spec relies on when it hands the owner a card and waits.
- The resume clause can't work: "the controller resumes within the gap bound" (7.5 s) is impossible once the controller has ended its turn to wait for the owner, because Codex doesn't wake a controller when a child exits. Any collector exit mid-card would invalidate the capture, and nobody would see it until the owner replies.
- Fix:
  - Choose a mechanism with a known lifetime. Either wait for hq-5e067c's capability fact, or use a named tmux server or user systemd unit with an explicit stop, a recorded pid and EXIT/TERM traps, under the Processes rule. Narrow the runbook supersession to whichever mechanism is chosen.
  - Make the collector one long-lived loop whose lifetime covers the longest permitted card window, not runs that need an external restart.
  - Add a rehearsal that doesn't need the desktop: run the chosen mechanism against a synthetic rotating log, across a real turn boundary, for longer than the longest card window, before any host request.

2. Precedence in the decision table is ambiguous on the one path that changes production code (lines 114–131)
- Row 1 (incomplete evidence → inconclusive) and row 2 ("either complete cold block fails gain → revert") overlap in two cases:
  - one block is complete and fails gain, while the other block is incomplete;
  - the cold evidence is complete, but the budget-error count is not.
- Lines 128–131 imply both blocks must be complete, but the table never says which row wins.
- Fix: state that rows are evaluated in order. Define "complete cold evidence" as five valid colds per implementation in both blocks, plus complete error, identity and correctness evidence. Add a fixture for the case of one block complete and failing with the other incomplete.

Minor

1. Collector cost at 2 s polling. The current logs.py collect re-reads and re-hashes every prior archive and re-reads the current segment from its start on every call. At a 2 s cadence that is continuous I/O and SHA-256 work, and perhaps an interpreter start per poll, running alongside elapsed-time samples judged against a 1 ms gain floor. Matching keeps the comparison fair between B and C, but the load adds variance, which inflates MAD, and pushes the absolute targets upward. Use incremental verification inside the long-lived loop, with full checks at checkpoints. Log each poll's start and end on the shared monotonic clock so analysis can report overlap with samples.
2. Recovery-packet wording (lines 211–220). "One packet per missing class per activation" conflicts with "a packet can supply more than one class… does not create multiple retry opportunities". Say whether an activation that loses both a release render and a Q render gets one combined packet or two.
3. Directory mode. Line 270 says private directories are 0700, but panel-budget/ itself is 0755. Its contents are private, so either chmod it or reword the line to name the preserved directory.

Your call

Row 5 sends a cold pass with short launch groups back to design, rather than allowing a launch-only recollection. That is defensible and consistent, but it is a policy choice for you, not a defect.

For the author's ledger: review: spec round 2 — verdict: revise; findings: Important 2, Minor 3; reviewer: claude-code/claude-opus-5-5
