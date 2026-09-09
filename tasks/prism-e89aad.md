---
id: prism-e89aad
title: Panel and prism have no way to detect that they are out of step
status: idea
priority: 2
created: 2026-09-05T22:56:12Z
updated: 2026-09-09T01:55:28Z
depends: []
tags: [noctalia, integration]
---

The Noctalia panel installs into Noctalia separately from the prism command, so the two drift whenever one is upgraded alone. The loud failure is one-sided, because every field the panel needs is one the CLI adds: a newer panel against an older CLI fails validateModel on the first absent field — 'prism describe returned no layer order', 'prism describe returned no profile list', 'prism describe returned no active contexts', 'prism describe returned no write target', or '<key> has no layer'. The other direction is quiet: validateModel inspects only the fields it knows and does not reject unknown ones, so an older panel keeps rendering under its own older rules, without shadowing rows it has no order to rank. Both degrade rather than misbehave, which is the right failure, and docs/notes/noctalia-plugin-contract.md states the two must be upgraded together — but a user reading 'glass.ior has no layer' has no way to know that is what it means. Fix: give describe --json an explicit contract version and have the panel check it before validating fields, so a mismatch produces 'this panel needs prism >= N — reinstall the plugin' instead of a field-shape error. The version belongs to the describe contract, not the prism release: it changes only when the JSON shape changes, which is the thing the panel actually depends on. Cheap on both sides, and it turns every future shape change from a puzzling field error into a sentence.

## Notes

- 2026-09-09T01:15:11Z (panel-error-lifecycle): Body corrected 2026-09-08: it had the skew direction backwards, claiming an older panel fails on the new CLI's 'layer' field. An older panel ignores fields it does not know; it is the newer panel that fails on an older CLI. The case is also stronger now — describe went from three required top-level fields to five (layers in prism-3b7c07, profiles and a required active in prism-ea6344) in two sessions.
- 2026-09-09T01:55:28Z (main): prism-52bc13 landed: contract.test.mjs now proves the CLI and the panel agree on the model shape at head, so what stays open here is only the install-skew case the test cannot see -- a panel and a prism from different versions on one machine. The version sentence is still the fix; the field-shape half is now covered.
