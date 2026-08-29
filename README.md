# Prism

Prism resolves appearance definitions and applies them to the configured
backends. The `niri` sink is the sole compositor integration: it generates one
`prism.kdl` carrying layout, terminal opacity, and the native niri glass
material and its terminal assignment. The Noctalia integration is a native v5
plugin under `integrations/noctalia-plugin/`.

## Development prerequisites

- Node.js 20 or newer
- Lua (for the direct Noctalia plugin module checks)

Install the existing Node dependency with `npm install`.

## Tests

- `npm test` runs the full Prism suite.
- `npm run test:plugin-lua` is the direct Noctalia plugin contract check for
  the production Lua modules.

The production plugin runs inside Noctalia; Lua is only a development test
prerequisite and is not a runtime package dependency.
