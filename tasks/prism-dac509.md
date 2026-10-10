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
updated: 2026-10-10T16:28:09Z
started: 2026-10-10T16:20:49Z
depends: []
tags: [noctalia, performance]
agent: claude-code/claude-opus-5-5
spec: docs/specs/2026-10-10-panel-render-budget-design.md
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
