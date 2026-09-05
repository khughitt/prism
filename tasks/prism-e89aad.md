---
id: prism-e89aad
title: Panel and prism have no way to detect that they are out of step
status: idea
priority: 2
created: 2026-09-05T22:56:12Z
updated: 2026-09-05T22:56:12Z
depends: []
tags: [noctalia, integration]
---

The Noctalia panel installs into Noctalia separately from the prism command, so the two drift whenever one is upgraded alone. Since the context-layers change the failure modes are: an older panel against the new CLI fails validateModel with '<key> has no layer'; a newer panel against an older CLI fails with 'prism describe returned no write target'. Both degrade to the panel's visible-error banner rather than misbehaving, which is the right failure, and docs/notes/noctalia-plugin-contract.md now states that the two must be upgraded together — but a user reading 'glass.ior has no layer' has no way to know that is what it means. Fix: give describe --json an explicit contract version and have the panel check it before validating fields, so a mismatch produces 'this panel needs prism >= N — reinstall the plugin' instead of a field-shape error. The version belongs to the describe contract, not the prism release: it changes only when the JSON shape changes, which is the thing the panel actually depends on. Cheap on both sides, and it turns every future shape change from a puzzling field error into a sentence.
