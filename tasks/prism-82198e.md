---
id: prism-82198e
title: Add a Ghostty background-opacity sink
status: todo
priority: 2
size: m
complexity: mid
process: direct
created: 2026-09-01T15:48:11Z
updated: 2026-10-14T14:29:21Z
depends: []
tags: [migration, integration, terminal]
---

Outcome: Prism owns Ghostty's single static background-opacity from terminal.background.opacity.active, removing the hand-edited drift without implying focus-aware Ghostty behavior. Acceptance evidence: add a validated Ghostty sink bound only to terminal.background.opacity.active with reload liveness; prove deterministic config or apply behavior and exact failure handling with runnable tests; migrate the dotfiles Ghostty background-opacity owner without unrelated changes; and verify systemd reload updates a live Linux Ghostty instance while restoration and prism doctor remain healthy. Kitty remains the focus-aware consumer of terminal.background.opacity.active and terminal.background.opacity.inactive; niri separately owns terminal.window.opacity.active and terminal.window.opacity.inactive. Sources: docs/superpowers/specs/2026-08-15-prism-visual-bus-design.md, integrations/kitty/manifest.yaml, and integrations/niri/manifest.yaml. Uncertainty: the authority verified Ghostty 1.3.1 reload_config and systemctl reload behavior, but the current checkout has no captured Ghostty config/apply contract and the live handoff must confirm the service-unit behavior still matches.

## Established (re-scope 2026-10-14, at 570c1f7)

The paragraph above predates two decisions recorded in the notes. `terminal.window.opacity.*` were removed (`prism-aa9212`), and Kitty is no longer focus-aware for opacity: `integrations/kitty/render.js` writes `background_opacity` from `terminal.background.opacity.active`, which defaults to 0. Focus state is carried by niri's `is-active` material pair (`prism-5bc782`, `dots-a00088`). What follows replaces the stale parts.

- Niri already treats Ghostty as a glass terminal: `terminal.apps` defaults to `[kitty, com.mitchellh.ghostty]` (`defs/terminal.yaml`). Ghostty's own opaque background is therefore the drift.
- The drift is the dotfiles `ghostty/config.ghostty`, line 8: `background-opacity = 0.85`. Its comment cites a whole-window fade in niri's config, which no longer exists.
- Ghostty 1.3.1 is installed. The packaged user unit `app-com.mitchellh.ghostty.service` (disabled on this host, and Ghostty was not running at re-scope) declares only `ExecStart`. There is no `ExecReload`, so a `systemctl --user reload` path cannot be assumed. Find and test the reload trigger (a signal to the process or a `reload_config` action) before relying on it.
- No Ghostty sink exists in `integrations/`. The Kitty sink is the pattern to copy: `manifest.yaml`, `render.js`, and an `apply` that writes the generated file atomically under `generatedPath`.

## Remaining

- Add an `integrations/ghostty` sink bound to `terminal.background.opacity.active` only. It emits `background-opacity` (0 by default, so Ghostty joins the glass) into a generated file that the Ghostty config includes.
- Reload liveness goes through the verified trigger. Failure handling and tests follow the Kitty sink's.
- Migrate the dotfiles line to that include, and drop the stale comment, with no unrelated changes.
- Verify on a live Ghostty window, with `prism doctor` healthy.

## Notes

- 2026-09-05T08:20:23Z (main): 2026-09-05: terminal.window.opacity.* were removed with the panel matrix (prism-aa9212); niri no longer emits whole-window opacity rules. The Ghostty sink binds only terminal.background.opacity.active as planned.
- 2026-09-07T08:21:16Z (main): 2026-09-07: the body predates the zero-opacity decision. Kitty is no longer a focus-aware opacity consumer: Prism emits background_opacity 0 for it and niri's is-active material pair carries focus state (prism-5bc782, dots-a00088). The Ghostty sink should emit 0 from terminal.background.opacity.active so Ghostty joins the glass, and the dotfiles ghostty/config.ghostty line at 0.85 is the drift to remove. Re-read the acceptance with that in mind before starting.
- 2026-10-14T14:29:20Z (main): scope: rescoped; premises hold at 570c1f7: no Ghostty sink, niri glass already matches com.mitchellh.ghostty, dotfiles config.ghostty still sets 0.85; body now folds in the 09-05/09-07 notes (emit 0, Kitty no longer focus-aware); new finding: the packaged Ghostty unit has no ExecReload, so the reload trigger must be verified; process direct
