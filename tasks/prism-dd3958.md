---
id: prism-dd3958
title: "Contract test: every queue argv is accepted by the CLI parser"
status: todo
priority: 2
size: xs
complexity: low
process: direct
created: 2026-09-10T17:00:50Z
updated: 2026-10-14T14:10:44Z
depends: []
tags: [testing, noctalia]
---

The panel and the CLI are upgraded together and the contract note promises skew fails loudly, but the queue's verbs are pinned by regex only. Run each Queue.argvFor shape against the real prism in a temporary store from contract.test.mjs and assert the failure, if any, is never a usage error. The shell was in exactly that state between the two 2026-09-09 merges: a panel emitting rename against a CLI without it.

## Established (re-scope 2026-10-14, at 2eb5bfd)

The test landed at `df9b602` (2026-09-20): 'every queue argv shape reaches a CLI command rather than usage parsing' in `integrations/noctalia-plugin/contract.test.mjs`. It runs twelve hand-listed `Queue.argvFor` items against `bin/prism` in temporary stores. Two gaps remain:

- It asserts on stderr against `/usage:|invalid expected|expected slots require|unknown kind|invalid context name/` and not on the exit status, so it misses enum usage errors. Observed: `prism context deactivate theme` prints `prism: kind must be one of profile, wallpaper, got "theme"` and exits 2, which that regex does not match. Exit 2 is exactly a `UsageError` (`src/cli.js`, the top-level catch).
- The item list is kept by hand (its length is asserted as 12), so a new verb in `Queue.argvFor` (`integrations/noctalia-plugin/queue.luau`) is not forced into the test.

Done: the test asserts `status !== 2` for every argv (keeping the stderr in the message), and fails when `argvFor` handles a verb the item list does not cover. For example, compare the verbs `argvFor` accepts against the listed items' verbs.
