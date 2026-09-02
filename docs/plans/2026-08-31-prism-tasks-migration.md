# Prism Tasks migration ledger

**Status:** Prism repository Tasks migration integrated and cleaned up
2026-09-01. Stable `main` contains the integrated migration record
`6eafb98c9a64bf1fed2b8d5b40fdc86c3a7f85e9`; the migration branch, worktree,
and temporary registry were removed. Canonical registration is warning-free,
and `prism-82198e` is the sole ready todo. At ledger finalization, portfolio
reconciliation and final completion recording had not yet occurred. Reconciliation was
subsequently reviewed as a no-op, and portfolio completion and cleanup landed in Tasks
through `92587b97a4c17f28ede8175efc806b5ed361f15e`.

## Scope and evidence

| Field | Value |
| --- | --- |
| Stable source | `main` at `d20111c2182adcbbb2bd3b76356d6e1557cb1e12` |
| Tasks source | `b943419c0e37b947a0ca1814f416ff61259f4d8a` |
| Audit date | 2026-09-01 |
| Project prefix | `prism` |
| Authority roots | `~/d/prism`, production code/tests, all tracked documents, and integrated Material at `8047b6ca14ec1e2a0760a79f5d9d4883a9fc2519` |
| Companion evidence | `~/d/niri-material`, `~/d/niri-glass`, and dotfiles commits named by the audited documents, inspected read-only |
| Migration lint-baseline correction | Tasks documentation commit `7796b8319268b42633117ad3c1e00970fbfe110d`; CLI source remains the pinned commit above |

The audit read all 11 tracked paths under `docs/` and `README.md`, checked every
status header and unchecked historical step against commit ancestry, traced the
current sink and plugin code, and ran the complete automated Prism gates. No
live shell, compositor, GPU, deployment, DRM, burn-in, or subjective visual
action was repeated.

## Post-migration Git state

| Checkout or branch | Inspected state | Decision |
| --- | --- | --- |
| `~/d/prism`, `main` | Clean at `6eafb98c9a64bf1fed2b8d5b40fdc86c3a7f85e9` after final integration and cleanup | Contains the reviewed Prism Tasks store, fixes, and historical ledger. |
| `chore/tasks-migration-prism` | Removed after its ledger commit fast-forwarded to stable | Historical migration branch and linked worktree no longer exist. |

After the approved second fast-forward, the historical
`chore/tasks-migration-prism` branch and its linked worktree were removed. Its
guarded temporary registry and pointer were also removed. There were no dirty,
staged, or untracked Prism paths before the original audit; ignored
`node_modules/` was reproduced by `npm ci` in the migration worktree.

## Document classification

| Path | Classification | Reason |
| --- | --- | --- |
| `AGENTS.md` | `authority/current` | Current repository Tasks workflow guidance. |
| `README.md` | `authority/current` | Current project and test entry point; matches the sole niri sink and native Noctalia v5 plugin. |
| `docs/notes/noctalia-plugin-contract.md` | `authority/current` | Current v5 plugin contract; Node and Lua tests cover its identity, queue, presentation, and lifecycle claims. |
| `docs/superpowers/plans/2026-08-15-prism-v1.md` | `historical/superseded` | Executed v1 procedure; Task 18 Step 4 and Task 19 Step 2 are the two unchecked historical demos, while Task 20 is fully checked. |
| `docs/superpowers/plans/2026-08-16-prism-noctalia-panel.md` | `historical/superseded` | Tasks 1–5 landed; unchecked live-acceptance procedure was redirected to and satisfied by the repair plan. |
| `docs/superpowers/plans/2026-08-16-prism-panel-repair-glass-preview.md` | `historical/superseded` | Executed panel/preview repair procedure; its preview architecture was later removed by the native sink. |
| `docs/superpowers/plans/2026-08-28-niri-native-material-sink.md` | `historical/superseded` | Executed cross-repository handoff procedure; header corrected to distinguish historical unchecked steps from open work. |
| `docs/superpowers/plans/2026-08-29-prism-debug-backdrop.md` | `historical/superseded` | Fully checked implementation procedure; the ordered handoff landed in both repositories. |
| `docs/superpowers/specs/2026-08-15-prism-visual-bus-design.md` | `historical/superseded` | Implemented v1 architecture whose legacy glass sink and preview were later removed. |
| `docs/superpowers/specs/2026-08-16-prism-noctalia-panel-design.md` | `historical/superseded` | Implemented semantic-panel design explicitly superseded by the repair design. |
| `docs/superpowers/specs/2026-08-16-prism-panel-repair-glass-preview-design.md` | `historical/superseded` | Accepted historical repair and preview design; native material later removed the preview path. |
| `docs/superpowers/specs/2026-08-28-niri-native-material-sink-design.md` | `authority/current` | Current generated-material and niri sink contract; reconciled with Material burn-in and `glass.backdropBlur`. |
| `docs/superpowers/specs/2026-08-29-prism-debug-backdrop-design.md` | `authority/current` | Current debug sink contract; implementation, startup owner, and handoff are present and tested. |
| `docs/plans/2026-08-31-prism-tasks-migration.md` | `historical/superseded` | Completed audit and migration ledger; stable integration and canonical registration are recorded below. |

