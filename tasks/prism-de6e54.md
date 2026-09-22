---
id: prism-de6e54
title: Expose the ring beam's head wander in the Ring group
status: done
priority: 2
size: s
complexity: low
process: direct
owner: prism-de6e54
created: 2026-09-22T15:57:03Z
updated: 2026-09-22T16:04:24Z
started: 2026-09-22T15:57:24Z
completed: 2026-09-22T16:04:24Z
depends: []
tags: [defs, niri, material]
agent: claude-code/claude-opus-5
---

The Prism half of material-9704b0. niri gained two response keys on the ring beam: `ring-beam-noise` (0-1, default 0) is how far the comet head's brightness wanders either side of its envelope, and `ring-beam-noise-hz` (0-30, default 3) is how fast. Both default to a steady head, so an unset value is the appearance that ships today.

Expose them in the Ring group beside `beamSpeed`/`gap`/`glow`:
- `defs/glass.yaml`: `glass.ring.beamNoise` (float 0-1) and `glass.ring.beamNoiseHz` (float 0-30), ordered after `glass.ring.beamSpeed` (530) and before `glass.ring.gap`.
- `integrations/niri/render.js` `responseBlock`: emit `ring-beam-noise` and `ring-beam-noise-hz`.
- Tests: the `NATIVE` list in `test/glass-defs.test.js` (they are native keys, not Prism-only like `colorSource`), the Ring row list in `test/plugin-presentation.test.js`, the render fixtures and their emitted-kdl assertions in `test/niri-render.test.js`, and the apply fixture in `test/niri-apply.test.js`.

Rollout order, as for every new response key: the niri carrying them must be installed before `prism apply` writes a config naming them, or niri rejects the config. Land this after the material-9704b0 build is installed, and do not apply live before then.

## Notes

- 2026-09-22T15:57:24Z (prism-de6e54): started
  provenance: {"harness_session":"claude-code:365f5b3e-15f6-430e-aa21-082d2a27e409","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-09-22T16:04:24Z (prism-de6e54): Verified against the material-9704b0 niri build, not the installed one: the whole suite (479/479) passes with that binary first on PATH, and fails only the two installed-niri probe tests (enum baselines, the --json output row) against the installed niri 26.04 (649c731b), which predates the keys. Landing therefore requires installing the niri that carries ring-beam-noise before any prism apply.
- 2026-09-22T16:04:24Z (prism-de6e54): done
  provenance: {"harness_session":"claude-code:365f5b3e-15f6-430e-aa21-082d2a27e409","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-09-22T16:04:24Z (prism-de6e54): glass.ring.beamNoise and beamNoiseHz in the Ring group; emitted as ring-beam-noise/-hz, bound for reload, in both starter profiles
  provenance: {"harness_session":"claude-code:365f5b3e-15f6-430e-aa21-082d2a27e409","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
