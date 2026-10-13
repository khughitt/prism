What this change does: The collector now names archives by generation as well as device/inode, preserving separate A→B→A occurrences in collection order. It checks saved archive hashes and captured source prefixes before writing. The frozen r2 evidence remains incomplete and explicitly unaccepted.

Reviewer: **codex/gpt-6.1-sol**. Scope: corrective review of `38f0167..0f54b6f`, prior finding I1, and correction/evidence integrity.

**I1 — ADDRESSED.** In the committed archive’s `correction/logs.py:15–58`, sequential generations produce unique archive paths despite inode reuse. Existing archives require matching length, SHA256 and offsets; source prefixes must equal previously captured bytes. Collection retains segment order and repeated collection adds no duplicates. Old manifests refuse collection rather than silently migrating damaged evidence.

The saved RED test loads the preserved pre-fix collector and fails specifically at “A to B to A inode reuse must preserve all ordered generations.” The saved GREEN output passes that case, generation/path uniqueness, repeated collection, and refusal of corrupted/missing archives, changed prefixes and invalid generations. The fixture maps temporary files to deterministic inode identities while retaining real reads and renames; it meaningfully exercises the original defect.

**New findings: Critical 0; Important 0; Minor 1.**

1. **The report conflates two parser errors** — `.worktrees/panel-budget/.superpowers/sdd/2026-10-11-panel-budget-tokens-and-launch/task-3-report.md:572`.
   
   The strict concatenated parser’s saved error is `Expecting ':' delimiter: line 1 column 379 (char 378)`. “Unterminated string” is the separate third-segment diagnostic. Change the sentence to distinguish those errors, or simply say the strict parser fails with `JSONDecodeError`. Leaving it unchanged misstates the diagnostic without changing the missing-record analysis or acceptance verdict.

Evidence integrity checks passed:

- Archive SHA256 matches the reported `9004822cfc191861d49e920db99aced089300c9556b70c5d9fc6e9bf337b4b2f`; all 60 listed portable-file hashes match.
- All 67 original files match both preserved copies and recorded hashes. Portable raw files preserve all **12,583 measurement payload byte strings**.
- B1/C1/C2 saved analyzer events equal original segment-order payloads, with unique complete record sets of **1,136 / 1,810 / 3,093**.
- B2 strict parsing fails. Records **1290–2385**, totaling **1,096**, remain missing. Prefix and tail diagnostics remain separate; neither is promoted into repaired acceptance evidence.
- C2 contains the accepted Q describe after close and the later open render, but no Q `profileRender`. The report correctly retains that missing class.
- Launch/control groups remain count 1 with `primary=false`. `observedBudgetErrors=0` is monitoring evidence; whole-pilot/B2 budget completeness remains false.
- Saved timestamps support **5,758.535 seconds / 95.976 minutes** occupancy. Missing estimator inputs remain null, with no full-run estimate.
- Saved snapshots support profile/scratch/document/canonical restoration and Q-state checks. The saved timer restoration result reports restored activity, inactive service and preserved configuration. Pointer/plugin/panel restoration remains controller-reported; I performed no live verification.

**Spec verdict:** Accept the collector correction and incomplete-evidence disposition. Task 3 acceptance remains incomplete: `accepted=false`, `return_to_design=true`. Original sample counts and `<15 ms` / `≤12 ms` targets remain unchanged. The missing C2 class, damaged B2 interval and measured pace require the controller’s written design revision before another live run.

**Quality verdict: Ship the correction, with the minor report wording finding recorded or corrected.**

Out-of-scope observations are the already documented C2 gate loss and 96-minute pilot pace. This review authorizes no production/probe/queue change or live retry.

Checks were read-only archive, code, saved-output and in-memory integrity inspections. I did not rerun suites or focused calibration, write files, mutate tasks/indexes, invoke host controls, or dispatch agents. All review commands finished; no process was left running.
