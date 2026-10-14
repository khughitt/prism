# Panel ergonomics brief

## Problem

Tuning in the Prism panel should be fast to explore, safe to back out of, and show what a
change does. Four captured ideas share that outcome: a general undo (`prism-b25061`), one
control that opens or closes every rack card (`prism-ddeb30`), a focused and an unfocused
glass window both in view while a split parameter is tuned (`prism-1c111f`), and a bar icon
that fits the shell (`prism-cc589b`). Goal `prism-67b1b2` holds them.

## Current behaviour and evidence

- **Writes.** The panel enqueues one CLI command per write (`integrations/noctalia-plugin/queue.luau`
  `argvFor`: `set`, `unset`, `reset <mode> [--group]`, `commit`, context verbs). Since
  `ad17477` every edit lands in the scratch layer, so `prism reset revert` already discards
  all pending edits at once; there is no step-wise undo. The dice (`rollDice`, `panel.luau`)
  enqueues one `set` per drawn slider; a drag samples many `set`s; a section or panel reset is
  one `reset` command. Commits, profile deletes, renames and pair clears carry
  `--expect-look`/`--expect-wallpaper` and, for deletes, a confirm row. Wallpaper rotation
  rewrites scratch (`docs/specs/2026-09-27-rotation-keeps-edits-design.md`). The keyboard
  vocabulary exists (`prism-84d308`); `ctrl+z` is not captured (`plugin.toml`).
- **Expansion.** Only rack device cards collapse: `state.expanded[device]`, toggled by each
  card's chevron and name (`cardHead`). Parameter sections (Focus, Ring, …) have headers with
  reset buttons and no collapse. Render cost is 10–12 ms with cards collapsed and 13–14 ms
  with all expanded against Noctalia's 25 ms callback budget (`prism-831604`, `prism-dac509`).
- **Focus preview.** Prism assigns `terminal-glass` and `terminal-glass-inactive` by
  `is-active` (`integrations/niri/render.js` `assignmentRule`). Per niri's window-rule docs
  the workspace's active window stays active while a layer surface holds keyboard focus, so
  an open panel does not unfocus the glass. Both materials are on screen exactly when a second
  `terminal.apps` window is in view. niri IPC reports column positions, tile sizes and the
  workspace's scrolling view position, from which visibility can be computed. The debug
  backdrop design keeps live terminals as the preview surface and rules out a separate preview
  window (`docs/superpowers/specs/2026-08-29-prism-debug-backdrop-design.md`).
- **Icon.** `widget.luau` sets `barWidget.setGlyph("wand")`. Noctalia's glyph set
  (`assets/fonts/tabler.json` in the Noctalia checkout) has `prism`, `prism-light`,
  `diamond`, `diamonds`, `triangle`, `color-filter`, `contrast-2`, `blur`, `sparkles`.

## Constraints

- Keep the fast explore loop: no confirmation on resets or the dice (`prism-91edc5`).
- Undo must not duplicate `prism-6aca8a`'s gesture records; both record panel writes with
  gesture boundaries, and one log may serve both.
- Expanding every card stays inside the render budget measured above; re-measure after the
  change while `prism-dac509` is open. `prism-d2ba46` restricts the dice to drawn sliders, so
  expand-all also widens what the dice rolls.
- No compositor changes and no separate preview window; the user's window layout is theirs.

## Alternatives

1. **Undo:** (a) a store-side journal of commands with gesture ids, undone by the CLI so the
   shell and the panel share it — current lean; (b) panel-session history replaying inverse
   writes, cheap but lost on close and blind to CLI writes; (c) rely on `reset revert` plus
   snapshots, which loses step-wise recovery.
2. **Focus preview:** (a) a panel hint when no unfocused glass window is in view — current
   lean if visibility is computable; (b) scroll a neighbouring terminal column into view;
   (c) spawn a probe terminal while tuning. (b) and (c) change the user's layout.
3. **Expansion:** one button in the rack header that expands every card when any is
   collapsed and collapses all otherwise — chosen; collapsible parameter sections are new
   scope if wanted.

## Unanswered questions

- Undo's history location, unit, coverage of commits and deletes, behaviour after rotation,
  and redo: `prism-f52f8e` designs them.
- Can the panel tell that no unfocused glass window is in view, and which remedy keeps the
  active window active: `prism-c0500d` answers.
- Which glyph fits the bar: the owner, from a candidate sheet in `prism-cc589b`.

## Proposed decomposition

- `prism-ddeb30` — scoped (todo): expand/collapse-all button on the rack header.
- `prism-cc589b` — scoped (todo): candidate glyph sheet, owner picks, one-line change.
- `prism-b25061` — waits on `prism-f52f8e` (design, high, planned).
- `prism-1c111f` — waits on `prism-c0500d` (research, mid, direct).
- No shared resource vocabulary exists in `tasks/.config.toml`; an `owner-judgement` need for
  visual picks such as `prism-cc589b` could be declared there.