The final NUL-safe comparison covers exactly these 14 paths: 11 original
tracked documents, `README.md`, this ledger, and root `AGENTS.md`.

## Drift corrections

| Claim | Evidence | Correction | Outward grep result |
| --- | --- | --- | --- |
| The native-sink spec said Material burn-in was outstanding on `7f6e69c3`. | Material `7020776e` records about 13 hours, two cold starts, scoped journal review, and operator PASS; deployed source is `52f74f10`. | Status now records the 2026-08-30 PASS and package `26.04.r133.g52f74f10-1`. | Remaining future-tense burn-in text is historical procedure or a separately tracked Material acceptance outcome. |
| The native-sink plan header called Task 6 burn-in in progress. | The same Material ancestry proves the outcome completed; unchecked plan steps are not completion evidence. | Header now records completion and labels its unchecked Task 6 steps historical. | No current Prism status surface calls daily-driver burn-in incomplete. |
| The authoritative native parameter table omitted `glass.backdropBlur`. | Prism `d20111c` defines a default-false boolean, binds it reload-live, renders `backdrop-blur`, and tests exact native coverage; Material config and tests expose the same default and grammar. | Added the exact Prism-to-KDL mapping and default. | README and plugin note contain no conflicting parameter inventory; debug docs still preserve the exact-native-surface invariant. |
| The migration grouped roughness with Material-only follow-ups and said it required no Prism delivery. | Material `material-c854bd` adds native prefiltered roughness, while Prism must restore the public value and emit its KDL node. | `prism-a1bf36` restores the definition, reload binding, exact KDL, and current native-sink contract. | Current definitions, sink docs, and tests now agree; historical native-v1 omissions remain historical. |
| The debug-backdrop spec called its dependency not burned in and its ordered handoff pending. | Material burn-in passed; Prism `cacf232` and dotfiles `9562732` are ancestors and the documented suites are green. | Status and ordered handoff now record the completed evidence. | The debug implementation plan's pending wording is an executed historical instruction, not current status. |
| The native-sink design Context described the old r95 package, static dotfiles ownership, legacy sink, preview, and paused rollout as current. | The design's current status and Material `7020776e` prove the generated control path and burn-in completed on the later package. | Historicalized the entire Context as design-time state. | No current Prism status surface presents the r95 rollout or retired ownership path as current. |
| The v1 plan and initial ledger named Task 20 as an unchecked demo. | Task 18 Step 4 and Task 19 Step 2 are unchecked; all three Task 20 steps are checked. | Corrected both records and the candidate disposition. | The remaining unchecked-step references now name their actual task and step. |
| Initial synthesis treated every v1 future-work item as speculative. | The v1 authority calls Ghostty deliberately half-owned, documents current configuration drift, and specifies a Linux reload boundary; current manifests bind background opacity only to Kitty. | Added one reviewed Ghostty `todo`; dispositioned every sibling future-work entry separately. | No other current document or manifest supplies a missing Prism-owned delivery outcome. |

## Candidate outcomes

