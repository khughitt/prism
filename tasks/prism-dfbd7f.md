---
id: prism-dfbd7f
title: "Panel render fires unthrottled on every slider onChange, blowing the Luau CPU budget"
status: done
priority: 1
size: s
complexity: mid
process: direct
owner: main
created: 2026-09-27T19:37:36Z
updated: 2026-09-27T19:44:39Z
started: 2026-09-27T19:38:04Z
completed: 2026-09-27T19:44:39Z
depends: []
tags: [noctalia, ui, performance, bug]
source: "noctalia.log 2026-09-27 15:11-15:32, panel.luau:260,377,463,542,550,565,566,748; presentation.luau:143"
model: claude-sonnet-5
agent: claude-code/claude-sonnet-5
---

beginDrag (panel.luau:377) calls render() on every native onChange event during a slider drag, rebuilding the whole panel tree (all sections, all 8 rack cards), with no throttle. Confirmed via noctalia.log: repeated 'async command callback ... exceeded its CPU budget' during real drag sessions, escalating to 'plugin panel disabled after repeated timeouts', which persists until the plugin is reloaded (closing/reopening the panel does not clear it). None of the visible glass/rack sliders are effectiveDrag=live (manifests are all liveness: reload), so the existing 100ms onFrameTick/sampleElapsedMs cadence never engages for them today; it only throttles the write, not the render. Fix: mark drag dirty instead of rendering inline in beginDrag, enable frame ticking for every drag (not gated to live mode), flush at most one render() per tick in onFrameTick, keep endDrag's forced final render for correctness.

## Notes

- 2026-09-27T19:38:04Z (main): started
  provenance: {"harness_session":"claude-code:a1b40d0e-02b3-4a01-b39c-d1f9501c1bd2","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-09-27T19:44:39Z (prism-dfbd7f): done
  provenance: {"harness_session":"claude-code:a1b40d0e-02b3-4a01-b39c-d1f9501c1bd2","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-09-27T19:44:39Z (prism-dfbd7f): Throttled render to one per frame tick during any slider drag (beginDrag marks dirty, onFrameTick flushes); regression test in plugin_test.lua and updated golden-source expectations in plugin-client.test.js; contract doc updated.
  provenance: {"harness_session":"claude-code:a1b40d0e-02b3-4a01-b39c-d1f9501c1bd2","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
