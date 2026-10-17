# Panel notice when the host has disabled it: brief

2026-10-17. Idea: `prism-ea3efb`. Goal: `prism-ab3a3d`. Source: the Follow-ups of
`docs/specs/2026-10-10-panel-render-budget-design.md`.

## Problem

When a panel callback overruns Noctalia's 25 ms budget three times running, or five times
in a minute, the host disables the panel runtime until reload. The sliders still move but
nothing applies. The only sign is one toast that is gone after 6 s. The user should be
told that the panel stopped and how to bring it back, without reading the log.

## Current behaviour and evidence

Host code, read from the owner's Noctalia fork at `7f547389f` (2026-09-29):

- **Each entry has its own runtime.** The bar widget, panel and service each get a
  `ScriptRuntime` (`plugin_widget.cpp:269`, `plugin_panel.cpp:215`), and health is
  tracked per runtime. When a runtime trips, `updateHealth` (`script_runtime.cpp:913`)
  calls `notifyUnhealthy` once, which posts `notify::error`. The panel then stops its
  tick timer and logs `plugin panel '<id>' disabled after repeated timeouts`
  (`plugin_panel.cpp:338`).
- **A disabled runtime drops events.** While a runtime is unhealthy, `enqueue` drops every
  event except Load, Reload, SoundLoadResult and Stop (`script_runtime.cpp:341`). Lua gets
  no flag and no callback.
- **A reload clears the disable.** A Reload clears `unhealthy` and its counters
  (`script_runtime.cpp:411`). When the panel's source file changes, `reloadScript` reloads
  the panel alone and re-runs `onOpen` if the panel is open. Upstream #3893 recovers a
  service the same way, by touching its source.
- **Entries can share state.** `PluginStateStore` (`plugin_state_store.h`) shares JSON
  values and watchers across one plugin's entry runtimes, through `noctalia.state.set`,
  `get` and `watch`. `widget.luau` already uses it for `originOutput`.
- **Plugins can notify.** `noctalia.notify` and `notifyError` are available
  (`luau_host.cpp:1766`).

Prism:

- **The panel already ticks.** While open it asks for second ticks (`panel.luau`
  `onOpen`, `onClose` and `update`), so a heartbeat would cost one state write per tick.
- **The cause is fixed, with little headroom.** `prism-dac509` (merged in `b777953`)
  measured in-host: drag frame about 8 ms, release 18 ms, cold rebuild 16 ms median and
  24 ms worst. `prism-9d063e` aims to bring cold renders under about 18 ms.
- **A disable can recur without a regression.** A 2026-10-06 comment on #3893 shows
  memory pressure pushing ordinary file reads past the budget.

Upstream: #3893 is still open (last updated 2026-10-12). It asks for three things: log
the disable, report it distinctly over IPC, and ideally recover on its own, per #3555
(closed, but the disable is still sticky on main). `prism-953f63` is preparing Prism's
own upstream report, which includes the missing plugin-visible disabled state.

## Constraints

- A disabled panel runs no Lua, so whatever notices the stall must run somewhere else:
  in the widget, a service entry, or the host.
- A disabled panel cannot announce its own close. The notice must not fire after a
  normal close, or for a panel that has never opened.
- Any check has to stay well under the budget in the runtime that runs it.
- The host side belongs to upstream (#3893). Prism prepares reports and the owner posts
  them (`prism-953f63`).
- A live probe opens windows on the desktop, so it asks the owner at that moment. The
  project declares no `[needs]` vocabulary. A `desktop` need could mark such steps once
  someone adds it.

## Alternatives

- **A. Heartbeat through shared state, with the notice in the bar widget (lean).**
  - Panel: `update()` writes a beat. `onOpen` and `onClose` set `panelOpen`, and the
    panel clears both values when it loads.
  - Widget: watches `panelOpen`, and while it is true checks the beat every 2 s or so.
    If the beat is more than 3 s old, it changes its glyph and tooltip ("Prism panel
    stopped; click to restart").
  - Click: restarts the panel, either by touching the panel source (a hot reload of the
    panel alone) or by disabling and re-enabling the plugin.
  - Cost: one state write per second while the panel is open, and a widget interval
    that runs only while the panel is open.
- **B. IPC probe.** The panel gets an `onIpc`. The widget, or a `prism` check, sends it a
  ping with `noctalia msg plugin khughitt/prism:panel`. A disabled runtime answers
  "plugin onIpc callback failed" (#3893). This relies on an error string that #3893 asks
  upstream to change, and it spawns a process for every probe.
- **C. Wait for upstream.** The host gets #3893's logging, a distinct IPC status and
  auto-recovery. Prism adds no code, and the user keeps only the 6 s toast until
  upstream acts.

Lean: A, if the probe confirms every step. C remains the long-term fix, and would retire A.

## Unanswered questions

1. While the panel is unhealthy, does the widget keep ticking and receive state pushes?
   Does touching the installed panel source (a symlink into this checkout for Prism,
   unless the host materializes a copy) clear the disable and re-run `onOpen`? The probe
   answers both: `prism-220e66`.
2. Is this insurance worth building before `prism-9d063e` lands its headroom? The owner
   decides when `prism-ea3efb` wakes.
3. Should a click restart the panel, or only explain how to? A restart means touching the
   plugin source or toggling the plugin. The owner decides, with the probe's result.
4. Does a notification from the widget add anything over the host's toast? The lasting
   bar glyph is the part the host lacks. The owner decides.

## Proposed decomposition

- `prism-ab3a3d`: the goal, with this brief as its source.
- `prism-220e66`: a probe plugin that answers question 1, then wakes `prism-ea3efb`.
- `prism-ea3efb`: waits on `prism-220e66`. When it wakes, either re-scope it as
  `planned` (two entries, a shared-state contract and a recovery action) or shelve it
  until a disable recurs.
- Related, with nothing waiting on them: `prism-953f63` (the upstream report) and
  `prism-9d063e` (cold-render headroom).
