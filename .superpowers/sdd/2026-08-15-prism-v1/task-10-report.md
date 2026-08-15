# Task 10: niri-glass sink report

## Evidence

- Renderer defaults produce the fixture's exact 24-key set: `layoutGaps` comes from `compositor.gaps`, `paneApps` from `terminal.apps`, and the remaining 22 keys from `glass.*` suffixes. The focused renderer test checks the closed key set and every glass default; its mapped-parameter test proves both exceptional mappings.
- The manifest has exactly those 24 bindings, every one `live`, and declares `generates: [niri-glass.json]`.
- RED: `node --test test/niri-glass-render.test.js` failed with `ERR_MODULE_NOT_FOUND` for `integrations/niri-glass/render.js` before implementation.
- GREEN: focused renderer tests passed (3/3); the full suite passed (72/72).
- Isolated `PRISM_CONFIG_DIR`/`PRISM_STATE_DIR` doctor loaded the manifest and reported `niri-glass: never applied` (alongside the expected missing generated target). The executable rendered a controlled resolved input to the machine-local generated path and ignored an unrelated key.

## Files

- `integrations/niri-glass/render.js`
- `integrations/niri-glass/apply`
- `integrations/niri-glass/manifest.yaml`
- `test/niri-glass-render.test.js`

## Review

- `apply` is executable and delegates rendering to the tested pure renderer.
- It creates the generated directory, writes a same-directory temporary file, then atomically renames it to `generatedPath('niri-glass.json')`; it never references a user config path.

## Concerns

None. The process-id temporary filename follows the prescribed sink pattern; concurrent independent apply processes have distinct PIDs.
