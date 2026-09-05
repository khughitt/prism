---
id: prism-6c4469
title: unset of an orphaned key fails while another orphan remains
status: idea
priority: 2
created: 2026-09-05T08:21:27Z
updated: 2026-09-05T08:21:27Z
depends: []
tags: [cli]
---

prism unset <orphan> deletes the key and writes values.yaml, then writeResolved throws on any other orphan still present, so removing two retired params takes two runs and the first reports an error after it already wrote. Either resolve ignoring orphans during unset or report the remaining orphans without failing.
