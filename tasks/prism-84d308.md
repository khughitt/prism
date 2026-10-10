---
id: prism-84d308
title: "Prism panel keys from the shared vocabulary: ctrl+s, j/k focus, h/l nudge, r random, 1-9 profiles, ? help"
status: doing
priority: 2
size: l
complexity: mid
process: direct
owner: prism-84d308
created: 2026-09-09T02:28:45Z
updated: 2026-10-10T13:00:26Z
started: 2026-09-16T14:24:55Z
depends: []
tags: [quick-add, noctalia, keyboard, cross-project]
source: "mindful:thought:1784d44106a5411bb28a90796f46acf4"
---

Implement the shared vocabulary (navigation, copy, random, save) in integrations/noctalia-plugin via capture_keys and onKey, then design prism-specific keys: profile save/load (prism-ea6344 added named profiles), parameter focus and nudging, section jumps. Scope after the ops goal settles the vocabulary.

## Accepted suggestions

- Digits 1-9 load named profiles; s saves the current one; ? overlays the bindings.
- Set keyboard_focus = "exclusive" so keys work on open. Escape already dismisses.
- Beyond the shared set, consider j/k to move parameter focus and h/l to nudge the focused slider.

## Notes

- 2026-09-16T09:36:27Z (main): Rescoped 2026-09-16 to the ops plan docs/plans/2026-09-16-key-vocabulary.md Task 5 (spec docs/specs/2026-09-15-key-vocabulary-design.md in ops). First step is the live ctrl+s check; blocked until ops keys.toml (Task 1) is on ops main.
- 2026-10-10T12:50:19Z (prism-84d308): resumed
  provenance: {"harness_session":"claude-code:278111ef-4125-4213-8e3c-7758b3cad216","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-10T12:50:19Z (prism-84d308): Resumed 2026-10-10 on .worktrees/prism-84d308, fast-forwarded to main (272 commits). ops keys.toml now carries the 21 prism rows, so the Task 1 block is gone. Plan drift: profiles are now looks with commit/keep, so 5a ctrl+s maps to the bookmark (keep edits in the loaded look, profile or Default; submits an open save-as or rename field) instead of the plan's save-under-name/open-save-as. Noctalia source (src/shell/panel/panel_manager.cpp, key_chord.cpp) confirms digits, F1, arrows, ctrl+s and shift+question parse; a focused text input keeps plain printable keys, but captured Left/Right/Up/Down preempt it.
- 2026-10-10T12:56:56Z (prism-84d308): 5b-5d adapted to the current panel: focus registers in controlCell (rack mix cells included, unfocused before focused); h/l/arrows and j/k stand down while the name field is open, since captured arrows preempt the focused input (cursor keys in the name field are lost while the panel captures them). 5c digits share the selector's pick path (pickProfile, extracted). Roll stays one set per slider; the one-command reset random is recorded on prism-284a61 because it needs an ops cli.toml row. 5d: tools/keys.toml adopted from ops d4bf4ba via vendored adopt (the plan's cp predates it); conformance test bites when the r row is removed. just gate green.
- 2026-10-10T13:00:26Z (prism-84d308): review: impl round 1 — verdict: revise; findings: Important 3, Minor 4; reviewer: claude-code
