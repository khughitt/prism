---
id: prism-b8b589
title: Mark a loaded profile as edited since load
status: idea
priority: 2
created: 2026-09-10T17:00:50Z
updated: 2026-09-10T17:00:50Z
depends: []
parent: prism-2f0b4b
tags: [noctalia, ui, profiles]
---

Show '*' beside the profile name once parameters change after loading. Fact to design around: edits under a loaded profile write straight into it, so the file never differs from the current values and there is no saved state to compare with. The star would mean 'edited since this panel loaded it', tracked panel-side (cleared on activate, set by any write while the profile is loaded), or it needs the bigger change of profiles not capturing edits until saved. Whether returning to the loaded values clears it is a free choice; simplest is once-set.
