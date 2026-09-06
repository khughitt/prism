---
id: prism-e76678
title: "Fan-out timeout test measures node startup, not the timeout"
status: done
priority: 2
size: xs
owner: main
created: 2026-09-05T22:55:29Z
updated: 2026-09-06T09:00:50Z
depends: []
tags: [testing, cli]
---

test/fanout.test.js's 'a timed-out apply is recorded and does not block the next sink' gives each fixture sink a 100ms execFileSync timeout and asserts the whole two-sink fan-out finishes in under 500ms. Both fixture sinks are '#!/usr/bin/env node' scripts, so almost the entire 100ms budget is interpreter startup. Under load the second sink ('later') times out too and out.applied comes back empty — that is the observed failure, at the out.applied deepEqual. Measured on this box: node -e '' costs 20-30ms sampled cleanly at load ~24, sh -c ':' costs ~0ms; under full-suite contention node startup clears 100ms outright. It fails intermittently in the full suite and passes 4/4 alone. Nothing in src/ is implicated: fanout.js, proc.js and lock.js were untouched by every run that failed. What the test means to prove is that a sink ignoring SIGTERM is still killed and the next sink still runs. That intent needs the hung sink's sleep to sit far above the timeout, not the timeout to be tight against process startup. Fix: make both fixture sinks '#!/bin/sh', raise the timeout well clear of startup noise, keep the hung sink sleeping an order of magnitude above it, and loosen the wall-clock assertion to match. The test then measures the kill path instead of the interpreter. Belongs to prism-a9a2a8's step 4 (suite hygiene).

## Notes

- 2026-09-06T09:00:50Z (main): test/fanout.test.js: fixture sinks are now #!/bin/sh; hung sink does trap '' TERM; exec sleep 10 against a 300ms runApply timeout; wall assertion <2000ms with a 5s test timeout. Reproduced 8/8 failing under 96 CPU burners (node -e '' at 90-170ms, sh at ~10ms); 8/8 passing after, full suite 198/198.
