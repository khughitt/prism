# Native niri material sink

**Date:** 2026-08-28
**Status:** Accepted 2026-08-28; deployed 2026-08-29 and live. Prism `main`
through `5888970`, dotfiles `main` through `7b0efad`. Prism now generates the
sole compositor fragment and the manual Noctalia acceptance PASSed. The handoff
was revised 2026-08-29 after a compositor panic on material removal, fixed in
niri-material `7f6e69c3`. Material daily-driver burn-in passed 2026-08-30 on
the later backdrop-blur package `26.04.r133.g52f74f10-1`; Prism `d20111c` adds
the matching `glass.backdropBlur` control.

## Context

This section records the design-time deployment state that motivated the
handoff; it is not a description of the current installation. At design
acceptance, the native material compositor was installed as
`niri-material 26.04.r95.g138697be-1` from source commit
`138697be4cbb779c80425fe2a366ceca3610f38e`. Dotfiles commit
`cd002eae5dfe4514b5e780ab4149927c96043e83` assigned a static native material
to Kitty and Ghostty and no longer started the legacy `niri-glass` Quickshell
layer.

That rollout initially preserved only Prism's opacity path. Prism's glass
parameters still fanned out to the legacy `niri-glass` sink, which wrote
`generated/niri-glass.json`; no running process consumed that file. The
Noctalia plugin's preview commands likewise still called the retired
`qs -c niri-glass` IPC target. The panel therefore accepted glass edits while
the native material remained unchanged in dotfiles `niri/materials.kdl`.

At design time this was visible in the live values: Prism reported
`glass.ior = 1.82`, while the deployed native material used `ior 1.38`. The
daily-driver rollout was then paused before its normal-session and cold-start
completion until this control path was corrected.

## Decision

The existing Prism `niri` sink becomes the sole compositor integration. Its
single atomic `prism.kdl` output owns layout gaps, terminal opacity, the
native material definition, and terminal material assignment. The legacy
`niri-glass` sink and isolated-preview transport are deleted rather than
retained behind a compatibility layer.

Noctalia controls update matching live terminal windows directly:

```text
Noctalia
  -> prism set
  -> niri sink
  -> atomic prism.kdl replacement
  -> niri config reload
  -> open Kitty and Ghostty windows
```

There is no replacement standalone preview surface. Live terminals are the
preview surface.

## Goals

- Make every visible Prism glass control affect native niri material state.
- Reproduce the accepted daily-driver appearance exactly once Prism owns it,
  accepting one sub-second flicker at the ownership switch.
- Keep one generated compositor file, one sink status, and one reload path.
- Match Kitty and Ghostty by exact literal app IDs.
- Remove controls and transports that native niri cannot consume.
- Preserve niri's last-valid-config behavior while making Prism failures loud.
- Resume the paused normal-session and cold-start rollout only after live
  Noctalia control acceptance.

## Non-goals

- A new compositor preview surface or preview IPC API.
- A compatibility sink for the retired Quickshell implementation.
- Porting legacy diagnostic overlays, environment reflections, sample count,
  or spring solver controls into native niri.
- Changing native niri shader, parser, or renderer code.
- Supporting compositors other than the accepted material-capable niri fork.
- Preserving obsolete `glass.*` keys as hidden aliases.

## Generated KDL ownership

`integrations/niri` continues to generate
`$XDG_STATE_HOME/prism/generated/prism.kdl`. The output contains, in order:

1. the generated-file warning and layout gaps;
2. focused and unfocused terminal opacity rules;
3. one `material "terminal-glass"` definition; and
4. one terminal assignment rule.

The assignment rule carries an inert background effect:

```kdl
background-effect {
    blur false
    noise 0
    saturation 1
}
```

This makes Prism's own generated terminal contract independent of its removed
blur/noise parameters. `prism.kdl` remains the first include deliberately, so
a later user-authored rule may still override it. It needs no `xray` override
because an inert background effect cannot reach the automatic xray path.

`terminal.apps` is a list of literal app IDs, not regular expressions. The
renderer escapes regex metacharacters, joins the literals, anchors the result,
and emits a KDL raw string. The accepted pair renders as
`r#"^(kitty|com\.mitchellh\.ghostty)$"#`. The shipped default becomes exactly
`kitty` and `com.mitchellh.ghostty`. The same literal-to-anchored-regex
conversion is used for the per-app opacity rules. A raw-string helper chooses
enough `#` delimiters for arbitrary literal values rather than assuming one is
always sufficient.

An empty `terminal.apps` list emits no opacity or material-assignment rules;
it never emits an empty regular expression. Layout and the unused material
definition remain valid.

