# Noctalia glass color implementation plan

> **For agentic workers:** use `superpowers:executing-plans` to implement this plan inline, one task at a time. Steps use checkboxes. Independent agents are unnecessary for this sequential rollout.

**Goal:** derive focused and unfocused glass tint from Noctalia in dark mode without disrupting niri applies during upgrade.

**Architecture:** extend the existing palette template, then derive tint in the niri sink without writing palette colors into the store. Two separate merges to main are required because the live launcher and template registration both read main. A successful host palette refresh gates the second merge.

**Tech stack:** existing Node ESM, `yaml`, Node test runner, Lua panel contracts, and Noctalia CLI; no new dependencies.

**Spec:** [Glass tint follows the Noctalia palette](../specs/2026-10-02-noctalia-glass-color-design.md).

## Global constraints

- Legibility acceptance is dark-mode only. Near-clear glass from a near-white light-mode surface is expected; test light-mode transport without promising light-mode legibility.
- `glass.tintSource`: `noctalia` or `manual`, default `noctalia`, neutral `manual`.
- `glass.tintAccentMix`: range 0–1, step 0.01, default 0.10, neutral 0; interpolate encoded sRGB bytes and round each channel.
- Distance defaults: focused 30 px, unfocused 35 px at the shipped 20 px depth. Both neutral distances stay 60 px; explicit stored values keep precedence.
- Both focus states share the derived color. Manual pickers stay visible and editable, displaying stored colors rather than the effective Noctalia tint.
- Tint bypass wins over either source and emits white. Glass off, or manual/bypassed tint with a familiar/manual ring, reads no palette.
- Noctalia tint always requires surface; primary is additionally required for a positive accent mix or a Noctalia ring. The ring alone retains its existing missing-file fallback.
- Preserve the palette path, `PRISM_NOCTALIA_COLORS`, sink lock, validation rollback and reload failure behavior. Do not modify core store/resolution code or retain an accent-reader compatibility wrapper.
- Shipped Aurora/Rainbow snapshots explicitly select manual tint and include both new keys. Do not rewrite existing user looks.
- **Merge 1:** template, template tests, README upgrade procedure and task/design records only. **Refresh:** verify primary and surface on every host being upgraded. **Merge 2:** sink, defaults, controls, fixtures, completed README and task/design records. A failed refresh blocks Merge 2.
- Predefined schemes have no direct refresh fallback here. If their refresh fails, keep Merge 2 blocked; an independently installed new sink recovers through manual tint. Never replace that scheme with wallpaper-generated colors.
- Reuse `.worktrees/noctalia-glass-color` on `feat/noctalia-glass-color`. File lists are relative to the main checkout; code snippets use imports relative to their source module. Shell blocks below run from the main checkout unless stated otherwise.
- Run tests only through `(cd .worktrees/noctalia-glass-color && just test-fast)`; this checkout has no `test-one`. Use `tasks` for every task-record mutation and require a clean `tasks check` before commits.

## Review focus

1. The old primary-only host palette must remain usable after Merge 1, and block only an independently enabled Noctalia tint before refresh. Tasks 1–3 verify this.
2. A disabled or bypassed consumer must not let an irrelevant broken palette prevent recovery. Task 3 tests the required-input table, including bypass with familiar/manual ring.
3. Zero accent mix must accept a surface-only palette; invalid unused fields must not fail a valid consumer. Task 3 tests field-specific validation and both mix endpoints.
4. Palette changes must update both materials without changing resolved params, runtime, saved looks or pending edits. Task 3 snapshots those files across two applies and reuses the existing sink-lock checks.
5. Complete starter profiles, neutral reset, explicit depth/distance values and the live panel must retain their intended behavior when the two parameters join the surface. Task 3 verifies these paths; Task 4 requires the owner's visual acceptance.

## File map and landing boundaries

| Landing | Files under `.worktrees/noctalia-glass-color/` | Responsibility |
| --- | --- | --- |
| Merge 1 | `integrations/niri/noctalia-palette.template`, `test/noctalia-palette-template.test.js`, `README.md` | Supply surface while the old sink remains installed; document upgrade order and actual refresh commands. |
| Merge 2 | `integrations/niri/palette.js`, `integrations/niri/apply`, `integrations/niri/render.js`, `integrations/niri/probe-material` | Read required external colors once, derive tint, preserve bypass and niri failure semantics. |
| Merge 2 | `defs/glass.yaml`, `defs/rack/devices.yaml`, `integrations/niri/manifest.yaml` | Publish the two controls, source defaults, distances and descriptions. |
| Merge 2 | `resources/profiles/Aurora.yaml`, `resources/profiles/Rainbow.yaml` | Keep complete starter snapshots and their curated manual colors. |
| Merge 2 | `test/niri-render.test.js`, `test/niri-apply.test.js`, `test/glass-defs.test.js`, `test/plugin-presentation.test.js`, `test/rack.test.js`, `test/starter-profiles.test.js`, `test/noctalia-palette-template.test.js`, `test/cli.test.js`, `integrations/noctalia-plugin/contract.test.mjs` | Cover the new flow using existing fixtures and panel harnesses. |
| Both | `README.md`, `docs/specs/`, `docs/plans/`, `tasks/` | Describe the actual landed phase and preserve review/rollout evidence. |

