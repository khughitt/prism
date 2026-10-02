# Glass tint follows the Noctalia palette

**Date:** 2026-10-02
**Status:** revised after human spec review round 1; awaiting re-review. Product implementation has not started.
**Task:** `prism-b5cb1e`
**Amends:** [Wallpaper rotation keeps the screen and pending edits](2026-09-27-rotation-keeps-edits-design.md), extending its palette transport to the glass tint.

## Intent

In dark mode, terminal backgrounds are transparent, so the glass behind the
light terminal text must stay legible when the wallpaper changes. Noctalia owns
the terminal colorscheme and its surface tone. Prism should use that tone for
focused and unfocused glass, with a small amount of the palette accent,
refreshed after every palette change. The accent follows the wallpaper only
when Noctalia generates the palette from it; predefined schemes supply their
own accent. The owner can still choose a manual tint and tune each focus
state's absorption distance.

The legibility goal and desktop acceptance are explicitly limited to dark
mode. Absorption multiplies the backdrop by a transmittance no greater than
one: it can darken a wallpaper, but cannot brighten it for dark text in light
mode. The template still renders the selected light palette correctly; that
does not establish legibility over a dark wallpaper. Supporting transparent
terminals in light mode needs a material that can brighten or replace the
backdrop, and is outside this task. Light-mode users need an opaque terminal
background or a separately accepted material treatment; selecting a manual
absorption tint alone cannot solve this limitation.

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

The existing focused and unfocused Tint pickers remain visible and editable,
showing their stored colors (by default `#dfe8ff`) under either source. Their
descriptions explicitly say that under Noctalia these are stored manual
colors, not the effective tint on screen. Selecting manual makes the stored
colors take effect on the next successful apply. Under Noctalia, the two
materials receive the same palette-derived color while retaining their own
depth, distance, blur and other optics. No effective palette color is written
back into a picker or saved profile.

Change the focused attenuation-distance default to 30 px, the focused-only
distance recorded in the task's known working configuration, and the unfocused
default to 35 px. This preserves the existing 70:60 ratio: the unfocused pane
absorbs slightly less strongly. These defaults assume the shipped 20 px depth.
Transmittance per channel is approximately `color^(depth / distance)` on the
flat face, so depth matters as much as distance; a saved large depth with a
short distance and a dark tint can make the pane effectively black. Existing
explicit values in base, profiles, pairs and scratch continue to win, so assess
both controls when judging legibility. Keep the current neutral distances
(60 px) and all existing distance ranges and controls. There is no hidden
distance override when a source changes.

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
| Manual or bypassed tint, ring source familiar or manual | None; do not read the file. |
| Manual or bypassed tint, ring source noctalia | Primary only. |
| Noctalia tint, not bypassed, accent mix 0 | Surface, plus primary if the ring source is noctalia. |
| Noctalia tint, not bypassed, accent mix greater than 0 | Surface and primary, whatever the ring source. |

## Failure handling

When an enabled Noctalia tint needs the file, a missing file or invalid required
field fails the apply before writing the generated config or calling niri.
Report the file and field, with an actionable remedy: run
`noctalia msg templates-apply`, verify primary and surface in the output, then
rerun `prism apply niri`; if the output is not refreshed, use the README's
checked direct `noctalia theme` command for a wallpaper palette. Alternatively,
select the manual tint source. Use the same commands and verification in the
README's upgrade instructions. Do not silently keep a stale tint or substitute
the manual color.
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

Sequence the host upgrade so panel edits and wallpaper applies keep working:

1. Land the expanded template while the old accent-only sink is still in use.
   It accepts the additional surface field. Do not activate the new Noctalia
   tint default yet, and do not repoint the registered template to a worktree.
2. Reapply templates for the current palette without changing the colorscheme:

   ```sh
   noctalia msg templates-apply
   ```

   This is the installed CLI's template-refresh command, not a colors-change
   trigger. It reapplies all configured templates, so their existing post-hooks
   and reloads also run. Its `ok` response is an acknowledgment; verify output
   completion before proceeding. Confirm that
   `${XDG_STATE_HOME:-$HOME/.local/state}/prism/noctalia-palette.json` has both
   `primary` and `surface` as `#rrggbb` colors. If it still has only primary,
   stop the upgrade and use the direct render below; do not enable the new sink
   or merely wait for an unrelated future palette change.
3. Only after that verification, activate the new sink and defaults, then run
   `prism apply niri`. A failed palette refresh therefore leaves the old apply
   path working. Keep manual tint selectable for an installation without
   Noctalia's palette transport.

A direct synchronous refresh for a wallpaper-generated scheme is also
available. From the Prism checkout whose expanded template is to be used:

```sh
(
scheme=$(noctalia msg color-scheme-get)
case "$scheme" in
  wallpaper\ *) scheme=${scheme#wallpaper } ;;
  *) printf '%s\n' 'Use templates-apply for a predefined scheme.' >&2; exit 1 ;;
esac
noctalia theme "$(noctalia msg wallpaper-get)" \
  --scheme "$scheme" --default-mode "$(noctalia msg theme-mode-get)" \
  -r "$PWD/integrations/niri/noctalia-palette.template:${XDG_STATE_HOME:-$HOME/.local/state}/prism/noctalia-palette.json"
)
```

The source guard prevents replacing a predefined palette with wallpaper-derived
colors. The direct command renders only Prism's palette output; it does not
run the other templates. Require a successful exit and valid two-field output
before enabling the sink. Include these upgrade commands and ordering in the
README, rather than the instruction "render the template" alone.

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
   `{dark: {...}, light: {...}}` token maps and
   `noctalia theme --theme-json <file> --default-mode <dark|light> -r <template>:<output>`;
   verify primary and surface for each mode. This tests palette transport,
   including light mode, rather than promising light-mode legibility.
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
6. On the desktop, confirm `noctalia msg theme-mode-get` reports `dark`, then
   rotate through two wallpapers with different palettes, including both a
   bright and a dark wallpaper. Inspect `prism.kdl` and focused/unfocused light
   terminal text with transparent backgrounds. Check the 20 px depth with the
   30/35 px distances, and separately inspect the owner's saved depth/distance
   values. The owner judges legibility; automated checks cannot establish that
   visual result. Light-mode rendering is not desktop legibility acceptance.
7. Rehearse the upgrade from a primary-only palette: refresh and validate the
   two-field output before activating the new default. Prove that a failed
   refresh leaves the old sink available, and that a new sink explicitly
   enabled too early fails with the concrete refresh command in its error.

## Evidence from the revision

On 2026-10-02, Noctalia v5.2.0 accepted `noctalia msg templates-apply` and
returned `ok`. Neither a 10-second probe nor a 45-second follow-up observed a
palette mtime change while reapplying the unchanged registered template. That
does not distinguish an unchanged-output optimization from a missed refresh,
so acknowledgment alone is not recorded as proof of refresh completion.
The direct render was checked with a temporary two-field template and temporary
output against the running desktop's wallpaper, generator scheme and mode:
its primary matched the live palette, and it emitted a valid surface. Fixed
dark and light token-map renders also produced the expected two fields.
The exact shell block documented above also exited 0 in an isolated directory,
replacing a primary-only palette with valid primary and surface fields.
These probes did not deploy the new sink or repoint any host launcher or
template registration.

Task completion requires the automated checks and the owner's desktop
acceptance. The tuned ring-defaults and panel-size tasks follow this work and
retain their own acceptance criteria.
