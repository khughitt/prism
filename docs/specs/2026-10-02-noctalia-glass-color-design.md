# Glass tint follows the Noctalia palette

**Date:** 2026-10-02
**Status:** draft for user review; product implementation has not started.
**Task:** `prism-b5cb1e`
**Amends:** [Wallpaper rotation keeps the screen and pending edits](2026-09-27-rotation-keeps-edits-design.md), extending its palette transport to the glass tint.

## Intent

Terminal backgrounds are transparent, so the glass behind the text must stay
legible when the wallpaper changes. Noctalia owns the terminal colorscheme and
its surface tone. Prism should use that tone for focused and unfocused glass,
with a small amount of the palette's wallpaper-derived accent, refreshed after
every palette change. The owner can still choose a manual tint and tune each
focus state's absorption distance.

The task's older description proposed a template post-hook or a resolver input.
The current code already has the transport: a Noctalia user template writes
`noctalia-palette.json` in Prism's state directory, and `colors_changed` runs
`prism apply niri` after templates finish. The ring consumes `primary`; the
glass currently consumes only the stored attenuation colors. Those colors are
manual values, not an existing wallpaper-analysis result.

## Decision and alternatives

Derive the effective glass color in the niri sink, alongside the ring's palette
input. Reuse the palette file, hook, per-sink lock, validation and reload path.

Rejected alternatives:

- Writing palette colors into base or scratch on every change would make
  external theme updates overwrite tuning or appear as pending edits. Wallpaper
  transitions deliberately preserve those edits.
- Adding palette data to the core resolver would make all store readers depend
  on a host input and require a new resolution trigger. Only the niri sink
  needs this material color today.

The terminal palette stays owned by Noctalia's existing kitty and Ghostty
templates. This task does not introduce a second terminal palette generator or
an image-analysis pipeline.

## Parameters and controls

Add two parameters to `defs/glass.yaml` and bind them in the niri manifest:

| Key | Type | Default | Neutral | Meaning |
| --- | --- | --- | --- | --- |
| `glass.tintSource` | enum: `noctalia`, `manual` | `noctalia` | `manual` | Select the palette-derived tint or the existing stored focus-state colors. |
| `glass.tintAccentMix` | float, 0–1, step 0.01 | 0.10 | 0 | Fraction of the palette primary mixed into its surface color. Zero uses the surface alone; one uses the primary alone. |

Both controls are shared by the focus states and appear in the Tint rack
device's details via its existing `shared` list. Label them **Tint source** and
**Palette accent mix**, with the latter displayed as a percentage. The surface
is the dominant source at the shipped 10% mix; the full range remains available
for deliberate tuning.

The existing focused and unfocused Tint pickers retain their stored colors and
remain editable. Their descriptions state that they apply under the manual
source; selecting manual reveals them immediately. Under Noctalia, the two
materials receive the same palette-derived color while retaining their own
depth, distance, blur and other optics. No effective palette color is written
back into a picker or saved profile.

Change the focused and unfocused attenuation-distance defaults to 30 px, the
short distance recorded in the task's known working configuration. Existing
explicit values in base, profiles, pairs and scratch continue to win. Keep the
current neutral distances (60 px) and all existing distance ranges and controls.
There is no hidden distance override when a source changes.

The source default is an intentional behavior change: existing looks without
an explicit `glass.tintSource` start following Noctalia. A look that should keep
its stored tints sets the source to `manual`. No store migration is needed.

## Palette contract and rendering

Extend `integrations/niri/noctalia-palette.template` to emit:

```json
{"primary": "#rrggbb", "surface": "#rrggbb"}
```

Use `colors.primary.default.hex` and `colors.surface.default.hex`; the existing
Noctalia template mode selects the current dark or light variant. Preserve the
state-file location and `PRISM_NOCTALIA_COLORS` override.

The palette reader parses the file once per apply and validates the color
fields the enabled consumers need. Replace the accent-only reader and update
its callers; do not retain a compatibility wrapper. The apply passes the
validated source colors to the renderer, which remains independent of file I/O.