## Task records

| Step | Record | Dependency |
| --- | --- | --- |
| Task 1 | `prism-47da20` | Parent's plan approval. |
| Task 2 | `prism-0bb71e` | `prism-47da20`. |
| Task 3 | `prism-67247f` | `prism-0bb71e`. |
| Task 4 | `prism-ad333a` | `prism-67247f` and `prism-0bb71e`. |

Start each record in the existing worktree before its implementation; close it
in its deliverable commit. Keep Task 1 parked for this plan review until the
parent's approval is recorded. The remaining records stay blocked by the chain.

### Task 1: Prepare the expanded template and upgrade instructions

**Files:**

- Modify `.worktrees/noctalia-glass-color/integrations/niri/noctalia-palette.template`.
- Modify `.worktrees/noctalia-glass-color/test/noctalia-palette-template.test.js`.
- Modify `.worktrees/noctalia-glass-color/README.md`, Noctalia palette section.

**Interfaces:**

- Consumes: the current `readNoctaliaAccent(file)` and existing template registration.
- Produces: a two-field palette `{ primary: '#rrggbb', surface: '#rrggbb' }`; the current sink still reads only primary. No defs or sink implementation changes are allowed in this task.

- [x] **Step 1: Expand the existing template regression to cover both modes.** Keep its existing temp-directory cleanup, installed-CLI skip rule, and `readNoctaliaAccent` import. Replace its single token-map/render assertion with:

  ```js
  const tokens = {
    dark: { primary: '#a1b2c3', surface: '#111317' },
    light: { primary: '#445566', surface: '#fafafa' },
  };
  fs.writeFileSync(theme, JSON.stringify(tokens));
  for (const mode of ['dark', 'light']) {
    execFileSync('noctalia', ['theme', '--theme-json', theme,
      '--default-mode', mode, '-r', `${template}:${out}`], { stdio: 'pipe' });
    assert.deepEqual(JSON.parse(fs.readFileSync(out, 'utf8')), tokens[mode]);
    assert.equal(readNoctaliaAccent(out), tokens[mode].primary,
      'the existing ring reader accepts the expanded output');
  }
  ```

- [x] **Step 2: Run `just test-fast` in the worktree.** On a host with Noctalia installed, the new assertion fails because surface is absent. A skipped CLI test is insufficient evidence for the host rollout.
- [x] **Step 3: Expand only the template.** Its entire contents become:

  ```text
  {"primary": "{{ colors.primary.default.hex }}", "surface": "{{ colors.surface.default.hex }}"}
  ```

- [x] **Step 4: Document the two-merge upgrade in the README.** Copy the accepted spec's commands and ordering: first merge template/tests/README; reapply templates; verify both fields; only then merge the sink/defaults/controls. State that new controls are upcoming until Merge 2, so an operator does not try an unknown `glass.tintSource` key during Merge 1. Include dark-mode scope, expected light-mode appearance, the checked direct wallpaper command, and the predefined-scheme/manual recovery limitation. Keep the existing template registration and `colors_changed` hook instructions.
- [x] **Step 5: Run `just test-fast` and `tasks check` in the worktree.** Confirm the template test actually ran on the rollout host. Inspect the diff: there must be no changes to defs, source modules, apply, profiles or panel code. Mark this child done with the result before committing its code and task record. Use conventional commit `feat(palette): include surface and document staged tint upgrade`.

### Task 2: Merge the template and verify the host palette

**Files:**

- No new product files. Record the main revision, host, palette path, validation result and the first merge in the task notes through `tasks`.

**Interfaces:**

- Consumes: Task 1's committed template/tests/README while main still contains the original sink.
- Produces: **Merge 1 completed**, and valid primary/surface output on each host being upgraded. Task 3 depends on this verification; Task 4 must recheck it before Merge 2.

- [x] **Step 1: Identify the live paths before landing.** Inspect `command -v prism`, its resolved wrapper, and the Noctalia `[theme.templates.user.prism]` entry. Confirm they still resolve to main. Inspect the main checkout's status and preserve unrelated task files. Rebase the feature branch onto main if a clean fast-forward is unavailable; resolve and reverify in the worktree, rather than overwriting either checkout.

  ```sh
  command -v prism
  readlink -f "$(command -v prism)"
  git status --short
  git diff --name-only main...feat/noctalia-glass-color
  ```

