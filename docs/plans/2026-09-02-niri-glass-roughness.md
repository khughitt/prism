# Niri Glass Roughness Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore Prism's historical `glass.roughness` control and emit it to
the native niri material sink.

**Architecture:** Add one ordinary glass definition and reload-live binding,
then render its value beside the existing optics. Keep the native grammar,
definition tests, exact KDL tests, and current sink documentation in one
atomic commit.

**Tech Stack:** YAML, JavaScript ES modules, Node's built-in test runner.

**Spec:** `docs/superpowers/specs/2026-08-28-niri-native-material-sink-design.md`

## Global Constraints

- Key `glass.roughness`, range `0..1`, Prism default `0.08`, percent display.
- Emit native KDL `roughness`; no alias or compatibility layer.
- Liveness is `reload`.
- Correct the current native-sink design and task-migration claims in the same
  commit; preserve historical documents as historical.
- Conventional commit, named paths only, no AI attribution.

---

### Task 1: Restore and wire glass roughness

**Files:**

- Modify: `defs/glass.yaml`
- Modify: `integrations/niri/manifest.yaml`
- Modify: `integrations/niri/render.js`
- Modify: `test/glass-defs.test.js`
- Modify: `test/niri-render.test.js`
- Modify: `test/niri-apply.test.js`
- Modify: `docs/superpowers/specs/2026-08-28-niri-native-material-sink-design.md`
- Modify: `docs/plans/2026-08-31-prism-tasks-migration.md`

**Interfaces:**

- Produces: resolved parameter `glass.roughness: number` and generated KDL
  node `roughness <number>`.
- Consumes: native niri's bounded `roughness` glass node from
  `material-c854bd`.

- [ ] **Step 1: Make the definition and exact-KDL tests fail**

Add `glass.roughness` to `NATIVE`, remove it from `REMOVED`, add value `0.08`
to the niri renderer/apply fixtures, and require exact line `roughness 0.08`.

Run:

```bash
node --test test/glass-defs.test.js test/niri-render.test.js test/niri-apply.test.js
```

Expected: FAIL because the definition and renderer line do not exist.

- [ ] **Step 2: Add the public definition and sink binding**

Append beside the other optics in `defs/glass.yaml`:

```yaml
- key: glass.roughness
  type: float
  range: [0, 1]
  default: 0.08
  ui: {group: Glass Optics, control: slider, step: 0.01, label: Glass blur, order: 370, display: percent}
  description: Softness of detail refracted through the glass
```

Shift `backdropBlur` to order `380`, add the reload binding after
`glass.anisotropicBlur`, and emit:

```js
    `        roughness ${params['glass.roughness']}`,
```

between `anisotropic-blur` and `backdrop-blur`.

- [ ] **Step 3: Run the focused tests**

Run the Step 1 command. Expected: PASS.

- [ ] **Step 4: Correct current documentation and verify outward claims**

Add roughness to the authoritative native parameter table, remove it from the
retired list, explain the Prism `0.08` versus native `0` default, and replace
the migration claim that no Prism work is required with the landed task and
commit. Search with:

```bash
rg -n "roughness|unfinished Prism|unsupported|retired" README.md docs defs integrations test
```

Only current claims change; historical material-v1 statements remain.

- [ ] **Step 5: Run all repository checks and commit**

```bash
npm test
tasks check
git diff --check
git add defs/glass.yaml integrations/niri/manifest.yaml integrations/niri/render.js test/glass-defs.test.js test/niri-render.test.js test/niri-apply.test.js docs/superpowers/specs/2026-08-28-niri-native-material-sink-design.md docs/plans/2026-08-31-prism-tasks-migration.md tasks/prism-*.md
git commit -m "feat(niri): restore glass roughness"
```
