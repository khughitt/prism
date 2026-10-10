---
id: prism-f15cbf
title: In-host measurement and the 15 ms gate
status: doing
priority: 1
complexity: mid
process: direct
owner: fix/panel-render-budget
created: 2026-10-10T17:06:10Z
updated: 2026-10-10T20:04:19Z
started: 2026-10-10T18:43:57Z
depends: [prism-b81188]
parent: prism-dac509
tags: []
agent: claude-code/claude-opus-5-5
plan: docs/plans/2026-10-10-panel-render-budget.md
step: "Task 6: In-host measurement and the 15 ms gate"
---

## Notes

- 2026-10-10T18:43:57Z (fix/panel-render-budget): started
  provenance: {"harness_session":"codex:01a126fc-fa1d-7c71-8177-24d23ad4bf26","harness_session_source":"CODEX_THREAD_ID"}
- 2026-10-10T18:47:14Z (fix/panel-render-budget): Task 6 Step 1 prepared at /tmp/prism-task6-panel-budget-utpxfsy5/probe-plugin from 75dd7e6; exact probe instrumentation/capture key verified; noctalia plugins lint: 0 errors, 0 warnings. Live pilot approval requested; no desktop use, pointer change, timing collection or gate verdict yet.
- 2026-10-10T18:48:34Z (fix/panel-render-budget): parked (waiting on user, approval): Owner approves the brief live pilot; agent installs the linted /tmp/prism-task6-panel-budget-utpxfsy5/probe-plugin, collects one case per callback class with the owner, restores the original pointer, and reads the pilot before requesting the full measurement
  provenance: {"harness_session":"codex:01a126fc-fa1d-7c71-8177-24d23ad4bf26","harness_session_source":"CODEX_THREAD_ID"}
- 2026-10-10T18:51:45Z (fix/panel-render-budget): resumed
  provenance: {"harness_session":"codex:01a126fc-fa1d-7c71-8177-24d23ad4bf26","harness_session_source":"CODEX_THREAD_ID"}
- 2026-10-10T18:52:59Z (fix/panel-render-budget): Fresh pilot approval: owner said Proceed. Pilot offset/original pointer/profile/scratch snapshot saved under /tmp/prism-task6-panel-budget-utpxfsy5; full >=5-sample acceptance run remains unapproved.
- 2026-10-10T18:59:58Z (fix/panel-render-budget): Pilot complete, original main-checkout plugin pointer restored and plugin reloaded. Cold expanded render 20.71 ms (n=1), release 18.70 ms (n=1); zero new host budget errors. Full acceptance gate not passed; analyze pilot before another live run.
- 2026-10-10T19:00:25Z (fix/panel-render-budget): Pilot profile switch cleared the four original scratch keys; restored each saved key/value through explicit worktree bin/prism set after returning to glass9. Fresh describe confirms original profile and full scratch map exactly match the saved baseline.
- 2026-10-10T19:01:38Z (fix/panel-render-budget): Correction to prior restoration note: CLI set restored values but removed redundant scratch entries equal to the fallback, so that first exact-map assertion failed. Used existing writeScratch under withLock with expected glass9/empty scratch guards to restore exact saved map. A fresh describe now verifies glass9 and all four scratch-held key/value pairs exactly.
- 2026-10-10T19:09:10Z (fix/panel-render-budget): Full live acceptance freshly approved. Pilot-added values removed from original wallpaper pair under guarded lock; current newer wallpaper selection preserved. Full runtime and all profile YAML documents backed up; scratch cleared through explicit worktree bin/prism reset revert before probe installation. Full run offset saved separately from pilot.
- 2026-10-10T19:20:52Z (fix/panel-render-budget): Full run 1791659395: cold and drag phase acknowledged complete; coldRender median/max/n 21.39/23.65/5 ms, dragEnd 19.26/20.77/7 ms, zero new budget errors at current collection. Profile-switch completion prompt pending; probe pointer still installed and explicitly recorded on parent. No gate acceptance or code changes.
- 2026-10-10T19:25:41Z (fix/panel-render-budget): Full run stopped at approved 15-minute window with no profile-phase samples. Probe uninstalled; original main pointer restored/reloaded, all profile documents unchanged, glass9 and saved scratch restored exactly and applied. Cold 21.39 ms median (n5) and release 19.26 ms median (n7) miss targets; dataset incomplete for formal whole gate; no cost ceilings recorded.
- 2026-10-10T19:27:14Z (fix/panel-render-budget): Restoration verified: all canonical values match pre-full snapshot, glass9 and exact scratch match saved runtime, all profile YAML documents byte-identical to full snapshot. Active wallpaper changed independently, so latest selection was preserved and whole describe differs only active/derived metadata. No session processes left running.
- 2026-10-10T19:33:34Z (fix/panel-render-budget): Profile-phase completion arrived after controller restored probe too early; switches therefore ran on original main plugin and no probe switch timings exist. Two CPU budget errors were logged on original plugin after probe removal, outside measured run. Verified late glass9 profile change was exactly saved scratch committed to current wallpaper; restored original profile YAML bytes and exact scratch under lock, preserving latest wallpaper. Applied and reloaded original plugin; no source changes.
- 2026-10-10T19:37:21Z (fix/panel-render-budget): attached: task-6-measurement-report.md (3925 bytes): In-host callback medians, incomplete switch phase, and verified restoration
- 2026-10-10T19:37:21Z (fix/panel-render-budget): attached: full-1791659395-results.json (9265 bytes): Raw timing samples and phase-separated statistics for measured probe run 1791659395
- 2026-10-10T19:37:21Z (fix/panel-render-budget): attached: full-1791659395.log (104766 bytes): Probe-only log for measured run 1791659395
- 2026-10-10T19:40:55Z (fix/panel-render-budget): parked (waiting on user, decision): Owner reviews attached measurement report; agent revises spec part 5 with cold 21.39 ms n5 and release 19.26 ms n7 and addresses missing switch measurements before any new implementation or ceiling tests
  provenance: {"harness_session":"codex:01a126fc-fa1d-7c71-8177-24d23ad4bf26","harness_session_source":"CODEX_THREAD_ID"}
- 2026-10-10T19:59:03Z (fix/panel-render-budget): Next step recommendation: validate measurement harness before redesign. Old Task 6 probe uses getfenv(1), which Luau performance docs say deoptimizes the affected environment; clean production .luau has none. Local Noctalia pushCallback dynamically uses lua_getglobal at dispatch, so direct global replacement avoids need for getfenv. New coarse diagnostic prepared/linted at /tmp/prism-budget-diagnostic-3_avin1d/probe-plugin; no host actions. Earlier timing impact unknown; split render/native readback and enqueue/runAsync in next short approved live pilot. Source: https://luau.org/performance/
- 2026-10-10T20:04:19Z (fix/panel-render-budget): parked (waiting on user, approval): Owner approves short live diagnostic; agent runs /tmp/prism-budget-diagnostic-3_avin1d/probe-plugin with one expanded cold press and one drag/release, distinguishes construction/readback and enqueue/native-launch cost without getfenv, restores saved state after explicit completion, then updates spec/plan only if production misses persist
  provenance: {"harness_session":"codex:01a126fc-fa1d-7c71-8177-24d23ad4bf26","harness_session_source":"CODEX_THREAD_ID"}
