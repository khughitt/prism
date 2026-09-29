---
id: prism-ed35d4
title: Accent-colored icon buttons need a Noctalia contribution
status: idea
priority: 2
created: 2026-09-05T22:29:35Z
updated: 2026-09-29T22:58:39Z
depends: []
parent: prism-4e5039
tags: [noctalia, ui]
---

The panel's reset icons carry their state in opacity (dim at default, full strength when modified) because Noctalia's ui.button exposes no color prop: variant picks from fixed palettes, and only Primary/selected produce an accent, both as a fill rather than a colored glyph. ui.glyph does take a color, but a box+glyph composite loses the tooltip, which only button and dragSource support. A colored-glyph icon button therefore needs an upstream change - a color prop on button, or tooltip support on box - in the Noctalia checkouts under software/noctalia. Same class of blocker as prism-686374 (knobs need a contribution to Noctalia itself).

## Notes

- 2026-09-06T09:26:09Z (main): Scoped by prism-46ad16: this is the one panel want that needs a shell change. Proposal written at software/noctalia docs/superpowers/specs/2026-09-06-plugin-ui-button-color-and-container-tooltip.md (uncommitted in the fork): A) a color prop on ui.button applied after variant via Button::setCustomPalette, normal-state label/glyph only; B) tooltip on ui.box/row/column/image via the existing InputArea wrapper. Either unblocks this; file A first. Installed shell is v5.0.1 (API 30); prism declares API 22.
- 2026-09-06T09:40:45Z (main): Spec revised after review (API registration advances kCurrentPluginApiVersion per feature; unconditional palette rule via Button::defaultPalette(variant()) + withLabelColor; disabled keeps the custom color with alpha multiplied by 0.55; tooltip routed through wantsInputAreaWrapper with a non-empty predicate; acceptance criteria added). Now lives in the noctalia checkout's worktree .worktrees/plugin-ui-color-tooltip (branch feat/plugin-ui-color-tooltip off main 224da6dd4), untracked there because that checkout's .git/info/exclude ignores docs/superpowers/.
- 2026-09-06T09:49:57Z (main): Implementation plan written (8 tasks, TDD, two API levels 31 button-color and 32 container-tooltip): noctalia worktree .worktrees/plugin-ui-color-tooltip docs/superpowers/plans/2026-09-06-plugin-ui-button-color-and-container-tooltip.md, untracked there like the spec.
- 2026-09-06T10:55:42Z (main): Restructured: two worktrees off noctalia main 224da6dd4, .worktrees/plugin-ui-button-color (feat/plugin-ui-button-color) and .worktrees/plugin-ui-container-tooltip (feat/plugin-ui-container-tooltip), each claiming plugin API 31 (second to merge renumbers to 32). Spec and the two plans (2026-09-06-plugin-ui-button-color.md, 2026-09-06-plugin-ui-container-tooltip.md) live untracked in the primary checkout's docs/superpowers/; no docs commits on either branch.
- 2026-09-06T12:05:47Z (main): Button color implemented in the noctalia worktree .worktrees/plugin-ui-button-color: branch feat/plugin-ui-button-color = main (224da6dd4) + 3 commits (38a1e4052 palette helpers, 30ffde631 color prop + reconciler tests, 019f16079 API 31 registration + docs). Full suite 112/113, the one failure (template_undo_signal, ghostty undo.sh template) is pre-existing at main. Format and narrowed clang-tidy clean. Not pushed; live check with the prism panel still to do by hand before filing.
- 2026-09-06T15:21:08Z (main): Button color merged locally: noctalia main is now 019f16079 = upstream/main 224da6dd4 + 3 commits (fast-forward); worktree and branch removed. Not pushed and no PR yet; to file, push a branch from those three commits. Consequence for the sibling: .worktrees/plugin-ui-container-tooltip still sits at 224da6dd4 and its plan claims API 31; when it runs, rebase it onto local main first and register as 32, or file button-color upstream before starting it.
- 2026-09-06T21:14:00Z (main): Screenshot for the button-color PR captured in a nested niri session with the built shell and a throwaway plugin (harness in the session scratchpad): noctalia docs/superpowers/pr/2026-09-06-button-color.png; PR draft updated with the manual-test paragraph. Live desktop untouched.
- 2026-09-06T21:30:43Z (main): Draft PR opened upstream: https://github.com/noctalia-dev/noctalia/pull/4320 (head khughitt:feat/plugin-ui-button-color = 019f16079, three commits; screenshot served from the fork's pr-assets branch). Still a draft pending maintainer feedback.
- 2026-09-29T22:58:39Z (main): scope: briefed; reuse prism-569378 to verify native button glyph color, tooltip preservation, and minimum API before adoption; historical shell contribution status is unverified; brief: docs/notes/2026-09-29-panel-integration-brief.md