- [x] **Step 2: Perform Merge 1 only after the boundary check passes.** The difference may contain template/tests/README and this feature's design/task records, but must contain no new tint source, sink implementation, controls or distance defaults. Run the required gate through the worktree recipes, then land this first phase:

  ```sh
  (cd .worktrees/noctalia-glass-color && just gate)
  git merge --ff-only feat/noctalia-glass-color
  git rev-parse HEAD
  ```

  Record that main revision as Merge 1. After it, verify main's apply still imports `readNoctaliaAccent` and main's defs do not define `glass.tintSource`. Do not merge any later feature commits until the next step succeeds.

- [x] **Step 3: Refresh the current palette.** Run `noctalia msg templates-apply`. Its acknowledgment is not proof of completion. From main, verify the output without accepting stale primary-only data:

  ```sh
  node --input-type=module <<'JS'
  import fs from 'node:fs';
  import assert from 'node:assert/strict';
  import { noctaliaColorsPath } from './integrations/niri/palette.js';
  const file = noctaliaColorsPath();
  const colors = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const field of ['primary', 'surface']) {
    assert.equal(typeof colors?.[field], 'string', `${file}: ${field} missing`);
    assert.match(colors[field], /^#[0-9a-fA-F]{6}$/, `${file}: invalid ${field}`);
  }
  console.log('palette ready:', file, colors);
  JS
  ```

  If validation fails for a wallpaper-generated scheme, run the direct synchronous command in the README **from main**, then rerun validation. For a predefined scheme, stop here and leave main on Merge 1 until its template transport is repaired. Never use the wallpaper command for that scheme. A missing/running-unavailable Noctalia instance is an environment blocker, not permission to bypass validation.

- [x] **Step 4: Confirm the old apply still works and record evidence.** Run main's `bin/prism apply niri` after the successful refresh; it still implements the old glass behavior. Record the command's actual exit, host from `uname -n`, main revision and validated field values. Repeat this check on any other host being upgraded before considering the gate satisfied; do not infer host-local state from the synced checkout. Keep the shared launcher and template registration on main. Mark this child done and commit its task evidence with `chore(tasks): verify palette refresh after first landing`.

### Task 3: Implement palette-driven tint, controls and regression checks

**Files:**

- Modify `.worktrees/noctalia-glass-color/integrations/niri/palette.js`, `integrations/niri/apply`, `integrations/niri/render.js`, `integrations/niri/probe-material`, and `integrations/niri/manifest.yaml`.
- Modify `.worktrees/noctalia-glass-color/defs/glass.yaml` and `defs/rack/devices.yaml`.
- Modify `.worktrees/noctalia-glass-color/resources/profiles/Aurora.yaml` and `resources/profiles/Rainbow.yaml`.
- Modify `.worktrees/noctalia-glass-color/test/niri-render.test.js`, `test/niri-apply.test.js`, `test/glass-defs.test.js`, `test/plugin-presentation.test.js`, `test/rack.test.js`, `test/starter-profiles.test.js`, `test/noctalia-palette-template.test.js`, `test/cli.test.js`, and `integrations/noctalia-plugin/contract.test.mjs`.
- Complete `.worktrees/noctalia-glass-color/README.md`, including descriptions and recovery commands for the now-implemented source.

**Interfaces:**

- Consumes: the refreshed two-field palette, resolved params, and existing DRY/`glassFor` optics pipeline.
- Produces: `readNoctaliaPalette(file, requiredFields, consumer = 'ring') -> null | { primary?: string, surface?: string }`. `requiredFields` is the caller-selected array of `primary` and/or `surface`; return only those validated fields. Null means ENOENT; every other filesystem error propagates.
- Extends the existing renderer sources with `noctaliaSurface?: string`, preserving `noctaliaAccent?: string | null` for ring rendering. `renderNiriFragment(resolved, sources = {})` stays pure; its Noctalia tint callers supply the validated required colors. Manual/bypassed rendering needs no surface.
- Publishes the two tint parameters through defs/rack/manifest. No new panel implementation or core resolver code is needed.

