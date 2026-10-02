---
id: prism-f71919
title: Expose the resting ring level in the Ring group (glass.ring.rest)
status: done
priority: 1
size: s
complexity: low
process: direct
owner: prism-f71919
created: 2026-10-02T00:09:28Z
updated: 2026-10-02T01:16:22Z
started: 2026-10-02T01:05:27Z
completed: 2026-10-02T01:16:22Z
depends: [material-1d70db]
tags: [material, noctalia]
agent: claude-code/claude-opus-5-5
---

Prism half of material-1d70db: emit ring-rest from glass.ring.rest (0 = no resting ring, 1 = today's level) next to glow, with defs/migration/render-fixture/apply coverage like glass.ring.decay (prism-cd219b). Hold off prism main until the niri carrying ring-rest is installed.

## Notes

- 2026-10-02T01:05:27Z (main): started
  provenance: {"harness_session":"claude-code:cebfaf5f-51dd-49c1-ae0b-f56f976f9f14","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-02T01:05:28Z (prism-f71919): resumed
  provenance: {"harness_session":"claude-code:cebfaf5f-51dd-49c1-ae0b-f56f976f9f14","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-02T01:16:22Z (prism-f71919): done
  provenance: {"harness_session":"claude-code:cebfaf5f-51dd-49c1-ae0b-f56f976f9f14","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-02T01:16:22Z (prism-f71919): glass.ring.rest (0-3, default 1, Ring group 'Resting ring' after Glow) emitted as ring-rest, bound for reload; defs/render/apply/presentation tests and shipped profiles. 490/490 against niri c93180be; the installed a18ca619 rejects ring-rest, so install that niri before any apply.
  provenance: {"harness_session":"claude-code:cebfaf5f-51dd-49c1-ae0b-f56f976f9f14","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
