# Store diagnosis and repair

## Problem

Make store maintenance match today's saved looks, wallpaper pairs and pending
edits. This pass groups orphan cleanup (`prism-6c4469`), stale bus diagnosis
(`prism-ebbd33`) and the proposed runtime-context relocation (`prism-859bb7`):
all three describe storage problems captured before the current layout landed.

## Current behaviour and evidence

Inspected at `85f8be4`. `src/cli.js` now validates the proposed `unset` result
before writing (`ad17477`). An isolated base with two orphan keys still refuses
to unset the first, but preserves its original bytes. `unset` reaches scratch or
base, not saved profile settings or their wallpaper pairs. `doctor` enumerates
all looks, every pair and scratch; it distinguishes known replacements, which
already have `prism migrate`, from true orphans.

`doctor` compares sink snapshots with a fresh resolution but never reads
`resolved.json`. An isolated experiment with empty integrations, valid inputs
and deliberately incorrect bus params returned `doctor: ok`, exit 0. The bus
diagnostic is a bounded implementation task; it needs no new storage model.

`adeeebd` / `prism-01554f` cut over to the current layout. `src/paths.js` and
`src/contexts.js` put active selection and scratch in state `active.json`, while
saved looks and their pairs remain config. An isolated wallpaper activation
created state `active.json` without creating config `contexts/wallpaper`.
The blanket relocation premise is superseded; dotfiles setup/health and any
remaining live-host leakage were not inspected in this checkout.

`just test-fast` passed: 490 Node/contract tests and the Lua plugin checks.
The experiments used temporary config/state directories and removed them.

## Constraints

The [pair design](../specs/2026-09-20-profile-wallpaper-pairs-design.md) and
[implemented plan](../plans/2026-09-20-profile-wallpaper-pairs.md) establish saved
look ownership, atomic runtime publication, and interruption recovery. Code and
`README.md` confirm the layout despite stale branch-status prose in the spec.
Preserve the [rotation carry rule](../specs/2026-09-27-rotation-keeps-edits-design.md).
Diagnostics must remain read-only; invalid store inputs must not be hidden.

`src/migrate.js` already supplies all-look/pair traversal, replacement detection,
backups and per-document atomic writes. Reuse those primitives where applicable.
Do not silently discard replacement values, add journalling, or present a locked
multi-file operation as crash-atomic. `prism-b25061` concerns interactive undo,
not maintenance recovery. No overlapping open local repair research/design task
or handoff was found; existing profile-selection and exploration designs stay
separate.

## Alternatives

1. **Direct bus diagnosis plus explicit backed-up orphan cleanup — current lean.**
   Ship the small diagnostic independently; review cleanup's deletion and recovery
   contract before implementation. Retain the intentional config/state split.
2. **Keep manual YAML repair.** No new mutation command, but multiple orphans and
   inactive pairs remain awkward to repair; doctor's single-key remedy can fail.
3. **Move all contexts or transact the whole store.** Much broader than these
   demonstrated gaps, and changes the established saved-look ownership contract.
   The current evidence does not justify it.

## Unanswered questions

- Should cleanup be `doctor --prune` or a separate `prune` verb? The design task
  chooses a clear explicit write surface; ordinary doctor remains read-only.
- How does cleanup handle known replacements, malformed inactive files, backups,
  an interrupted write prefix, bus refresh and sink application? The design task
  traces current migration/repair behavior and specifies refusal/retry cases.
- Does the host still have a specific runtime leak after migration? A concrete
  dotfiles-health report can answer this. It does not justify moving saved looks;
  any remaining host cleanup needs its own accurately scoped report.

## Proposed decomposition

- `prism-5a7c8a` groups the three previously unparented records and the follow-up.
- `prism-ebbd33`: scoped P2/s/low/direct. Diagnose missing, malformed or unequal
  bus snapshots inside the locked read, retain sink checks, and prove read-only
  diagnostics plus repair by apply. Its task body contains acceptance criteria.
- `prism-6c4469`: briefed; preserve its original capture and correct the obsolete
  partial-write claim. `prism-d47f43` designs safe orphan cleanup
  (P2/s/high/planned), with reviewed spec/plan and bounded implementation follow-up.
  Completion updates this brief and adds a finding note to `prism-6c4469` in the
  same commit so a later scope pass can reconsider it.
- `prism-859bb7`: propose dropping the blanket relocation request, supported by
  `adeeebd` / `prism-01554f` and the current documented layout. It remains an idea
  pending disposition; this pass neither drops it nor claims host cleanup passed.