- [x] **Step 1: Add failing reader/render checks in the existing render test file.** Add explicit `glass.tintSource: 'manual'` and `glass.tintAccentMix: 0.1` to its hand-authored resolved fixture to retain that fixture's intended manual appearance. The following rendering check pins the actual output, not a private helper:

  ```js
  test('palette tint reaches both materials and bypass remains white', () => {
    const input = with_({ 'glass.tintSource': 'noctalia', 'glass.tintAccentMix': 0.1 });
    const before = structuredClone(input);
    const sources = { noctaliaSurface: '#101010', noctaliaAccent: '#202020' };
    const kdl = renderNiriFragment(input, sources);
    assert.equal(count(kdl, 'attenuation-color "#121212"'), 2);
    assert.deepEqual(input, before);
    assert.equal(count(renderNiriFragment(with_({ ...input.params,
      'glass.bypass.tint': true }), {}), 'attenuation-color "#ffffff"'), 2);
    assert.equal(count(renderNiriFragment(with_({ ...input.params,
      'glass.focusSplit': false }), sources), 'attenuation-color "#121212"'), 1);
    for (const [mix, expected] of [[0, '#101010'], [1, '#202020']]) {
      const output = renderNiriFragment(with_({ ...input.params,
        'glass.tintAccentMix': mix }), sources);
      assert.equal(count(output, `attenuation-color "${expected}"`), 2);
    }
    const surfaceOnly = renderNiriFragment(with_({ ...input.params,
      'glass.tintAccentMix': 0 }), { noctaliaSurface: '#ABCDEF' });
    assert.equal(count(surfaceOnly, 'attenuation-color "#abcdef"'), 2);
  });
  ```

  Change the reader-test import to `readNoctaliaPalette`; use the existing temporary directory and file cleanup. Add this field-specific check alongside the existing malformed-file checks:

  ```js
  fs.writeFileSync(file, JSON.stringify({ surface: '#ABCDEF', primary: 'unused' }));
  assert.deepEqual(readNoctaliaPalette(file, ['surface']), { surface: '#ABCDEF' });
  assert.throws(() => readNoctaliaPalette(file, ['surface', 'primary']), /primary missing/);
  fs.writeFileSync(file, JSON.stringify({ primary: '#A1B2C3' }));
  assert.deepEqual(readNoctaliaPalette(file, ['primary']), { primary: '#A1B2C3' });
  assert.throws(() => readNoctaliaPalette(file, ['surface']), /surface missing/);
  assert.throws(() => readNoctaliaPalette(path.dirname(file), ['surface']));
  ```

  Keep the existing missing-file/null, invalid JSON, invalid primary, retired `mPrimary` shape and path-override assertions, updating calls and object expectations. Missing, null, numeric, array, short and non-hex required color values must fail. Run `just test-fast`: the new reader import or tint assertions must fail before implementation.