| Outcome | Evidence | Sources | Active state | Size | Proposed status | Blockers | Disposition | Task ID |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Expose Material backdrop blur through Prism | `d20111c` adds the definition, binding, renderer node, presentation, and exact-contract tests; Material implements the same default-false boolean interface. | `defs/glass.yaml`; `integrations/niri/**`; Material backdrop-blur design/config | Complete on `main` | — | — | — | `no task` | — |
| Native material ownership and daily-driver burn-in | Prism `5888970`, dotfiles `7b0efad`, and Material `7020776e` are ancestors; generated ownership, manual controls, two cold starts, journal review, and operator PASS are recorded. | Native-sink spec/plan; Material rollout design | Complete across owners | — | — | — | `no task` | — |
| Debug backdrop sink and ordered startup handoff | Prism through `cacf232` and dotfiles through `9562732` are ancestors; current tests cover the definition, convergence matrix, QML surface, and presentation. | Debug-backdrop spec/plan; `integrations/debug-backdrop/**`; tests | Complete across owners | — | — | — | `no task` | — |
| Add a Ghostty background-opacity sink | The accepted v1 design says Ghostty's single hand-edited `background-opacity` drifts specifically from `terminal.background.opacity.active`. Kitty alone consumes the focus-aware background active/inactive pair; niri separately consumes the whole-window active/inactive pair. | `docs/superpowers/specs/2026-08-15-prism-visual-bus-design.md`; `integrations/kitty/manifest.yaml`; `integrations/niri/manifest.yaml` | Unstarted | `m` | `todo` | None | `create` | `prism-82198e` |
| Historical v1 Task 18 Step 4 and Task 19 Step 2 manual demonstrations | These are the actual unchecked steps; later recorded acceptance covers slider, restoration, preview, lifecycle, and failure recovery, and current tests cover the surviving behavior. Task 20 is fully checked. | v1 and panel plans/specs | Superseded history | — | — | — | `no task` | — |
| Source priority layers and arbitration | The design defers the model until a second source exists; current production still has only the values-file/user-control source and no active delivery branch. | v1 design lines 700–702; current `src/**` | Speculative v2 design | — | — | — | `no task` | — |
| Per-window or conditional manifest bindings | No shipped manifest uses or requires `when:`, and no current integration supplies an acceptance boundary. | v1 design line 703; `integrations/**/manifest.yaml` | Speculative | — | — | — | `no task` | — |
| Out-of-tree user definitions and sinks | The authority gates this on an external integration; none exists in the inspected current state. | v1 design lines 704–705 | Speculative | — | — | — | `no task` | — |
| Optional daemon fast path | No measured performance defect or second high-frequency writer exists; the tested file bus and panel gating remain current. | v1 design lines 706–709; queue/fan-out tests | Speculative optimization | — | — | — | `no task` | — |
| Other unspecified third-party sinks | Ghostty is separated above because it closes measured drift; no other named integration has a contract or demand. | v1 design lines 710–713 | Speculative | — | — | — | `no task` | — |
| UI controls for list/string parameters | `terminal.apps` is intentionally host configuration with `control: none`; no current evidence requests interactive editing or defines safe UX. | v1 design lines 714–715; shipped definitions | Speculative UI | — | — | — | `no task` | — |
| Fold the glass role table and `noctalia-glass-sync` into Prism | The native material migration removed the legacy niri-glass sink and preview rather than extending their external role pipeline. | v1 design line 716; native-sink design and current integrations | Superseded by native material | — | — | — | `no task` | — |
| Fix frost loss during interactive material-window drag | Material owns the renderer and preserved active investigation as `material-e88df7`; Prism already emits the accepted interface and does not block that work. | Material migration ledger and task store | Active in Material | — | — | — | `no Prism task`; no dependency | `material-e88df7` |
| Verify default-off backdrop blur on physical DRM | Material owns the physical acceptance outcome as `material-ce3315`; Prism's default-false emitted contract is already implemented and tested. | Material migration ledger and task store | Todo in Material | — | — | — | `no Prism task`; no dependency | `material-ce3315` |
| Material roughness and noise/saturation follow-ups | Material owns renderer roughness as `material-c854bd`, but the accepted public control requires the matching Prism definition and native KDL. Noise/saturation remains a Material idea with no Prism contract. | Material roughness design and task store; `defs/glass.yaml`; `integrations/niri/**` | Roughness implemented by `prism-a1bf36`; noise/saturation remains external | `s` | `done` | Native roughness grammar | `created after this migration audit`; no Prism task for noise/saturation | `prism-a1bf36`, `material-c854bd`, `material-cad932` |

