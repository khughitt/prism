# Prism Tasks migration ledger

**Status:** migration in progress 2026-09-01; documentation audit complete and
the Prism task store is not yet initialized.

## Scope and evidence

| Field | Value |
| --- | --- |
| Stable source | `main` at `d20111c2182adcbbb2bd3b76356d6e1557cb1e12` |
| Tasks source | `b943419c0e37b947a0ca1814f416ff61259f4d8a` |
| Audit date | 2026-09-01 |
| Project prefix | `prism` |
| Authority roots | `~/d/prism`, production code/tests, all tracked documents, and integrated Material at `8047b6ca14ec1e2a0760a79f5d9d4883a9fc2519` |
| Companion evidence | `~/d/niri-material`, `~/d/niri-glass`, and dotfiles commits named by the audited documents, inspected read-only |

The audit read all 11 tracked paths under `docs/` and `README.md`, checked every
status header and unchecked historical step against commit ancestry, traced the
current sink and plugin code, and ran the complete automated Prism gates. No
live shell, compositor, GPU, deployment, DRM, burn-in, or subjective visual
action was repeated.

## Git state inspected

| Checkout or branch | Inspected state | Decision |
| --- | --- | --- |
| `~/d/prism`, `main` | Clean at `d20111c2182adcbbb2bd3b76356d6e1557cb1e12` | Approved stable source; read-only during this phase. |
| `chore/tasks-migration-prism` | Fresh linked worktree from the same commit; clean before audit | Sole location for migration writes. |

These are the only local branches and linked worktrees. There were no dirty,
staged, or untracked Prism paths before the audit; ignored `node_modules/` was
reproduced by `npm ci` in the migration worktree.

## Document classification

| Path | Classification | Reason |
| --- | --- | --- |
| `README.md` | `authority/current` | Current project and test entry point; matches the sole niri sink and native Noctalia v5 plugin. |
| `docs/notes/noctalia-plugin-contract.md` | `authority/current` | Current v5 plugin contract; Node and Lua tests cover its identity, queue, presentation, and lifecycle claims. |
| `docs/superpowers/plans/2026-08-15-prism-v1.md` | `historical/superseded` | Executed v1 procedure; two unchecked demo/system steps are explicitly historical and later acceptance supersedes them. |
| `docs/superpowers/plans/2026-08-16-prism-noctalia-panel.md` | `historical/superseded` | Tasks 1–5 landed; unchecked live-acceptance procedure was redirected to and satisfied by the repair plan. |
| `docs/superpowers/plans/2026-08-16-prism-panel-repair-glass-preview.md` | `historical/superseded` | Executed panel/preview repair procedure; its preview architecture was later removed by the native sink. |
| `docs/superpowers/plans/2026-08-28-niri-native-material-sink.md` | `historical/superseded` | Executed cross-repository handoff procedure; header corrected to distinguish historical unchecked steps from open work. |
| `docs/superpowers/plans/2026-08-29-prism-debug-backdrop.md` | `historical/superseded` | Fully checked implementation procedure; the ordered handoff landed in both repositories. |
| `docs/superpowers/specs/2026-08-15-prism-visual-bus-design.md` | `historical/superseded` | Implemented v1 architecture whose legacy glass sink and preview were later removed. |
| `docs/superpowers/specs/2026-08-16-prism-noctalia-panel-design.md` | `historical/superseded` | Implemented semantic-panel design explicitly superseded by the repair design. |
| `docs/superpowers/specs/2026-08-16-prism-panel-repair-glass-preview-design.md` | `historical/superseded` | Accepted historical repair and preview design; native material later removed the preview path. |
| `docs/superpowers/specs/2026-08-28-niri-native-material-sink-design.md` | `authority/current` | Current generated-material and niri sink contract; reconciled with Material burn-in and `glass.backdropBlur`. |
| `docs/superpowers/specs/2026-08-29-prism-debug-backdrop-design.md` | `authority/current` | Current debug sink contract; implementation, startup owner, and handoff are present and tested. |
| `docs/plans/2026-08-31-prism-tasks-migration.md` | `active delivery` | Current audit and migration ledger. |

The initial NUL-safe comparison covers exactly these 13 paths: 11 tracked
documents, `README.md`, and this ledger. Root `AGENTS.md` is added and
classified with the task store.

## Drift corrections