When `glass.enabled` is false, the generated terminal rule omits its
`material` field but retains the inert background-effect override and opacity
rules. The definition may remain present and unused. Re-enabling glass
restores the assignment on the next reload without another state channel.

## Native parameter contract

The `niri` manifest binds the native material parameters with `reload`
liveness. The renderer maps them as follows:

| Prism parameter | Native KDL | Contract |
| --- | --- | --- |
| `glass.enabled` | assignment present/absent | default `true` |
| `glass.paneLip` | part of `bevel` | range `0..64` logical px |
| `glass.paneShiftX` | `offset-x` | range `-64..64` logical px |
| `glass.paneShiftY` | `offset-y` | range `-64..64` logical px |
| `glass.ior` | `ior` | range `1..3` |
| `glass.thickness` | `thickness` | range `0..200` logical px |
| `glass.attenuationColor` | `attenuation-color` | color |
| `glass.attenuationDistance` | `attenuation-distance` | Prism range `1..65535` |
| `glass.chromaticAberration` | `chromatic-aberration` | range `0..1` |
| `glass.distortion` | `distortion` | range `0..1` |
| `glass.distortionScale` | `distortion scale=` | Prism range `0.01..2` |
| `glass.anisotropicBlur` | `anisotropic-blur` | range `0..1` |
| `glass.backdropBlur` | `backdrop-blur` | boolean, default `false` |
| `glass.jellyFlex` | `jelly-flex` | range `0..0.02` |
| `glass.jellyRipple` | `jelly-ripple` | range `0..0.5` |

Native bevel is derived rather than exposed as a second shape model:

```text
bevel = paneLip + max(abs(paneShiftX), abs(paneShiftY))
```

The tightened ranges keep the derived bevel at or below native niri's
128-pixel maximum and guarantee that each offset is no wider than the bevel.
The accepted Titan geometry remains `5 + max(4, 4) = 9`.

Prism retains positive minima for the two logarithmic controls:
`attenuationDistance` starts at `1`, and `distortionScale` starts at `0.01`.
Both are within native niri's wider grammar and satisfy Prism's inclusive
range and logarithmic-slider validation. `glass.thickness` changes from the
legacy minimum `0.1` to native niri's minimum `0`.

The canonical definitions delete parameters with no native consumer:

- `glass.gridOverlay`
- `glass.calibrate`
- `glass.probeExposure`
- `glass.roughness`
- `glass.samples`
- `glass.springDampingRatio`
- `glass.springStiffness`
- `glass.springEpsilon`

The old terminal background-effect parameters are also deleted because their
pass is superseded by the native material:

- `terminal.blur`
- `terminal.saturation.active`
- `terminal.saturation.inactive`
- `terminal.noise.active`
- `terminal.noise.inactive`

Whole-window opacity remains compositor-owned. Kitty background opacity
remains owned by the existing Kitty sink. No hidden definitions or orphan-key
exceptions preserve the removed surface.

The remaining definitions use native units and descriptions. Thickness and
attenuation distance are labeled in logical pixels; chromatic aberration,
distortion, and distortion scale are dimensionless native values. Their
legacy `display: normalized` metadata and normalized-path descriptions are
removed.

## Titan value migration

Dotfiles `prism/titan/values.yaml` is migrated before the native sink becomes
authoritative. It removes every deleted key, records the exact live app IDs,
and pins the accepted material appearance:

| Parameter | Accepted value |
| --- | --- |
| `terminal.apps` | `[kitty, com.mitchellh.ghostty]` |
| `glass.ior` | `1.38` |
| `glass.thickness` | `32` |
| `glass.attenuationColor` | `#bbc7db` |
| `glass.attenuationDistance` | `178` |
| `glass.chromaticAberration` | `0.68` |
| `glass.distortion` | `0.32` |
| `glass.distortionScale` | `0.05` |
| `glass.anisotropicBlur` | left at its default `0` |
| `glass.jellyFlex` | `0.0038` |
| `glass.jellyRipple` | `0.15` |
| `glass.paneLip` | `5` |
| `glass.paneShiftX` | `4` |
| `glass.paneShiftY` | `4` |

Existing compositor gaps, window opacity, and Kitty background-opacity
values remain unchanged. The first accepted native generation must therefore
be visually equivalent to the static daily-driver material instead of
silently adopting the legacy values currently stored for an inactive sink.
The renderer always emits `anisotropic-blur`, so the unoverridden default is
still present as `anisotropic-blur 0` in generated KDL.

## Noctalia plugin

The panel retains its existing optimistic values, write queue, refresh
contract, group layout, and reset behavior. It does not gain a second native
transport. Definition removal automatically removes unsupported rows.

