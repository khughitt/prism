---
id: prism-a3484e
title: Revise profile loading and wallpaper tweaks after desktop acceptance
status: done
priority: 2
size: m
complexity: high
process: planned
owner: prism-aec90f
created: 2026-09-20T11:50:27Z
updated: 2026-09-20T14:15:07Z
started: 2026-09-20T11:50:52Z
completed: 2026-09-20T14:15:07Z
depends: []
parent: prism-aec90f
tags: [profiles]
agent: codex
spec: docs/specs/2026-09-20-profile-wallpaper-pairs-design.md
plan: docs/plans/2026-09-20-profile-wallpaper-pairs.md
---

User requests0 pending edits after loading a profile and restoration of prior tweaks for that profile/wallpaper pair. Draft and review amendment, then implementation plan; do not silently change the approved scratch-survival/global-wallpaper model. Stale edit count is tracked separately in prism-1cda51.

## Notes

- 2026-09-20T11:50:52Z (prism-aec90f): started
  provenance: {"harness_session":"codex:01a0bbd8-f021-7163-9af3-bf80490291a9","harness_session_source":"CODEX_SESSION_ID"}
- 2026-09-20T11:50:52Z (prism-aec90f): Draft amendment prepared from acceptance feedback:0 pending edits after selection, pair-scoped saved adjustments, outgoing auto-save proposed. Written-spec review is pending; implementation plan follows approval. No pair behavior implemented.
- 2026-09-20T11:52:23Z (prism-aec90f): Written draft submitted for user review. Recommended profile switch auto-saves pending edits to outgoing pair, loads incoming pair with0 pending edits; no-wallpaper selection discards pending edits. Separate implementation plan required after spec review.
- 2026-09-20T11:57:17Z (prism-aec90f): parked (waiting on user, review): Review docs/specs/2026-09-20-profile-wallpaper-pairs-design.md, especially outgoing-pair auto-save and no-wallpaper selection; after approval agent writes the implementation plan for separate review.
  provenance: {"harness_session":"codex:01a0bbd8-f021-7163-9af3-bf80490291a9","harness_session_source":"CODEX_SESSION_ID"}
- 2026-09-20T11:57:54Z (prism-aec90f): resumed
  provenance: {"harness_session":"codex:01a0bbd8-f021-7163-9af3-bf80490291a9","harness_session_source":"CODEX_SESSION_ID"}
- 2026-09-20T11:57:54Z (prism-aec90f): User approved the written amendment with outgoing-pair auto-save on2026-09-20. Writing implementation plan for required review; preserve subagent-driven execution method. Pair behavior is not implemented yet.
- 2026-09-20T12:02:46Z (prism-aec90f): User retest after count-fix reload reports2 real pending edits surviving profile switch. Confirmed this is the still-implemented old lifecycle, not the model-echo bug. Approved revision must auto-save those outgoing pair edits and start incoming selection at0; preserve existing live scratch through migration.
- 2026-09-20T12:11:40Z (prism-aec90f): Implementation plan drafted and self-reviewed: embedded look pairs, atomic active-plus-scratch runtime, explicit backed-up resumable migration preserving pending edits; three ordered direct children registered. Native dropdown does not emit same-option activation; CLI same-look transition and existing Keep for wallpaper cover current-pair save. Written plan awaits user review; no product implementation or live mutation.
- 2026-09-20T12:12:54Z (prism-aec90f): Implementation plan written and self-reviewed: docs/plans/2026-09-20-profile-wallpaper-pairs.md. Three registered steps; embed pairs with look settings and atomically publish slots/scratch. Explicit resumable migration preserves current pending edits. Native same-option dropdown event limitation documented; no Noctalia work added.
- 2026-09-20T12:12:54Z (prism-aec90f): parked (waiting on user, review): Review docs/plans/2026-09-20-profile-wallpaper-pairs.md; after approval resume prism-95e0d0 and execute the three steps using the already-selected subagent-driven method.
  provenance: {"harness_session":"codex:01a0bbd8-f021-7163-9af3-bf80490291a9","harness_session_source":"CODEX_SESSION_ID"}
- 2026-09-20T12:31:53Z (prism-aec90f): resumed
  provenance: {"harness_session":"codex:01a0bbd8-f021-7163-9af3-bf80490291a9","harness_session_source":"CODEX_SESSION_ID"}
- 2026-09-20T12:31:53Z (prism-aec90f): User review accepted architecture with three required amendments; applying all: broken-look recovery preserving scratch, idempotent migration without replay journal, and three green/reviewable cutover steps. After incorporation and verification, proceed under existing subagent-driven instruction.
- 2026-09-20T12:40:24Z (prism-aec90f): Applied all three user plan-review requirements and verified task drift: outgoing broken-look recovery preserves scratch, migration reruns current state with immutable backups and no replay machinery, combined cutover split into three children of prism-d513ec. Reviewed plan is ready for execution; sliders stay enabled and active-profile deletion exception is explicit.
- 2026-09-20T14:15:07Z (prism-aec90f): done
  provenance: {"harness_session":"codex:01a0bbd8-f021-7163-9af3-bf80490291a9","harness_session_source":"CODEX_SESSION_ID"}
- 2026-09-20T14:15:07Z (prism-aec90f): Implemented and reviewed pair-scoped profile loading, zero pending edits on selection, backed-up idempotent migration, guarded actions and interruption/concurrency coverage; final reopen fix re-reviewed, 464 Node tests plus Lua pass. Desktop acceptance remains prism-439774.
  provenance: {"harness_session":"codex:01a0bbd8-f021-7163-9af3-bf80490291a9","harness_session_source":"CODEX_SESSION_ID"}
