# Prism

Prism resolves appearance definitions and applies them to the configured
backends. The `niri` sink is the sole compositor integration: it generates one
prism.kdl carrying layout, terminal opacity, and the native niri glass
material and its terminal assignment. With glass enabled the layout block also
turns niri's gradient focus ring off, since the material's own ring of light
marks the focused window. Terminal background opacity defaults to
zero so the glass is the only surface behind the text; with the focus split on,
unfocused terminals get a second material whose roughness, tint distance,
fringing, distortion, directional blur, noise, and saturation are the
`glass.inactive.*` overrides. Both materials share `glass.noiseType`: `white`,
`fine` (the Prism default), or `lightness`. The Noctalia integration is a native
v5 plugin under `integrations/noctalia-plugin/`; its panel is a shared `Glass`
section and a `Focus` matrix with a focused and an unfocused slider per optic
and one shared Noise type select.

## Configuration layout

```
~/.config/prism/values.yaml                  # base values, dotfiles-tracked per host
~/.config/prism/contexts/profile/<name>.yaml # named profiles, full snapshots
~/.config/prism/contexts/wallpaper/<id>.yaml # per-wallpaper overrides, `_source` names the wallpaper
~/.local/state/prism/active.json             # which contexts are active (runtime state)
~/.local/state/prism/resolved.json           # the bus: every parameter's effective value
```

Values resolve as defaults, then base, then the active wallpaper context, then
the active profile. `prism set` writes into the topmost active context;
`prism set --base` writes the base file. `prism context` manages contexts:
`list`, `show`, `save`, `activate`, `deactivate`, `delete`, and `wallpaper
<path>`, the last being what a Noctalia `wallpaper_changed` hook calls. Design:
`docs/specs/2026-09-05-prism-context-layers-design.md`.

## Development prerequisites

- Node.js 20 or newer
- Lua (for the direct Noctalia plugin module checks)
- `just` and Python 3 (the test front door and its timing wrapper)

Install the existing Node dependency with `npm install`.

## Tests

- `just test` runs the full Prism suite (`npm test`) through the timing wrapper
  `tools/tt`; `just check` and `just gate` are the pre-commit and pre-push
  gates, and a fresh clone installs the hooks with
  `git config core.hooksPath .githooks`.
- `npm run test:plugin-lua` is the direct Noctalia plugin contract check for
  the production Lua modules.

The production plugin runs inside Noctalia; Lua is only a development test
prerequisite and is not a runtime package dependency.
