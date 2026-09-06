---
id: prism-e9d332
title: Turn off the gradient focus-ring when glass is enabled
status: done
priority: 2
size: s
owner: main
created: 2026-09-05T20:56:45Z
updated: 2026-09-06T09:04:54Z
depends: []
tags: [niri]
---

niri-material's ring of light focus response (material-26dd8a) lights every focused material window; its docs tell material users to set focus-ring { off; } or both rings draw. renderNiriFragment already emits a layout { gaps } block that niri merges with the host config, so emit focus-ring { off; } in that block whenever glass.enabled is true, and extend test/niri-render.test.js. Works against the installed compositor today (focus-ring is core niri syntax).

## Notes

- 2026-09-06T09:04:54Z (main): renderNiriFragment emits focus-ring { off; } inside the layout block whenever glass.enabled; four render tests updated plus one dedicated test. niri 26.04 validates the rendered fragment behind a host focus-ring block that sets width and gradient; per niri-config's merge_on_off the later host block leaves off in force. README notes the behaviour.
