---
id: prism-b8b589
title: Mark a loaded profile as edited since load
status: dropped
priority: 2
created: 2026-09-10T17:00:50Z
updated: 2026-10-17T21:20:12Z
closed: 2026-10-17T21:20:12Z
depends: []
parent: prism-2f0b4b
tags: [noctalia, ui, profiles]
---

Show '*' beside the profile name once parameters change after loading. Fact to design around: edits under a loaded profile write straight into it, so the file never differs from the current values and there is no saved state to compare with. The star would mean 'edited since this panel loaded it', tracked panel-side (cleared on activate, set by any write while the profile is loaded), or it needs the bigger change of profiles not capturing edits until saved. Whether returning to the loaded values clears it is a free choice; simplest is once-set.

## Notes

- 2026-09-13T11:09:26Z (scope-acceptance): scope: briefed; current writes persist directly; indicator lifecycle across queued writes and profile switches awaits prism-e37618; brief: docs/notes/2026-09-13-profile-editing-brief.md
- 2026-10-17T21:14:44Z (main): scope: drop; rechecked at 93625b4: the edited-since-load marker landed as the edits row's count derived from describe's held (integrations/noctalia-plugin/panel.luau editsRow, 'N edits'/'No edits'), and the pairs amendment loads a look with zero pending edits, so the count is exactly 'edited since load'; spec docs/specs/2026-09-19-compositional-profiles-design.md Section 7 and its task map ('done by Section 7 (the edits count); close'); proposal: drop as landed in ad17477 under prism-aec90f (done; step prism-d4488f)
- 2026-10-17T21:20:12Z (main): dropped
  provenance: {"harness_session":"claude-code:5057c2c8-b2fe-4e4e-9246-1852a4bc3121","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-17T21:20:12Z (main): landed: the edits row's count derived from describe's held is the edited-since-load marker (compositional profiles Section 7, ad17477, prism-aec90f); drop approved by owner 2026-10-17
  provenance: {"harness_session":"claude-code:5057c2c8-b2fe-4e4e-9246-1852a4bc3121","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