- [x] **Step 2: Replace the accent-only reader.** Preserve `noctaliaColorsPath()` unchanged. Use this implementation in place of `readNoctaliaAccent`:

  ```js
  export function readNoctaliaPalette(file, requiredFields, consumer = 'ring') {
    const remedy = consumer === 'tint'
      ? "run 'noctalia msg templates-apply', verify primary and surface, then rerun 'prism apply niri'; see the README for direct wallpaper refresh or select manual tint"
      : "run 'noctalia msg templates-apply', verify primary, then rerun 'prism apply niri' or select the ring's manual Color source";
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
    let colors;
    try {
      colors = JSON.parse(text);
    } catch {
      throw new Error(`${file}: not valid JSON — ${remedy}`);
    }
    return Object.fromEntries(requiredFields.map((field) => {
      const value = colors?.[field];
      if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) {
        throw new Error(`${file}: ${field} missing or not a #rrggbb color — ${remedy}`);
      }
      return [field, value];
    }));
  }
  ```

  Update the template-test import/call to this reader with `['primary', 'surface']`, comparing its returned object with that mode's tokens. Remove the old export and update every production/test caller, rather than adding an alias.

- [x] **Step 3: Derive tint before DRY overrides.** Add this internal helper in the renderer:

  ```js
  const paletteTint = (surface, accent, mix) => mix === 0
    ? surface.toLowerCase()
    : '#' + [1, 3, 5].map((offset) => Math.round(
      parseInt(surface.slice(offset, offset + 2), 16) * (1 - mix)
      + parseInt(accent.slice(offset, offset + 2), 16) * mix,
    ).toString(16).padStart(2, '0')).join('');
  ```

  Change `glassFor(params, prefix)` to `glassFor(params, prefix, sources)` and insert the following after collecting OPTICS but before the existing DRY loop:

  ```js
  if (params['glass.tintSource'] === 'noctalia' && params['glass.bypass.tint'] !== true) {
    if (!sources.noctaliaSurface) throw new Error('noctalia tint rendered without a validated surface');
    glass.attenuationColor = paletteTint(sources.noctaliaSurface,
      sources.noctaliaAccent, params['glass.tintAccentMix']);
  }
  ```

  Pass sources through `activeGlass(params, sources)`, `inactiveGlass(params, sources)` and their two `definition` call sites. Set `glass.tintSource: 'manual'` in `probe-material`'s synthetic params: capability probing must not require external palette inputs. Its existing outdated-property checks must still run. Do not change `responseBlock`, OPTICS membership, DRY, assignment rules or focus-ring handling. The renderer trusts the sink's validated inputs; do not silently substitute stored tint when a required palette field is absent.

- [x] **Step 4: Add the apply regression for palette refresh and recovery.** Add manual source/mix to its existing `PARAMS` fixture. Import `loadDefs`, `defsDir`, and `resolveParams` for complete default-derived new test params. In the existing fixture, expose `runCli(extra)`: invoke `bin/prism apply niri` with the same stub-niri environment, isolated `PRISM_CONFIG_DIR: path.join(dir, 'config')`, and `PRISM_INTEGRATIONS_DIR` set to the real integrations directory. Keep `run(extra)` for sink-only failure tests. The store-preservation test must use `runCli`, so it exercises store resolution, fan-out and the existing sink lock rather than a fixed resolved input.

  ```js
  test('palette changes reach both materials without changing the store', (t) => {
    const { dir, state, target, runCli, calls } = fixture(t);
    const palette = path.join(dir, 'palette.json');
    const config = path.join(dir, 'config');
    fs.mkdirSync(path.join(config, 'contexts', 'profile'), { recursive: true });
    const base = path.join(config, 'values.yaml');
    const saved = path.join(config, 'contexts', 'profile', 'Saved.yaml');
    const runtime = path.join(state, 'active.json');
    fs.writeFileSync(base, 'glass.ring.colorSource: familiar\n');
    fs.writeFileSync(saved, 'glass.roughness: 0.2\n');
    fs.writeFileSync(runtime, JSON.stringify({ profile: 'Saved',
      _scratch: { 'glass.roughness': 0.3 } }));
    const before = new Map([base, saved, runtime]
      .map((file) => [file, fs.readFileSync(file, 'utf8')]));
    for (const [surface, primary, expected] of [
      ['#101010', '#202020', '#121212'],
      ['#202020', '#303030', '#222222'],
    ]) {
      fs.writeFileSync(palette, JSON.stringify({ surface, primary }));
      const result = runCli({ PRISM_NOCTALIA_COLORS: palette });
      assert.equal(result.status, 0, result.stderr);
      const resolved = JSON.parse(fs.readFileSync(path.join(state, 'resolved.json'), 'utf8'));
      assert.equal(resolved.params['glass.roughness'], 0.3);
      assert.equal(resolved.params['glass.tintSource'], 'noctalia');
      const kdl = fs.readFileSync(target, 'utf8');
      assert.equal((kdl.match(new RegExp(`attenuation-color "${expected}"`, 'g')) ?? []).length, 2);
      assert.match(kdl, /attenuation-distance 30\n/);
      assert.match(kdl, /attenuation-distance 35\n/);
      for (const [file, contents] of before) assert.equal(fs.readFileSync(file, 'utf8'), contents);
    }
    assert.deepEqual(calls(), ['validate', 'validate', 'msg action load-config-file',
      'validate', 'validate', 'msg action load-config-file']);
  });
  ```

  Use the same fixture to seed a previous target, enable Noctalia tint, and supply an absent, primary-only, malformed, or invalid-required-field palette. Each fails with the file/field and `templates-apply` remedy, preserves the previous target byte-for-byte, and makes no niri call. Then set manual tint with familiar ring and rerun against the same unusable palette: apply succeeds. This is the predefined-scheme/no-refresh recovery path too; recovery must not alter palette selection or contents.

  Cover the complete required-input table with table-driven cases in this file. Successful surface-only mix-zero and bypass/familiar cases must not require primary; ring-only Noctalia cases still require primary but ignore invalid surface. With glass off, even invalid JSON is unread. With Noctalia tint and familiar ring, surface is still required. At mix one, missing surface still fails the selected-source contract. Use `writeParams()` and the existing `run()`/`calls()` assertions rather than adding another harness. Run `just test-fast` and observe these new apply failures before changing apply.

  ```js
  test('apply reads only the palette fields its enabled consumers need', (t) => {
    const primaryOnly = JSON.stringify({ primary: '#202020', surface: 'unused' });
    const surfaceOnly = JSON.stringify({ surface: '#101010', primary: 'unused' });
    const cases = [
      ['off', { 'glass.enabled': false, 'glass.ring.colorSource': 'noctalia' }, '{ broken', null],
      ['manual/familiar', { 'glass.tintSource': 'manual' }, '{ broken', null],
      ['manual/manual', { 'glass.tintSource': 'manual', 'glass.ring.colorSource': 'manual' }, '{ broken', null],
      ['bypass/familiar', { 'glass.bypass.tint': true }, '{ broken', null],
      ['bypass/manual', { 'glass.bypass.tint': true, 'glass.ring.colorSource': 'manual' }, '{ broken', null],
      ['bypass/noctalia', { 'glass.bypass.tint': true, 'glass.ring.colorSource': 'noctalia' }, primaryOnly, null],
      ['manual/noctalia', { 'glass.tintSource': 'manual', 'glass.ring.colorSource': 'noctalia' }, primaryOnly, null],
      ['surface only', { 'glass.tintAccentMix': 0 }, surfaceOnly, null],
      ['ring still needs primary', { 'glass.tintAccentMix': 0, 'glass.ring.colorSource': 'noctalia' }, surfaceOnly, /primary missing/],
      ['missing surface', {}, primaryOnly, /surface missing/],
      ['missing primary', {}, surfaceOnly, /primary missing/],
      ['mix one still needs surface', { 'glass.tintAccentMix': 1 }, primaryOnly, /surface missing/],
      ['absent tint palette', {}, null, /palette missing/],
      ['malformed tint palette', {}, '{ broken', /not valid JSON/],
      ['invalid surface type', {}, '{"surface":[],"primary":"#202020"}', /surface missing/],
    ];
    for (const [label, overrides, contents, failure] of cases) {
      const { dir, target, run, calls, writeParams } = fixture(t);
      writeParams({ 'glass.tintSource': 'noctalia', 'glass.tintAccentMix': 0.1,
        'glass.ring.colorSource': 'familiar', ...overrides });
      const palette = path.join(dir, 'palette.json');
      if (contents !== null) fs.writeFileSync(palette, contents);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, '// previous accepted generation\n');
      const result = run({ PRISM_NOCTALIA_COLORS: palette });
      if (failure) {
        assert.notEqual(result.status, 0, label);
        assert.match(result.stderr, failure, label);
        assert.match(result.stderr, /noctalia msg templates-apply/, label);
        assert.equal(fs.readFileSync(target, 'utf8'), '// previous accepted generation\n', label);
        assert.deepEqual(calls(), [], label);
      } else {
        assert.equal(result.status, 0, `${label}: ${result.stderr}`);
        assert.deepEqual(calls(), ['validate', 'msg action load-config-file'], label);
      }
    }
  });
  ```

- [x] **Step 5: Read only what apply's enabled consumers need.** Replace its import with `readNoctaliaPalette`. Replace the ring-only source-loading block with:

  ```js
  const params = resolved.params;
  const enabled = params['glass.enabled'] === true;
  const tint = enabled && params['glass.tintSource'] === 'noctalia'
    && params['glass.bypass.tint'] !== true;
  const ring = enabled && params['glass.ring.colorSource'] === 'noctalia';
  const fields = [
    ...(tint ? ['surface'] : []),
    ...(ring || (tint && params['glass.tintAccentMix'] > 0) ? ['primary'] : []),
  ];
  const sources = {};
  if (fields.length) {
    const file = noctaliaColorsPath();
    const palette = readNoctaliaPalette(file, fields, tint ? 'tint' : 'ring');
    if (tint && palette === null) {
      throw new Error(`${file}: palette missing — run 'noctalia msg templates-apply', verify primary and surface, then rerun 'prism apply niri'; see the README for direct wallpaper refresh or select manual tint`);
    }
    sources.noctaliaAccent = palette?.primary ?? null;
    sources.noctaliaSurface = palette?.surface;
  }
  ```

  Keep this before generating/writing the target, and preserve the existing niri validation/reload code. Preserve the fan-out locking code unchanged. The existing `an apply waits for the sink lock another apply of that sink holds` and throwing-apply lock-release tests remain part of `just test-fast`.

- [x] **Step 6: Publish definitions and wire the existing rack/manifest.** Add the following after the two Tint pickers:

  ```yaml
  - key: glass.tintSource
    type: enum
    values: [noctalia, manual]
    default: noctalia
    neutral: manual
    ui: {group: Focus, control: select, label: Tint source, order: 242}
    description: Select the Noctalia surface and palette-accent mix or the stored focused and unfocused manual tints
  - key: glass.tintAccentMix
    type: float
    range: [0, 1]
    default: 0.1
    neutral: 0
    ui: {group: Focus, control: slider, step: 0.01, label: Palette accent mix, order: 244, display: percent}
    description: Share of the palette primary mixed into its surface color under Noctalia tint; 0 uses only the surface and 1 only the primary
  ```

  Set focused/unfocused distance defaults to 30/35, leaving their neutral values/ranges alone. Change the Tint descriptions to say their pickers show stored manual colors under both sources and affect rendering only under manual. Note the depth/distance relationship in both distance descriptions. Assign the two new keys to the Tint device's `shared` list, and add two manifest bindings with `liveness: reload`. In each starter profile add `glass.tintSource: manual` and `glass.tintAccentMix: 0.1`, preserving its existing colors and distances.

  ```yaml
  # Tint device shared list
  shared: [glass.tintSource, glass.tintAccentMix]
  # New niri manifest bindings
  - {param: glass.tintSource, liveness: reload}
  - {param: glass.tintAccentMix, liveness: reload}
  # Add to both starter-profile snapshots
  glass.tintSource: manual
  glass.tintAccentMix: 0.1
  ```

- [x] **Step 7: Update meaningful definition/panel/profile checks.** In the glass-defs surface whitelist include both Prism-only tint keys. Preserve NATIVE's actual 60/70 defaults; compare the two curated Prism distance defaults against a separate expected override map, keeping all native range assertions. Add neutral expectations `glass.tintSource: manual` and `glass.tintAccentMix: 0`. Assert defaults/ranges/UI of both new keys, native manifest coverage, and exact Tint rack ownership. Existing source-default render calls must supply `{ noctaliaSurface: '#101010', noctaliaAccent: '#202020' }`; hand-authored manual fixtures need no palette. The starter-profile test must still prove complete snapshots and their stored colors reaching both rendered materials.

  In the existing native-default test, keep the range checks and replace only
  its default assertion with this explicit Prism override:

  ```js
  const defaults = { 'glass.attenuationDistance': 30,
    'glass.inactive.attenuationDistance': 35 };
  assert.deepEqual(def.default, defaults[key] ?? native.default, `${key} default`);
  ```

  Add this assertion to the existing panel contract harness:

  ```js
  test('tint source and mix draw while both manual pickers stay visible', () => {
    for (const source of ['noctalia', 'manual']) {
      const model = describeStore({ base: { 'glass.tintSource': source } });
      const [report] = inspectModels([model]);
      assert.equal(report.error, undefined);
      assert.equal(report.cells['glass.tintSource'].kind, 'select');
      assert.equal(report.cells['glass.tintAccentMix'].kind, 'slider');
      for (const key of ['glass.attenuationColor', 'glass.inactive.attenuationColor']) {
        assert.equal(report.cells[key].glyph, 'palette');
        assert.equal(model.params.find((param) => param.key === key).value, '#dfe8ff');
      }
    }
  });
  ```

  Assert an explicit stored depth/distance is unchanged by source selection and both source/mix overrides resolve normally through base/profile/scratch. Neutral must resolve to manual white tint in both states without a palette. Use the existing CLI reset and renderer fixtures; do not create a second resolver or visibility mechanism.

  ```js
  test('palette tint preserves explicit depths and distances and neutral needs no surface', () => {
    const input = with_({ 'glass.tintSource': 'noctalia', 'glass.tintAccentMix': 0.1,
      'glass.thickness': 80, 'glass.inactive.thickness': 40,
      'glass.attenuationDistance': 16, 'glass.inactive.attenuationDistance': 90 });
    const before = structuredClone(input);
    const kdl = renderNiriFragment(input,
      { noctaliaSurface: '#101010', noctaliaAccent: '#202020' });
    for (const value of ['thickness 80', 'thickness 40',
      'attenuation-distance 16', 'attenuation-distance 90']) assert.ok(kdl.includes(value));
    assert.deepEqual(input, before);
    const params = Object.fromEntries([...loadDefs(defsDir())].map(([key, def]) =>
      [key, Object.hasOwn(def, 'neutral') ? def.neutral : def.default]));
    assert.equal(params['glass.tintSource'], 'manual');
    assert.equal(params['glass.tintAccentMix'], 0);
    assert.equal(count(renderNiriFragment({ params }), 'attenuation-color "#ffffff"'), 2);
  });
  ```

  Add this regression to the existing CLI test file, using its isolated store,
  `writeContext`, `writeActive`, `runCaptured`, `readScratch` and path helpers:

  ```js
  test('Focus neutral overrides profile tint through scratch without rewriting saved tuning', async () => {
    fs.writeFileSync(valuesPath(), 'glass.tintSource: manual\nglass.tintAccentMix: 0.2\n');
    writeContext('profile', 'Dusk', { source: null, values: {
    'glass.tintSource': 'noctalia', 'glass.tintAccentMix': 0.4 } });
    writeActive({ profile: 'Dusk' });
    const saved = contextPath('profile', 'Dusk');
    const beforeBase = fs.readFileSync(valuesPath(), 'utf8');
    const beforeProfile = fs.readFileSync(saved, 'utf8');
    let described = '';
    assert.equal(await cli.run(['describe', '--json'],
      { print: (text) => { described += text; } }), 0);
    const byKey = Object.fromEntries(JSON.parse(described).params.map((p) => [p.key, p]));
    assert.equal(byKey['glass.tintSource'].value, 'noctalia');
    assert.equal(byKey['glass.tintAccentMix'].value, 0.4);
    const out = await runCaptured(['reset', 'neutral', '--group', 'Focus'], { runner: () => {} });
    assert.equal(out.code, 0, out.stderr);
    assert.equal(readScratch()['glass.tintSource'], 'manual');
    assert.equal(readScratch()['glass.tintAccentMix'], 0);
    assert.equal(fs.readFileSync(valuesPath(), 'utf8'), beforeBase);
    assert.equal(fs.readFileSync(saved, 'utf8'), beforeProfile);
  });
  ```

- [x] **Step 8: Verify and commit the completed second-phase implementation.** Run `just test-fast` in the worktree. Check reader/render/apply failures were observed before their implementations and final output is green, including template CLI and Lua checks. Run `tasks check`; inspect every affected caller with `rg` and confirm the old export has no production/test caller left. Finish README text for the implemented controls, manual-source recovery, preset behavior and dark-mode acceptance. Mark this child done in the implementation commit, `feat(tint): derive glass color from Noctalia palette`. Do not merge this commit yet.

### Task 4: Merge the tint implementation and accept the desktop result

**Files:**

- Update `.worktrees/noctalia-glass-color/docs/specs/2026-10-02-noctalia-glass-color-design.md` and this plan's status/checklists from observed results.
- Record second-merge and desktop results on the child and parent tasks through `tasks`.

**Interfaces:**

- Consumes: Task 2's recorded Merge 1/host refresh and Task 3's verified implementation.
- Produces: **Merge 2 completed**, successful niri apply, and the owner's dark-mode visual acceptance. The parent stays open until that acceptance arrives.

- [ ] **Step 1: Review the complete implementation before Merge 2.** Use `superpowers:requesting-code-review`, record any received review with the required `review: impl round ...` shape before acting, fix findings in the worktree, and rerun the relevant front-door checks. If an independent reviewer is required by that skill, dispatch only for that review and wait for its completed result. Confirm all accepted spec requirements have an implementation/check and no product code slipped into Merge 1.
- [ ] **Step 2: Revalidate every rollout host's palette immediately before landing.** Use Task 2's exact validator, check the live launcher/template still resolve to main, and confirm Task 2 has closed with host-specific evidence. A missing/invalid palette, unsupported predefined refresh, or unresolved host blocks this step. Do not replace the agreed Noctalia default with manual merely to bypass the gate.
- [ ] **Step 3: Run the integration gate and perform the second merge.** Preserve unrelated main-checkout edits. Resolve any main/branch divergence in the task worktree, reverify, then:

  ```sh
  (cd .worktrees/noctalia-glass-color && just gate)
  git merge --ff-only feat/noctalia-glass-color
  bin/prism apply niri
  git rev-parse HEAD
  ```

  Record Merge 2's actual main revision and apply result. Confirm primary/surface remain valid and generated focused/unfocused colors match the selected mix. Saved explicit distance/depth values continue to win; report those values instead of claiming the default distances are live when they are overridden.
- [ ] **Step 4: Prepare the visual check and stop at the owner's judgment.** In dark mode, inspect the default 20 px depth/30–35 px distances and the owner's existing saved tuning, across bright and dark wallpapers with different palettes. Confirm generated tint follows each palette and neither rotation changes the saved look/pending edits. Arrange the comparison through explicit worktree paths or main's now-landed code; do not repoint host launchers/config includes. Preserve the owner's prior tuning and wallpaper selection after temporary checks, and record any live-state changes and restoration at the time. Present the visible result to the owner, who decides legibility. If awaiting that judgment, park this child and the parent with `--waiting-on user --reason review`, naming the exact visual artifact/check and next action; do not close the feature early.
- [ ] **Step 5: Close only after the owner accepts.** Update spec/plan status to implemented with actual automated and desktop evidence. Mark this child done, then mark `prism-b5cb1e` done with a one-line result, include both records in the closing commit, and run `tasks check`. If the worktree is removed, first harvest `tt-report`, verify no host pointer resolves into it, unlock it, then remove it. Otherwise leave the worktree documented; do not remove an active or unaccepted workspace.

## Execution and review status

Plan round 1 accepted subject to the CLI store-preservation correction, now incorporated. Ring-only errors name the ring control, and the renderer names a missing validated surface explicitly. The serial order is retained for the quick local refresh. Spec round 2's conditional acceptance is fulfilled: the design now requires two separate merges, with an explicit host refresh gate between them. This plan is approved for inline execution; Merge 1 is landed at 6029ec5 and the rollout-host palette refresh is verified; Task 3 is implemented and verified; independent review precedes Merge 2. Native inline execution is recommended because the tasks are sequential and share the same color flow. After plan acceptance, start Task 1 in the existing worktree and proceed through the dependencies; do not combine the two landings.