At the 2026-08-31 migration, exactly one row was marked `create`. The
2026-09-02 roughness correction above records the later `prism-a1bf36`; every
other v1 future-work entry remains completed, superseded, externally owned, or
lacks current delivery evidence.

### Reviewed Ghostty task fields

- Task ID: `prism-82198e`
- Title: `Add a Ghostty background-opacity sink`
- Status: `todo`
- Owner: none
- Priority: `2`
- Size: `m`
- Tags: `migration`, `integration`, `terminal`
- Blockers: none
- Body: `Outcome: Prism owns Ghostty's single static background-opacity from terminal.background.opacity.active, removing the hand-edited drift without implying focus-aware Ghostty behavior. Acceptance evidence: add a validated Ghostty sink bound only to terminal.background.opacity.active with reload liveness; prove deterministic config or apply behavior and exact failure handling with runnable tests; migrate the dotfiles Ghostty background-opacity owner without unrelated changes; and verify systemd reload updates a live Linux Ghostty instance while restoration and prism doctor remain healthy. Kitty remains the focus-aware consumer of terminal.background.opacity.active and terminal.background.opacity.inactive; niri separately owns terminal.window.opacity.active and terminal.window.opacity.inactive. Sources: docs/superpowers/specs/2026-08-15-prism-visual-bus-design.md, integrations/kitty/manifest.yaml, and integrations/niri/manifest.yaml. Uncertainty: the authority verified Ghostty 1.3.1 reload_config and systemctl reload behavior, but the current checkout has no captured Ghostty config/apply contract and the live handoff must confirm the service-unit behavior still matches.`

## Deferred foreign dependencies

The Ghostty task has no Material blocker. Prism roughness depends on the native
grammar owned by `material-c854bd`; `prism-a1bf36` implements and tests the
Prism side without broadening that renderer task.

## Independent review

Round 1 corrected four integration blockers without rewriting the two phase-A
commits:

1. Created `prism-82198e` for the evidence-backed Ghostty ownership gap and
   recorded a separate disposition for every v1 future-work entry.
2. Historicalized the native-sink design paragraph that still called the
   completed rollout paused.
3. Corrected the unchecked-demo identity to Task 18 Step 4 and Task 19 Step 2;
   Task 20 is fully checked.
4. Corrected the controlling design and plan in the Tasks repository to accept
   exactly the deterministic `PanelWindow` `[uncreatable-type]` warning, not
   unresolved `qs.*` warnings. That docs-only correction is `7796b831`; the
   installed CLI and recorded Tasks source remain `b943419c`.

Round 2 corrected the Ghostty acceptance contract. The v1 authority maps its
single static `background-opacity` only to `terminal.background.opacity.active`;
there is no evidence for focus-aware Ghostty behavior. The task body and
candidate evidence now keep Kitty's background active/inactive pair and niri's
separate whole-window active/inactive pair out of the Ghostty sink contract.

## Stable integration

Stable `main` fast-forwarded from
`d20111c2182adcbbb2bd3b76356d6e1557cb1e12` to first-integrated head
`0af1d0f9c170875d94105b17876ad1334758204f` on 2026-09-01. That head contains
the complete reviewed migration sequence:

1. `aa526843d43a33bf3ea6fee91adc2fd01b87ed0e` — documentation
   reconciliation;
2. `2e288241723d2301123bbe870491c373cf383bc7` — initial Tasks store and
   repository guidance;
3. `52cf99a11cbc2ddc8ce88610ce7099f0e87ea56a` — round-1 review corrections
   and the Ghostty task; and
4. `0af1d0f9c170875d94105b17876ad1334758204f` — active-only Ghostty
   acceptance correction.

