---
id: prism-dac509
title: Panel renders overrun the host's 25 ms callback budget and Noctalia silently disables the panel
status: doing
priority: 1
size: m
complexity: high
process: planned
owner: fix/panel-render-budget
created: 2026-10-10T16:18:11Z
updated: 2026-10-10T17:40:26Z
started: 2026-10-10T16:20:49Z
depends: []
tags: [noctalia, performance]
agent: claude-code/claude-opus-5-5
spec: docs/specs/2026-10-10-panel-render-budget-design.md
plan: docs/plans/2026-10-10-panel-render-budget.md
---

Observed 2026-10-10 12:10-12:12 (~/.cache/noctalia/noctalia.log): while dragging sliders inside expanded rack cards (Edge profile, refraction), five callbacks exceeded the host's per-callback CPU budget within 70 s: three slider onDragEnd (panel.luau endDrag's single render), one onFrameTick, two async command callbacks (described: decode + validate + render). Noctalia then logged 'plugin panel khughitt/prism:panel disabled after repeated timeouts' and stopped calling the panel for the session; sliders move but nothing applies and no error shows. Budget rules (Noctalia src/scripting/script_runtime.cpp): 25 ms worker-thread CPU per call, 3 consecutive or 5 per 60 s timeouts disable the runtime until reload. ui.render reads the whole tree back into the host inside the callback (plugin_bindings.cpp luau_ui_render), so tree size counts as well as Lua work.

Root cause: the render outgrew the budget. Offline count on the live describe (83 params, 12 rack devices): one render is ~7.1k Lua calls / 15k line events with cards collapsed, ~8.5k / 18.7k with every card expanded (174 vs 276 rows). On 2026-09-30 (prism-831604) a whole render was ~5.6k budget checks at 10-14 ms in-host; calls alone are now 27-52% above that, so a render sits at or over 25 ms with expanded cards. The prism-84d308 keyboard change adds 3 calls per render (7099 -> 7102); not the cause.

Recovery until fixed: noctalia msg plugins disable khughitt/prism && noctalia msg plugins enable khughitt/prism; keep rack cards collapsed.

Remedies to weigh (folded from prism-5172ea): render only what changed, or cache per-model Presentation derivations (gates, attachedSwatches, rack, sections are recomputed every render); move described()'s render to the next frame tick so decode/validate and render land in different callbacks; throttle drag renders below frame rate; shrink the tree (fewer wrapper rows/props per cell); ask Noctalia upstream to meter the budget without a clock_gettime per Luau interrupt and to surface a disabled panel to the user. Acceptance: an in-host measurement (os.clock + noctalia.log per callback, as in prism-831604) of render with every card expanded, describe-with-change, and endDrag, each with clear headroom under 25 ms, plus an offline call-count regression test so growth is caught in the suite.

## Notes