| Claim | Evidence | Correction | Outward grep result |
| --- | --- | --- | --- |
| The native-sink spec said Material burn-in was outstanding on `7f6e69c3`. | Material `7020776e` records about 13 hours, two cold starts, scoped journal review, and operator PASS; deployed source is `52f74f10`. | Status now records the 2026-08-30 PASS and package `26.04.r133.g52f74f10-1`. | Remaining future-tense burn-in text is historical procedure or a separately tracked Material acceptance outcome. |
| The native-sink plan header called Task 6 burn-in in progress. | The same Material ancestry proves the outcome completed; unchecked plan steps are not completion evidence. | Header now records completion and labels its unchecked Task 6 steps historical. | No current Prism status surface calls daily-driver burn-in incomplete. |
| The authoritative native parameter table omitted `glass.backdropBlur`. | Prism `d20111c` defines a default-false boolean, binds it reload-live, renders `backdrop-blur`, and tests exact native coverage; Material config and tests expose the same default and grammar. | Added the exact Prism-to-KDL mapping and default. | README and plugin note contain no conflicting parameter inventory; debug docs still preserve the exact-native-surface invariant. |
| The debug-backdrop spec called its dependency not burned in and its ordered handoff pending. | Material burn-in passed; Prism `cacf232` and dotfiles `9562732` are ancestors and the documented suites are green. | Status and ordered handoff now record the completed evidence. | The debug implementation plan's pending wording is an executed historical instruction, not current status. |

## Candidate outcomes

| Outcome | Evidence | Sources | Active state | Size | Proposed status | Blockers | Disposition | Task ID |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Expose Material backdrop blur through Prism | `d20111c` adds the definition, binding, renderer node, presentation, and exact-contract tests; Material implements the same default-false boolean interface. | `defs/glass.yaml`; `integrations/niri/**`; Material backdrop-blur design/config | Complete on `main` | — | — | — | `no task` | — |
| Native material ownership and daily-driver burn-in | Prism `5888970`, dotfiles `7b0efad`, and Material `7020776e` are ancestors; generated ownership, manual controls, two cold starts, journal review, and operator PASS are recorded. | Native-sink spec/plan; Material rollout design | Complete across owners | — | — | — | `no task` | — |
| Debug backdrop sink and ordered startup handoff | Prism through `cacf232` and dotfiles through `9562732` are ancestors; current tests cover the definition, convergence matrix, QML surface, and presentation. | Debug-backdrop spec/plan; `integrations/debug-backdrop/**`; tests | Complete across owners | — | — | — | `no task` | — |
| Historical v1 Task 20 and panel Task 6 manual demonstrations | The unchecked steps belong to superseded procedures; later recorded acceptance covers slider, restoration, preview, lifecycle, and failure recovery, and current tests cover the surviving behavior. | v1 and panel plans/specs | Superseded history | — | — | — | `no task` | — |
| Fix frost loss during interactive material-window drag | Material owns the renderer and preserved active investigation as `material-e88df7`; Prism already emits the accepted interface and does not block that work. | Material migration ledger and task store | Active in Material | — | — | — | `no Prism task`; no dependency | `material-e88df7` |
| Verify default-off backdrop blur on physical DRM | Material owns the physical acceptance outcome as `material-ce3315`; Prism's default-false emitted contract is already implemented and tested. | Material migration ledger and task store | Todo in Material | — | — | — | `no Prism task`; no dependency | `material-ce3315` |
| Material roughness and noise/saturation follow-ups | Material owns these as `material-c854bd` and `material-cad932`; neither requires unfinished Prism delivery. | Material migration ledger and task store | Todo/idea in Material | — | — | — | `no Prism task`; no dependency | `material-c854bd`, `material-cad932` |

No row is marked `create`: current code, tests, ancestry, and the integrated
Material store leave no evidence-backed unfinished Prism-owned outcome.

## Deferred foreign dependencies

None. Prism creates no task, and none of Material's four open outcomes is a
delivery blocker for completed Prism behavior. No dependency edge is deferred.

## Verification

| Command | Result | Commit containing the recorded result |
| --- | --- | --- |
| Baseline `npm ci && npm test` | PASS: 140 Node tests and the direct Lua plugin checks; zero failures. | Documentation commit (this commit) |
| Baseline `/usr/lib/qt6/bin/qmllint integrations/debug-backdrop/shell.qml` | Exit 0 with only the documented non-creatable `PanelWindow` warning. | Documentation commit (this commit) |
| Commit-ancestry checks for every status boundary named above | PASS; all named Prism, Material, niri-glass, and dotfiles commits are ancestors of their inspected heads. | Documentation commit (this commit) |
| NUL-safe exact document coverage comparison | PASS before task initialization: 13 actual paths equal 13 classified paths. | Documentation commit (this commit) |