The preview toggle, diagnostic-background toggle, preview state, explanatory
preview labels, `preview-show`/`preview-hide` queue verbs, and all
`qs -c niri-glass` commands are deleted. `ui.affectsPreview`, its definition
validation, and its presentation tests are deleted with their only consumer.

Every native material parameter uses plain `liveness: reload`. Prism's
existing `effectiveDrag` contract already resolves any non-`live` binding to
`release`, so the local Noctalia thumb and value remain immediate while the
write and niri reload occur once on release. Toggles and the color control
apply once per discrete change. The manifest schema does not need a redundant
`drag` declaration or any relaxation. Open terminals remain the direct
feedback surface without sample-time compositor reloads.

The plugin description no longer promises a separate glass preview. Closing
the panel has no preview cleanup action because no preview state exists.

## Failure behavior

The niri sink preserves the previous target bytes or its prior absence, writes
the candidate `prism.kdl` to a sibling temporary file, and renames it
atomically. It then runs `niri validate` before requesting a live reload.
Native niri resolves that validation path from `NIRI_CONFIG` when nonempty,
otherwise from `$XDG_CONFIG_HOME/niri/config.kdl`, then its system path; its
normal `-c` precedence remains available to direct operator validation. A
missing resolved config is an error rather than a default-config fallback.
Canonical range checks and the derived bevel rule prevent invalid material
combinations from reaching the renderer, while whole-config validation also
catches conflicts or unrelated errors in surrounding includes. That broader
failure is deliberate under the fail-early contract and makes the niri sink
and `prism doctor` red until the composed config is corrected.

Fresh graphical setup invokes `prism apply niri` with
`NIRI_CONFIG` set to the tracked dotfiles `niri/config.kdl`. At that point
setup has already linked the generated `prism.kdl` into the tracked niri
directory, so the sink and setup's subsequent explicit `niri validate -c`
check validate the same composed file even before `$XDG_CONFIG_HOME/niri` is
linked.

On validation failure, the sink atomically restores the previous
`prism.kdl`—or removes the candidate when no previous target existed—and exits
nonzero without requesting a reload. The file watcher may observe the rejected
candidate during that bounded interval, but native niri retains its last valid
config. `fanOut` then records the niri sink as failed and `prism doctor`
reports it accurately. Correcting the value or running `prism apply niri`
retries the same authoritative sink. No defaults or compatibility consumer
are substituted.

If validation succeeds but `niri msg action load-config-file` fails because
the compositor is not running, the sink keeps the newly validated target and
exits nonzero. Prism records the deferred reload as failed, while dotfiles
setup accepts it only when the generated file is nonempty and its inode
changed. The valid file then loads on cold start; applying the sink once niri
is running clears the failed status. A transport failure never rolls back
valid generated configuration.

`niri msg action load-config-file` remains the success-path reload request,
not the validation signal: its IPC reply only confirms that the action was
queued. Tests must prove target restoration and failed sink status when the
new `niri validate` step exits nonzero.

Because the watcher may see a rejected candidate before restoration, a live
session may briefly show niri's config-error notification. The notification
clears after the watcher observes the restored valid file on its next poll; it
is visible failure feedback, not silent fallback.

## Dotfiles ownership and cleanup

Dotfiles removes `niri/materials.kdl` and its include because generated
`prism.kdl` now owns the definition and assignment. The cleanup change is
bounded to all current owners of the obsolete live consumers:

- `setup.sh` removes the generated-JSON link, named Quickshell link, and the
  root-Quickshell guard that existed only for named-config discovery, and sets
  `NIRI_CONFIG` to the tracked niri config for the pre-link Prism apply;
- `bin/dotfiles-health` removes both link checks and the same obsolete guard;
- `.gitignore` removes `niri/niri-glass.json`;
- `tests/setup_and_health.zsh` removes the setup/health fixtures and assertions
  for both consumers and replaces the static-material assertion with the
  generated native Prism contract; and
- `niri/config.kdl` removes the static include while `niri/materials.kdl` is
  deleted.

The two obsolete live consumers are:

- `$XDG_CONFIG_HOME/niri/niri-glass.json`
- `$XDG_CONFIG_HOME/quickshell/niri-glass`

After the new sink is accepted, the deployment removes those exact live
symlinks and `$XDG_STATE_HOME/prism/generated/niri-glass.json`. The
`niri-glass` repository, frozen parity worktrees, and recorded evidence remain
unchanged. Cleanup does not delete source or evidence.

User-facing dotfiles and Prism documentation is grepped for claims that the
legacy sink, JSON consumer, named Quickshell config, or isolated preview is
still active. Historical design/results records remain historical rather than
being rewritten as current instructions.

## Ordered handoff

The transition never asks new Prism to resolve values for deleted definitions,
and every intermediate configuration is valid.

