---
id: prism-52bc13
title: Validate real describe output against the panel's model validator
status: done
priority: 1
size: s
owner: describe-contract
created: 2026-09-09T01:14:41Z
updated: 2026-09-09T01:52:15Z
depends: []
tags: [testing, noctalia, integration]
---

Every panel test builds its model by hand, so nothing checks that what 'prism describe --json' actually emits satisfies the panel's validateModel. The describe contract gained 'layers' in prism-3b7c07 and 'profiles' plus a required 'active' in prism-ea6344, and each time the hand-written fixtures in integrations/noctalia-plugin/plugin_test.lua and test/plugin-panel-lifecycle.test.js had to be patched by hand; a newly required field surfaced as a mid-work test failure rather than as a statement that the CLI and the panel had diverged. Add a test that spawns 'prism describe --json' against a temp store, feeds stdout through the panel's validateModel, and asserts it passes - and ideally renders one row of each control kind from it. integrations/noctalia-plugin/contract.test.mjs already spawns processes and is the natural home. This is the check that turns a future shape change from a puzzling fixture failure into 'the panel and the CLI disagree'.

## Notes

- 2026-09-09T01:52:15Z (describe-contract): contract.test.mjs now spawns describe against a temp store and runs the real panel.luau over it; verified both directions by dropping profiles from cli.js and by swapping ui.toggle in the panel
- 2026-09-09T01:52:15Z (describe-contract): contract.test.mjs feeds real 'prism describe --json' output (fresh store and a profile-over-base store) through panel.luau's validateModel and asserts every control kind draws its row
