---
id: prism-ec3fcb
title: Show the source swatch and lock beside the color source select
status: done
priority: 3
size: s
complexity: mid
owner: main
created: 2026-10-03T11:48:36Z
updated: 2026-10-03T12:05:17Z
started: 2026-10-03T12:03:05Z
completed: 2026-10-03T12:05:17Z
depends: []
parent: prism-980a29
tags: [ui]
---

Owner suggestion at acceptance of prism-b4d118 (2026-10-03): instead of a separate read-only Color/Tint row behind a lock, draw the reported swatch and lock next to the Color source / Tint source select, and show the picker row only under manual. Ring: Color source + Color fold into one row. Tint: the two tint keys report the same palette tint, so one swatch suffices beside Tint source; under manual the focused/unfocused Tint matrix row returns. Needs a ui key naming the select a gated color attaches to (or derive it from ui.when.param).

## Notes

- 2026-10-03T11:48:36Z (main): concerns: prism-b4d118 change — owner prefers the read-only swatch inline with its source select
- 2026-10-03T12:03:05Z (main): started
  provenance: {"harness_session":"claude-code:cdbf3439-02fd-4207-b3d7-5364ff22abe6","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-03T12:04:57Z (prism-ec3fcb): Ring: Color row drops out under non-manual; swatch+lock sit beside Color source (derived from ui.when.param, no new key). Tint: swatch+lock beside Tint source in the expanded card; the Tint mix row is the card head and cannot be hidden, so it keeps its own read-only cells.
- 2026-10-03T12:05:17Z (prism-ec3fcb): done
  provenance: {"harness_session":"claude-code:cdbf3439-02fd-4207-b3d7-5364ff22abe6","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-03T12:05:17Z (prism-ec3fcb): Source swatch and lock draw beside the gating select; ring Color row shows only under manual
  provenance: {"harness_session":"claude-code:cdbf3439-02fd-4207-b3d7-5364ff22abe6","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