For the Noctalia tint, compute each red, green and blue channel as:

```text
round(surface * (1 - mix) + primary * mix)
```

Channels are the encoded 0–255 sRGB bytes; emit a lowercase six-digit hex color.
This is a color interpolation for appearance tuning, not a light-transport
calculation. At mix 0 the primary is unnecessary for tint rendering. At mix 1
the output is the primary, but surface remains a required field for the
selected Noctalia tint contract.

Apply the derived color to the selected state's optics before the existing
bypass overrides. Tint bypass therefore continues to emit white for both
materials and wins over either tint source. With focus split off, emit only
the focused material as today. The ring's `familiar`, `noctalia` and `manual`
sources remain independent of the tint source.

Required inputs:

| Enabled consumers | Required palette fields |
| --- | --- |
| Glass off | None; do not read the file. |
| Manual tint, ring source familiar or manual | None; do not read the file. |
| Manual or bypassed tint, ring source noctalia | Primary only. |
| Noctalia tint, not bypassed, accent mix 0 | Surface, plus primary if the ring source is noctalia. |
| Noctalia tint, not bypassed, accent mix greater than 0 | Surface and primary, whatever the ring source. |

## Failure handling

When an enabled Noctalia tint needs the file, a missing file or invalid required
field fails the apply before writing the generated config or calling niri.
Report the file and field, with an actionable remedy: render the updated Prism
Noctalia palette template and rerun `prism apply niri`, or select the manual
tint source. Do not silently keep a stale tint or substitute the manual color.
Unrelated filesystem errors continue to propagate.

Preserve the ring's established missing-file behavior when it is the only
palette consumer: it rests on its stored manual color until a palette exists.
A present malformed file or invalid required primary still fails that apply.
An invalid unused field does not block a manual or bypassed tint.

Palette reads remain inside the existing niri sink lock. A colors-change apply
therefore sees the template's completed output, including when a wallpaper
transition runs a competing apply. Existing niri validation rollback and
reload-failure reporting continue to apply.

## Rollout and documentation

Update the README's Noctalia palette section with both consumers, the source
and mix controls, defaults, and the template refresh required on upgrade. An
old primary-only palette is insufficient when Noctalia tint is enabled;
regenerate it explicitly rather than accepting an old shape as a tint source.
The existing dotfiles template registration and colors-change hook already
point to Prism's template; their tracked configuration needs no change.

For desktop verification, first confirm where the host's Prism command and
template resolve. Run the worktree code by explicit path or an environment
override. Do not repoint the host launcher or template registration to the
worktree. Any live appearance change is separately presented for the owner's
visual judgment after implementation and automated checks.

## Verification and acceptance

Use the existing test files and `just test-fast` front door; this checkout has
no `test-one` target. The baseline on 2026-10-02 passed 490 Node tests and the
Lua panel checks.

1. Render the shipped template with the installed Noctalia CLI using fixed
   dark and light token maps; verify primary and surface for each mode.
2. Check deterministic mix results, both endpoints, both focus states, manual
   colors, focus split off, tint bypass and unchanged ring source behavior.
3. Exercise niri apply with all required-input combinations, missing and
   malformed files, invalid required fields and unusable unused fields. A
   failure preserves the existing generated file and makes no niri call.
4. Apply two different palettes without changing resolved Prism params: both
   materials follow the new tint, while the runtime, saved look and pending
   edits remain unchanged. Exercise the existing serialized apply path.
5. Verify defs, manifests, rack membership and generated panel controls, and
   preserve neutral behavior (manual white tint in both states).
6. On the desktop, rotate through two wallpapers with different palettes,
   including a bright wallpaper. Inspect `prism.kdl` and focused/unfocused
   terminal text with transparent terminal backgrounds. The owner judges
   legibility; automated checks cannot establish that visual result.

Task completion requires the automated checks and the owner's desktop
acceptance. The tuned ring-defaults and panel-size tasks follow this work and
retain their own acceptance criteria.
