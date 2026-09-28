---
id: prism-cd219b
title: Expose the ring beam's decay distance in the Ring group
status: doing
priority: 2
size: s
complexity: low
process: direct
owner: main
created: 2026-09-28T11:13:12Z
updated: 2026-09-28T11:13:20Z
started: 2026-09-28T11:13:20Z
depends: []
tags: [defs, niri, material]
agent: claude-code/claude-opus-5-5
---

The Prism half of material-338d21. niri gained a response key on the ring beam: `ring-beam-decay` (0-20000 logical px, default 0) is the distance along the band over which the comet's head and tail darken together until they are gone; 0 is no decay, the appearance that ships today.

Expose it in the Ring group after the head wander, the same way prism-de6e54 exposed beamNoise:
- `defs/glass.yaml`: `glass.ring.decay` (int 0-20000, default 0, unit px), ordered after `glass.ring.beamNoiseHz` (534) and before `glass.ring.gap`.
- `integrations/niri/render.js` `responseBlock`: emit `ring-beam-decay`; bind it for reload in the manifest; add it to both starter profiles.
- Tests: `NATIVE` and the shared-glass lists in `test/glass-defs.test.js`, the Ring row list in `test/plugin-presentation.test.js`, the render fixtures in `test/niri-render.test.js`, and the apply fixture in `test/niri-apply.test.js`.

Rollout order, as for every new response key: the niri carrying it must be installed before `prism apply` writes a config naming it. Keep this on its branch until then.

## Notes

- 2026-09-28T11:13:20Z (main): started
  provenance: {"harness_session":"claude-code:59949da0-e47e-4228-9027-05bf99914943","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