The stable checkout had Node `v26.5.0`, npm `11.17.0`, and Lua `5.5.1`; the
Node major-version check passed. Its tracked status was clean before and after
`npm ci`; the ignored `node_modules/` directory was reproduced without a
tracked change. `npm test` passed all 140 Node tests and the direct Lua plugin
test. Qt 6 `qmllint` exited zero with exactly one diagnostic,
`Type PanelWindow is not creatable. [uncreatable-type]`, at
`integrations/debug-backdrop/shell.qml:9:9`, and no `qs.*` warning.

Two consecutive canonical `tasks init --prefix prism` calls from stable each
returned prefix `prism` and an empty warning list. The canonical mapping
resolves `prism` to the stable checkout. Stable `tasks check` returned no
errors or warnings; `tasks prime` returned prefix `prism`, one todo, and
`prism-82198e` as the sole ready task with no warnings; `tasks ready` returned
that same sole task with no warnings. Stable remained clean at the
first-integrated head after every gate.

## Final integration and cleanup

After independent approval of the ledger-only commit, a second `--ff-only`
merge advanced stable `main` from
`0af1d0f9c170875d94105b17876ad1334758204f` to final integrated head
`6eafb98c9a64bf1fed2b8d5b40fdc86c3a7f85e9`. The migration worktree and
merged `chore/tasks-migration-prism` branch were then removed, followed only
by the guarded Prism temporary registry and its pointer. Final stable status
was clean on `main`.

Normal-registry verification at the final head returned no errors or warnings
from `tasks check`; `tasks prime` reported prefix `prism`, one todo, and
`prism-82198e` as the sole ready task with no warnings; `tasks ready` returned
that same sole task with no warnings. No relative `tasks/projects.toml` exists.
This repository migration was integrated at ledger finalization; portfolio
reconciliation and final completion recording were then separate plan work. They
subsequently completed through the reviewed no-op reconciliation, exact-eight gate,
portfolio fast-forward, and guarded cleanup recorded by Tasks.

## Verification

