---
id: prism-02ea50
title: Pin the untested context-CLI edges
status: todo
priority: 3
size: xs
complexity: low
process: direct
created: 2026-09-05T22:55:53Z
updated: 2026-10-14T14:10:43Z
depends: []
tags: [cli, testing]
---

Three rules the context-layers branch states but leaves to inference. (1) context deactivate state, and an unknown kind: assertKind is wired into the deactivate call site but nothing exercises it there — the only reserved-kind coverage targets save and the top-level usage error. (2) context list with zero contexts of a kind, and kind-vs-name validation order when both are invalid. (3) Deleting an INACTIVE context while the active state is broken is refused, because the resulting state is the same broken state — a deliberate consequence of 'the resulting state must resolve' plus the rule that a dangling profile is an error for every verb, with 'deactivate first' as the documented recovery; today it is only traced through the code. Each is cheap to add to test/context-cli.test.js and each pins a stated rule rather than an implementation detail.

## Established (re-scope 2026-10-14, at 2eb5bfd)

- Rule (1) is covered; drop it. Since the declared command table (`325d9a8`), every kind is checked against the enum before a verb runs. `test/cli-surface.test.js` feeds each enum row, `context deactivate` kind included, an out-of-set value and asserts exit 2. `assertKind` in `src/context-cli.js` stays only as the store's own invariant, which the CLI can no longer reach.
- Rule (2) changed shape. `context list` now takes no kind (`context list extra` is refused). It lists every profile and every look's wallpaper pairs, so the open edge is listing a store with no profiles and no pairs. Validation order is now the table's: the kind enum fails before `assertName` runs. Pin it with one argv where both are invalid (e.g. `context delete theme 'a b'`, expecting the kind usage error and exit 2).
- Rule (3) still holds for profiles, and is still untested. In `changeSlots` (`src/context-cli.js`), a broken outgoing state is recovered only for a profile selection or for deleting the active profile. Deleting an inactive profile leaves the slot unchanged, so the resolve error propagates and the delete is refused. Recovery has since widened: deleting the active broken profile now succeeds, as the test 'delete recovers from malformed active context files' shows.
  - Wallpaper-pair deletes skip that refusal (`without.kind === 'wallpaper'`). The test should pin what a pair delete does under a broken active profile as observed, not assume refusal.

Done: tests in `test/context-cli.test.js` for the empty listing, the kind-before-name order, and the inactive delete under a broken active profile (plus the observed wallpaper-pair case), all against the current code.

## Notes

- 2026-10-14T14:10:43Z (main): scope: rescoped; checked at 2eb5bfd: rule (1) covered by cli-surface enum baselines since 325d9a8, rule (2) reshaped (context list takes no kind; kind enum precedes assertName), rule (3) holds for profiles in changeSlots and is untested, wallpaper-pair deletes bypass it; process direct
