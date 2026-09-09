# Prism

Prism resolves appearance definitions and applies them to the configured
backends. The `niri` sink is the sole compositor integration: it generates one
prism.kdl carrying layout, terminal opacity, and the native niri glass
material and its terminal assignment. With glass enabled the layout block also
turns niri's gradient focus ring off, since the material's own ring of light
marks the focused window. Terminal background opacity defaults to
zero so the glass is the only surface behind the text; with the focus split on,
unfocused terminals get a second material whose optics are the `glass.inactive.*`
overrides: frosted backdrop, blur, tint, tint distance, refraction, depth,
fringing, distortion, distortion detail, directional blur, noise, and
saturation. Blur, tint distance, fringing, distortion, noise, and saturation
ship already receded; the other six pairs start level, so the split only shows
where you tune it.

Every `glass.inactive.*` default is fixed, not inherited: tuning `glass.ior`
leaves `glass.inactive.ior` at 1.5. Set both halves of a row, or the unfocused
material keeps the shipped default for that optic. This bites on upgrade for
frosted backdrop, tint, refraction, depth, and distortion detail, whose focused
halves were shared parameters until the matrix widened — an existing
`glass.backdropBlur = true` now frosts only the focused window until
`glass.inactive.backdropBlur` is set to match.

The two materials share the slab frame (`glass.paneLip`,
`glass.paneShiftX`, `glass.paneShiftY`), the pane motion (`glass.jellyFlex`,
`glass.jellyRipple`), and `glass.noiseType`: `white` or `fine` (the Prism
default). The frame is shared deliberately — a per-state frame would resize and
shift the slab on every focus change, and niri swaps materials as a hard cut.
The Noctalia integration is a native
v5 plugin under `integrations/noctalia-plugin/`; its panel is a shared `Glass`
section for the frame and pane motion, a `Focus` rack with one card per glass
stage in the shader's order (Backdrop, Distortion, Refraction, Fringing,
Directional blur, Tint, Saturation, Noise), and a `Terminal` matrix for the
terminal opacity pair. Each card shows its mix for both focus states, a light
colored by category that bypasses the stage when clicked, and a chevron that
reveals its other parameters. Bypass is a real `glass.bypass.<device>` value:
the niri sink writes the stage's dry value into both materials while it is
set and the mix keeps its number. Bypassing Refraction also silences Fringing
and Directional blur, which ride its taps, and flattens Blur. Design:
`docs/specs/2026-09-08-device-chain-rack-design.md`.

## Configuration layout

```
~/.config/prism/values.yaml                  # base values, dotfiles-tracked per host
~/.config/prism/contexts/profile/<name>.yaml # named profiles, full snapshots
~/.config/prism/contexts/wallpaper/<id>.yaml # per-wallpaper overrides, `_source` names the wallpaper
~/.local/state/prism/active.json             # which contexts are active (runtime state)
~/.local/state/prism/resolved.json           # the bus: every parameter's effective value
```

Values resolve as defaults, then base, then the active wallpaper context, then
the active profile. `prism set` writes into the topmost explicit layer: the
loaded profile, else the wallpaper while it is pinned, else base; a wallpaper
the hook activated on its own is an overlay and never captures edits.
`prism set --base` writes the base file regardless. `prism context` manages
contexts: `list`, `show`, `save` and `rename` (profiles), `activate`,
`deactivate`, `delete`, `pin` and `unpin wallpaper`, and `wallpaper <path>`, the last being
what a Noctalia `wallpaper_changed` hook calls. Design:
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