- 2026-10-10T16:20:49Z (main): started
  provenance: {"harness_session":"claude-code:35b76d69-d243-4ef3-a0bc-e3117438b797","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-10T16:20:55Z (fix/panel-render-budget): resumed
  provenance: {"harness_session":"claude-code:35b76d69-d243-4ef3-a0bc-e3117438b797","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-10T16:28:08Z (fix/panel-render-budget): Host facts (Noctalia main, 2026-10-10): budget covers whole pcall incl. json.decode and panel.render readback; ui.* are pure Luau ctors; no partial-update API; frame tick/state.watch give a fresh budget; host does post a one-time 'Plugin disabled' notification. Offline (live describe 71 KB): render 7.1k calls/458 nodes collapsed, 8.5k/741 expanded; changed describe 12k. Spec: retained subtrees keyed by content signatures, handlers resolve by key, per-model structure cache, describe render deferred to next frame tick; coroutine-spread rebuild only if full rebuild >15 ms in-host.
- 2026-10-10T16:28:12Z (fix/panel-render-budget): parked (waiting on user, review): Owner reviews docs/specs/2026-10-10-panel-render-budget-design.md in .worktrees/panel-budget; on approval the agent runs writing-plans
  provenance: {"harness_session":"claude-code:35b76d69-d243-4ef3-a0bc-e3117438b797","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-10T16:32:19Z (fix/panel-render-budget): review: spec round 1 — verdict: revise; findings: P1 2, P2 1; reviewer: codex
- 2026-10-10T16:32:19Z (fix/panel-render-budget): Spec review: signatures omit rendered metadata (range/ui/select values/description/effective.from); optional coroutine rebuild lacks invalidation and synchronous endDrag correction rules; nested retention must keep descendant memo entries alive on a parent cache hit. Review report in the current Codex turn; spec unchanged.
- 2026-10-10T16:35:06Z (fix/panel-render-budget): resumed
  provenance: {"harness_session":"claude-code:35b76d69-d243-4ef3-a0bc-e3117438b797","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-10T16:36:05Z (fix/panel-render-budget): Spec revised for round 1: signatures = per-entry describe digest (json.encode of each param/device as decoded) + listed panel-side fields; bottom-up composition, eviction only at model acceptance against the new structure's ids; top rows no longer retained; coroutine fallback removed (a >15 ms full rebuild returns to design); metadata-only and retention-reach tests added.
- 2026-10-10T16:36:05Z (fix/panel-render-budget): parked (waiting on user, review): Owner re-reviews docs/specs/2026-10-10-panel-render-budget-design.md (round 2) in .worktrees/panel-budget; on approval the agent runs writing-plans
  provenance: {"harness_session":"claude-code:35b76d69-d243-4ef3-a0bc-e3117438b797","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-10T16:48:59Z (fix/panel-render-budget): review: spec round 2 — verdict: accept; findings: none; reviewer: codex
- 2026-10-10T16:48:59Z (fix/panel-render-budget): Reviewed revision 965caf6 against all three findings: full describe-entry digests plus panel-side inputs and metadata equivalence cases cover signature completeness; coroutine fallback removed behind an explicit measured redesign gate; structure-based eviction and retention-reach tests preserve descendants. No further blocking findings. In-host callback costs, including digest generation, remain implementation acceptance checks.
- 2026-10-10T16:51:31Z (fix/panel-render-budget): resumed
  provenance: {"harness_session":"claude-code:35b76d69-d243-4ef3-a0bc-e3117438b797","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-10T17:06:25Z (fix/panel-render-budget): parked (waiting on user, review): Owner reviews docs/plans/2026-10-10-panel-render-budget.md and picks an execution method; then the agent executes Task 1 (prism-5d4e76)
  provenance: {"harness_session":"claude-code:35b76d69-d243-4ef3-a0bc-e3117438b797","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-10T17:13:22Z (fix/panel-render-budget): review: plan round 1 — verdict: revise; findings: P1 3, P2 3; reviewer: codex
- 2026-10-10T17:13:22Z (fix/panel-render-budget): Plan review: nudgeFocused computes from old focusOrder tables between model acceptance and deferred render; removed-section resetScope returns nil to ipairs; slider lifecycle harness lacks json.encode and describe tick updates. Acceptance must cover fresh-entry cold/profile renders before ceiling work; Luau os.clock is CLOCK_MONOTONIC elapsed time, not thread CPU; direct lua test commands violate the just test front door. Plan unchanged; full findings in current Codex turn.
- 2026-10-10T17:19:45Z (fix/panel-render-budget): resumed
  provenance: {"harness_session":"claude-code:35b76d69-d243-4ef3-a0bc-e3117438b797","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-10T17:22:16Z (fix/panel-render-budget): Plan revised for review round 1: nudge resolves the focused key through current(); resetAction returns when its section is gone; commitAction clears the current model's edits; lifecycle harness gets the encoder (Task 3) and a tick in host.complete (Task 4); in-host gate moved to Task 6 before ceilings (Task 7), measures a cold fresh-decode rebuild and a real profile switch; os.clock defined as elapsed upper bound, gate on medians of >=5 samples plus zero host budget errors (spec clarified); all runs through just test-fast.
- 2026-10-10T17:22:17Z (fix/panel-render-budget): parked (waiting on user, review): Owner re-reviews docs/plans/2026-10-10-panel-render-budget.md (round 2) and picks an execution method; then the agent executes Task 1 (prism-5d4e76)
  provenance: {"harness_session":"claude-code:35b76d69-d243-4ef3-a0bc-e3117438b797","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-10T17:30:08Z (fix/panel-render-budget): review: plan round 2 — verdict: revise; findings: P1 2, P2 1; reviewer: codex
- 2026-10-10T17:30:08Z (fix/panel-render-budget): Reviewed aee152d: current-key nudge, removed-scope no-op, current-model Keep, lifecycle host updates, cold fresh-decode probe, reordered acceptance gate, elapsed-time labels and test front door address prior findings. Remaining: Tasks 3/4 git add omit test/plugin-panel-lifecycle.test.js; Task 6 tail -200 can discard all five cold samples after hundreds of drag tick lines; an elapsed maximum above target cannot be attributed to scheduling noise from a passing median and zero 25 ms budget errors. Tests intentionally remain for execution; plan unchanged.
- 2026-10-10T17:35:03Z (fix/panel-render-budget): resumed
  provenance: {"harness_session":"claude-code:35b76d69-d243-4ef3-a0bc-e3117438b797","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-10T17:35:28Z (fix/panel-render-budget): Plan revised for review round 2: Tasks 3-4 commit test/plugin-panel-lifecycle.test.js; probe logs a run marker and the collection reads every line after a recorded log offset into a per-run file; acceptance refused with fewer than five samples in any required class; an over-target sample under a passing median is recorded as unknown cause unless host-load evidence shows contention.
- 2026-10-10T17:35:28Z (fix/panel-render-budget): parked (waiting on user, review): Owner re-reviews docs/plans/2026-10-10-panel-render-budget.md (round 3) and picks an execution method; then the agent executes Task 1 (prism-5d4e76)
  provenance: {"harness_session":"claude-code:35b76d69-d243-4ef3-a0bc-e3117438b797","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-10T17:37:53Z (fix/panel-render-budget): review: plan round 3 — verdict: revise; findings: P1 1; reviewer: codex
- 2026-10-10T17:37:53Z (fix/panel-render-budget): Reviewed 254ee27: prior three findings addressed on the normal path. Remaining retry defect: a fresh START excludes the load-only prism-probe-run marker, so RUN becomes empty; collection overwrites the dataset; sample-count retries occur after Step 4 restored the main plugin, so Step 3 produces no probe lines. Check completeness while the probe is installed, retain original START/RUN for missing-step retries, and restart reload plus all cases after rotation. Plan unchanged; tests remain execution checks.
- 2026-10-10T17:39:55Z (fix/panel-render-budget): resumed
  provenance: {"harness_session":"claude-code:35b76d69-d243-4ef3-a0bc-e3117438b797","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-10T17:40:26Z (fix/panel-render-budget): Plan revised for review round 3: completeness is checked in a new Step 4 while the probe is installed; retries keep the original START and RUN and rebuild the whole run's file; log rotation records a new offset, reloads the probe for a fresh marker, and repeats every case; the pointer is restored (Step 5) only after a complete run or the user stopping; the gate (Step 6) takes only a complete run.
