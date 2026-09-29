# Panel integration requirements brief

## Problem

Make the separately installed Prism panel and CLI diagnosable, and ground proposed controls in supported Noctalia capabilities. This pass covers version mismatch diagnosis (`prism-e89aad`), accent icon buttons (`prism-ed35d4`), and rotary controls with a landscape layout (`prism-686374`). Prefer an explicit describe contract check now, reuse existing styling research for icon color, and defer the knob redesign.

## Current behaviour and evidence

At `bc8905f`, `src/cli.js` emits active, profiles, layers, rack, and params without a contract version. `panel.luau` validates fields before accepting a model and preserves its last valid model on errors. The real-output contract test (`01ae410`, `integrations/noctalia-plugin/contract.test.mjs`) covers a matching checkout, not independently upgraded installations. The current plugin contract documents that old panels require the removed target field; the original idea's one-sided failure description is stale.

`plugin.toml` declares API 22 and a 756 by 798 panel. The panel uses native sliders, expandable rack cards, and dimmed reset buttons. Its lightRow comment explicitly identifies button color as unavailable at the declared API. The accepted rack design (`docs/specs/2026-09-08-device-chain-rack-design.md`, implementation `73cb51d`) supplies the current interaction baseline; ten devices now appear in `defs/rack/devices.yaml`.

The September 6 task notes record a button-color shell contribution and a draft upstream PR, and an API survey without knobs. Those are historical evidence, not verification of current shell support or merge status. The external checkout, external drafts, and installed renderer were not inspected in this fixed-checkout pass. No local attached draft or dedicated brief supersedes this handoff.

## Constraints

Keep the describe contract version distinct from plugin_api and release version. Preserve detailed validation and the existing error lifecycle. An old panel cannot acquire a new mismatch diagnostic without reinstalling it. The task capture already requests explicit versioning; exact matching is a bounded implementation choice, with no compatibility layer.

Preserve reset tooltips, unavailable and no-op states, focus alignment, and current drag handling in any later icon or control change. Existing `prism-569378` already investigates shell styling capability; extend its evidence checklist rather than create duplicate research. It remains under `prism-a03862`. Undo (`prism-b25061`) is separate persistence work and was not processed.

## Alternatives

1. **Explicit contract version and existing native controls — recommended.** Version the CLI description and diagnose mismatches before field checks. Investigate accent glyphs within the existing styling pass.
2. **Keep only field validation.** No implementation cost, but independently upgraded installations still produce unexplained field errors; the existing test cannot solve that installation case.
3. **Broader shell and landscape redesign.** Could provide rotary controls, but requires current capability evidence and a readable layout before a contribution or redesign is justified.

## Unanswered questions

- Are native button glyph color and container tooltips available on a supported shell, and what minimum API is required? `prism-569378` answers from current capability evidence and a bounded visual sample; this pass does not infer availability from old PR notes.
- Is the API requirement worth adopting for reset-icon accents, and is the result legible? The owner judges the feasibility sample before implementation design.
- Would rotary controls improve the current focus matrix at the current device count? Revisit after verified native support and a concrete layout comparison; neither is established here.

## Proposed decomposition

- `prism-4e5039` owns the three previously unparented members and links this handoff.
- `prism-e89aad`: scoped to todo, P2, small, low complexity, direct. Add integer contractVersion 1, require exact agreement before shape validation, and test unversioned/malformed/mismatched output and valid-version shape errors through the existing harness.
- `prism-ed35d4`: briefed, remains an idea. Reuse `prism-569378` (P3, medium, mid complexity, direct investigation); its completion records capability findings in both briefs and adds a finding note to this idea as well as its existing waiting ideas in the same commit.
- `prism-686374`: shelved until supported native rotary controls and a concrete useful landscape layout are established. Preserve its original capture and notes; no shell contribution or new design task is filed now.
