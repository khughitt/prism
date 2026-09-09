# Task 1 report

## Changes

- Added the eight shared `glass.bypass.*` bool definitions with Focus presentation metadata and stage descriptions.
- Moved the terminal opacity pair into the `Terminal` group.
- Added `defs/rack/devices.yaml` with the eight devices, matrix rows, shared noise type, bypass keys, and refraction dependencies.
- Bound every bypass key in the niri manifest.
- Updated the definitions and plugin presentation tests for the Terminal pair and bypass controls.

## Test evidence

- Red: `node --test test/glass-defs.test.js test/plugin-presentation.test.js` — 19 passed, 4 failed on the expected missing contract changes.
- Green: `node --test test/glass-defs.test.js test/plugin-presentation.test.js` — 23 passed, 0 failed.
- Full: `just test` — 252 Node tests passed, Lua plugin tests exited 0.
- Task validation: `tasks check` — 0 errors, 0 warnings.

## Self-review

- The rack file is outside direct definition loading as intended; Task 2 owns its schema validation.
- Bypass definitions have no per-state twins, unique orders, defaults of `false`, and manifest consumers.
- The focused and Terminal pairs retain matching presentation metadata and adjacent orders.
- No compatibility layer, new dependency, or unrelated file was added.

## Concerns

None within Task 1. The niri material value rewrites described by the bypass text are implemented by the later sink task.