**Prerequisite.** Step 4 removes the static `terminal-glass` while terminal
windows resolve it. Before the fix in niri-material `7f6e69c3`, re-resolving a
tile against a config that no longer defines its material panicked the
compositor, so this handoff requires `niri-material 26.04.r106.g7f6e69c3-1` or
later. Renaming the material instead of removing it took the same path; there
was no ordering that avoided it.

1. Implement and test Prism without applying its new niri output. Prepare two
   ordered dotfiles commits: value migration first, ownership cleanup second.
2. Fast-forward only the dotfiles value-migration commit. Current Prism still
   accepts every remaining key; removed overrides fall back only in the dead
   legacy sink or are masked by the later static material rule. The static
   `terminal-glass` definition and assignment remain active and unchanged.
3. Merge Prism and run `prism apply niri`, which is expected to fail. The
   generated definition duplicates the static one, so the sink's own
   `niri validate` rejects the candidate, restores the previous generated
   target, exits nonzero, and records the niri sink as failed with niri's
   `duplicate material: terminal-glass`. The appearance does not change. This
   step is kept because it exercises the sink's validate-and-restore path
   against the live system at no risk. A *successful* apply here means the
   static material is not where this handoff assumes: stop and investigate.
4. Hand ownership over in one chained command, so the merge that deletes the
   static material and the apply that replaces it are not separated by an
   operator step:

   ```bash
   git -C "$dotfiles_repo" merge --ff-only "$cleanup_commit" && prism apply niri
   ```

   Between the two, terminals briefly fall back to the superseded blur pass
   that the old generated file still carries. The window is normally shorter
   than niri's 500 ms configuration poll. This brief flicker is accepted
   deliberately in exchange for removing the temporary-rename mechanics that
   previously bought continuity.
5. Run `niri validate` and `prism doctor` against the final composed config,
   confirm the generated `prism.kdl` carries the material, and rerun the
   dotfiles suite. Restart Noctalia so its panel loads the reduced control
   surface, then verify exact targets and remove only the obsolete live
   symlinks and generated JSON.

Nothing in this sequence edits a tracked file outside a commit, so no
save-and-restore, checksum, or cross-step abort obligation applies. If the
apply in step 4 fails for an unrelated reason, terminals keep the superseded
pass until it is corrected, `prism doctor` reports the failed sink, and the
composed configuration remains valid.

## Verification

Prism tests prove:

- exact stable native KDL and literal app-ID matching;
- every supported material value and derived bevel reaches the renderer;
- enable/disable changes only material assignment;
- empty `terminal.apps` emits no matching rules;
- a failed composed-config validation restores the prior generated target and
  records a failed niri sink;
- a valid composed config survives a failed reload request: the target is kept,
  the sink is recorded failed, and reapplying once niri is running clears it;
- reload-bound sliders write only on release;
- removed definitions, sink, generated JSON, preview UI, and IPC commands are
  absent, including `ui.affectsPreview`;
- the existing queue, optimistic update, store, fan-out, and doctor contracts
  remain green.

Dotfiles tests prove:

- `config.kdl` includes generated `prism.kdl` exactly once and no longer
  includes static `materials.kdl`;
- setup, health, ignore rules, and fixtures no longer install or require live
  legacy consumers;
- Titan values contain no orphan keys and reproduce the accepted native
  material;
- the complete setup and health suite passes without touching unrelated dirty
  paths.

Live acceptance requires:

1. `prism doctor` passes and the composed config validates with the installed
   material-capable niri.
2. A CLI set/restore changes generated KDL, produces successful config reloads,
   changes open Kitty and Ghostty material, and restores tracked values.
3. The Noctalia panel exposes only supported controls, contains no preview
   controls, and changes both live terminal materials.
4. No legacy process, layer, live consumer link, or generated JSON remains.
5. The paused normal-session and cold-start daily-driver gates are rerun from
   a new clean journal boundary.

## Alternatives rejected

### Separate `niri-material` sink

A second sink would separate material text from opacity text, but it would add
a generated file, sink status, reload, include, health check, and ordering
edge. Both outputs target the same compositor and change together in the
panel, so the split creates mechanics without an independent lifecycle.

### Static material plus translation script

A script that rewrites dotfiles `materials.kdl` would give Prism and dotfiles
competing ownership of a generated file and introduce a transport outside the
existing sink/fan-out model. It is a compatibility layer rather than a durable
interface.

### Retain legacy controls or sink as hidden compatibility

Hidden aliases would keep orphan values and dead paths alive while masking
whether a control has a consumer. The migration is deliberately explicit:
unsupported keys fail as unknown, and historical behavior remains available
through Git and frozen evidence rather than production code.