| Command | Result | Commit containing the recorded result |
| --- | --- | --- |
| Baseline `npm ci && npm test` | PASS: 140 Node tests and the direct Lua plugin checks; zero failures. | `aa526843d43a33bf3ea6fee91adc2fd01b87ed0e` |
| Baseline `/usr/lib/qt6/bin/qmllint integrations/debug-backdrop/shell.qml` | Exit 0 with exactly `Type PanelWindow is not creatable. [uncreatable-type]` at line 9:9. | `aa526843d43a33bf3ea6fee91adc2fd01b87ed0e` |
| Commit-ancestry checks for every status boundary named above | PASS; all named Prism, Material, niri-glass, and dotfiles commits are ancestors of their inspected heads. | `aa526843d43a33bf3ea6fee91adc2fd01b87ed0e` |
| NUL-safe exact document coverage comparison | PASS before task initialization at 13 paths and after root guidance at 14 paths. | `2e288241723d2301123bbe870491c373cf383bc7` |
| Pre-initialization `tasks prime` | Expected failure with `no_project`; no project config existed. | `2e288241723d2301123bbe870491c373cf383bc7` |
| Exact-eight temporary registry initialization | PASS: `fam`, `atoms`, `beliefs`, `nodes`, `mind3`, `mind6`, `material`, and `prism`; every init returned zero warnings. | `2e288241723d2301123bbe870491c373cf383bc7` |
| Initial zero-task synthesis | Superseded by independent review: the Ghostty ownership gap required `prism-82198e`. | Review fix commit (this commit) |
| Initial `tasks check`, `tasks prime`, and `tasks ready` under the exact-eight registry | PASS before review with zero errors/warnings and no tasks; superseded by the reviewed Ghostty task. | `2e288241723d2301123bbe870491c373cf383bc7` |
| Initial final `npm ci && npm test` | PASS: 140 Node tests and direct Lua checks; zero failures. | `2e288241723d2301123bbe870491c373cf383bc7` |
| Initial final `/usr/lib/qt6/bin/qmllint integrations/debug-backdrop/shell.qml` | Exit 0 with exactly `Type PanelWindow is not creatable. [uncreatable-type]` at line 9:9. | `2e288241723d2301123bbe870491c373cf383bc7` |
| Review-fix NUL-safe exact document coverage | PASS: 14 actual paths equal 14 classified paths. | Review fix commit (this commit) |
| Round-1 `tasks show prism-82198e` | PASS at round 1; its two-value body was superseded by the authoritative active-only round-2 correction. | Review fix commit (this commit) |
| Review-fix `tasks check`, `tasks prime`, and `tasks ready` | PASS: zero errors/warnings; counts are one todo and zero otherwise; `prism-82198e` is the sole ready task. | Review fix commit (this commit) |
| Review-fix `npm ci && npm test` | PASS: 140 Node tests and direct Lua checks; zero failures. | Review fix commit (this commit) |
| Review-fix `/usr/lib/qt6/bin/qmllint integrations/debug-backdrop/shell.qml` | Exit 0 with exactly one warning: `Type PanelWindow is not creatable. [uncreatable-type]` at line 9:9; no `qs.*` warning. | Review fix commit (this commit) |
| Review-fix no-relative-registry and diff checks | PASS: no `tasks/projects.toml`; working and cached diffs contain no whitespace errors. | Review fix commit (this commit) |
| Round-2 `tasks show prism-82198e` | PASS: body binds Ghostty only to `terminal.background.opacity.active`; title, todo status, priority 2, size `m`, tags, null owner/document links, and no blockers are preserved; zero warnings. | Round-2 review fix (this commit) |
| Round-2 `tasks check`, `tasks prime`, and `tasks ready` | PASS: zero errors/warnings; counts remain one todo and zero otherwise; `prism-82198e` is the sole ready task. | Round-2 review fix (this commit) |
| Round-2 coverage, focused drift/future-work, registry, and diff checks | PASS: 14 actual paths equal 14 classified paths; no two-value Ghostty acceptance survives; every future-work disposition remains; no relative registry or whitespace error. | Round-2 review fix (this commit) |
| First stable fast-forward | PASS: `main` advanced from `d20111c2182adcbbb2bd3b76356d6e1557cb1e12` through all four reviewed migration commits to `0af1d0f9c170875d94105b17876ad1334758204f`. | Ledger finalization (this commit) |
| Stable versions, `npm ci`, and `npm test` | PASS: Node `v26.5.0`, npm `11.17.0`, Lua `5.5.1`; clean tracked status around the ignored dependency replacement; 140 Node tests and direct Lua checks passed. | Ledger finalization (this commit) |
| Stable Qt 6 `qmllint` | Exit 0 with exactly one `Type PanelWindow is not creatable. [uncreatable-type]` diagnostic at line 9:9 and no `qs.*` warning. | Ledger finalization (this commit) |
| Canonical Prism registration twice | PASS: both calls returned prefix `prism` and zero warnings; the mapping resolves to stable. | Ledger finalization (this commit) |
| Stable `tasks check`, `tasks prime`, and `tasks ready` | PASS: no errors or warnings; one todo; `prism-82198e` is the sole ready task. | Ledger finalization (this commit) |
| Stable post-gate Git status | PASS: clean at first-integrated head `0af1d0f9c170875d94105b17876ad1334758204f`. | Ledger finalization (this commit) |
| Second stable fast-forward and cleanup | PASS: stable advanced to `6eafb98c9a64bf1fed2b8d5b40fdc86c3a7f85e9`; the migration worktree, merged branch, guarded temporary registry, and pointer were removed; stable remained clean. | Post-cleanup review evidence |
| Final normal-registry `tasks check`, `tasks prime`, and `tasks ready` | PASS: prefix `prism`; no errors or warnings; one todo; `prism-82198e` is the sole ready task. | Post-cleanup review evidence |
| Subsequent portfolio reconciliation, completion, and cleanup | PASS: reconciliation was a reviewed no-op; the exact-eight gate completed warning-free; completion commit `ced9c4559b188c9f2af7e03d12d4fb44a18985bb` was fast-forwarded; and Tasks recorded guarded cleanup in `92587b97a4c17f28ede8175efc806b5ed361f15e`. | Central Tasks portfolio record |
