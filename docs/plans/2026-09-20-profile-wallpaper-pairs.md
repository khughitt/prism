# Profile–Wallpaper Pairs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The user already chose this execution method and reviewed this plan; incorporate the requested amendments and have the controller verify them before implementation.

**Goal:** Selecting a look saves outgoing wallpaper edits and loads the selected look’s own wallpaper adjustments with zero pending edits.

**Architecture:** Put each look’s `_wallpapers` map in its existing settings file, so one atomic replacement updates settings and pairs together and profile rename/delete carries both. Put pending scratch in `active.json` alongside the selected slots, so selection and clearing scratch are one atomic write. Keep the existing lock, resolver, atomic writers, and hook; explicitly migrate old global wallpaper files and `scratch.yaml`, with no runtime fallback or transaction engine.

**Tech Stack:** Node.js >=20, existing `yaml` dependency, `node:test`, existing Lua/Noctalia plugin harness, `just` and `tasks`.

**Spec:** [Approved amendment](../specs/2026-09-20-profile-wallpaper-pairs-design.md); inherited requirements in [compositional profiles](../specs/2026-09-19-compositional-profiles-design.md), except its superseded global-wallpaper and scratch-survival rules.

**Task:** `prism-a3484e`, under `prism-aec90f`.

**Status:** reviewed 2026-09-20; the user’s recovery, migration, and task-split changes are incorporated below. Controller verification precedes execution; no repeat approval is requested.

## Global Constraints

- “The fold remains defaults, base, loaded profile, wallpaper adjustment, reserved state, scratch.”
- “There is no fallback to another look’s pair, no new layer rank, and no relative-value arithmetic.”
- “The panel never writes wallpaper observations into the store.”
- “Ordinary display reads remain read-only.”
- “No shared-delta compatibility layer remains.”
- No new dependency, generic transaction engine, identity registry, legacy layer, or reserved-state implementation.
- Preserve commit screen invariance, locked reads/writes, validation before mutation, and recoverable write prefixes. Filesystem atomicity has the existing process-interruption scope; do not claim power-loss durability.
- Preserve `fde3bc8` (`fix(panel): ignore slider model echoes after profile selection`) and its immediate/deferred callback regressions.
- Retain the original visible-control scope of panel counts and resets. CLI-only scratch keys remain outside panel counts; transitions and commits save **all** scratch keys. No hidden-key reset redesign.
- Reuse `.worktrees/prism-aec90f`. Paths below are relative to that worktree; paths shown to the user must start `.worktrees/prism-aec90f/`.
- Full `just test` must pass before **each** implementation commit; also run `just check` and `tasks check`, reporting all warnings. Do not commit knowingly failing intermediate consumer changes.
- Do not migrate the live store or reload the live plugin as part of these coding tasks. Prepare and test migration in temporary stores; desktop migration/reload belongs to the existing acceptance handoff `prism-439774`.

## Review Focus

1. No-wallpaper selection with scratch must publish only the before or after appearance; missing/broken outgoing-profile recovery must instead preserve scratch and fan out every bound key (Tasks 2 and 4).
2. Save As replacing a profile with an existing current-wallpaper pair must preserve the exact screen, other destination pairs, and source pairs, including after interruption (Tasks 2 and 4).
3. A queued Keep/Clear captured under Aurora/W must fail without writes after either slot changes, including Default versus a profile named `Default` (Tasks 3 and 5).
4. Every interrupted migration prefix must converge by rereading the current store. The first complete backup retains pre-first-attempt originals; subsequent modifying attempts use fresh backups, and hand-edited conflicts are preserved and refused rather than overwritten (Tasks 2 and 4).
5. Equal values, hidden CLI keys, malformed inactive pairs, and immediate/deferred slider callbacks must not inflate counts, hide corruption, or create synthetic edits; real slider input during selection remains queued for the incoming scratch (Tasks 2 and 5).

## Storage and interface decisions

### Look documents

Keep flat parameter keys and add exactly one reserved metadata key. For a named look, the file remains `contexts/profile/<name>.yaml`; Default uses `values.yaml`:

```yaml
glass.roughness: 0.4
_wallpapers:
  abc12345:
    _source: /pictures/example.jpg
    glass.roughness: 0.2
```

In memory:

```js
// LookName = string | null; null is Default, not a string sentinel.
// ParamMap = Record<string, boolean|number|string|string[]>
// Pair = { source: string, values: ParamMap }
// Look = { values: ParamMap, wallpapers: Record<string, Pair> }
readLook(look);                 // Look | null; absent named profile is null
writeLook(look, document);      // void; one atomic YAML replacement
readPair(look, id);             // Pair | null; requires named look to exist
listPairs();                   // Array<{ look: LookName, id: string, source: string, values: ParamMap }>
lookPath(look);                 // absolute filename, validates a non-null name
```

An absent Default file means `{values:{}, wallpapers:{}}`, as absent base does today. An absent `_wallpapers` member means no pairs, including for newly imported flat profiles; this is the new schema’s optional field, **not** a lookup into old global files. Named profiles must exist before pair writes. Omit empty `_wallpapers` on serialization; remove a pair when an operation empties its values. Never strip explicitly stored equal-to-look values merely because they currently match: these are sparse **absolute** overrides and still count as saved keys.

Parsing checks the outer mapping, `_wallpapers` mapping, each valid pair id, each pair mapping, and string `_source`. Parameter validation remains `checkLayer`/`validateValue` with a location such as `profile Aurora / wallpaper abc12345`; metadata never reaches the resolver. An inactive pair’s invalid parameter is diagnosed by doctor; malformed selected pairs are rejected before a switch writes. Do not introduce wallpaper-path existence checks for already saved sources: images can move, and the existing hook canonicalizes a newly observed path. Preserve existing name/id validation rather than tightening it to hash-shaped ids and breaking saved data.

### Runtime document

Replace separate scratch storage with this `active.json` shape:

```json
{
  "profile": "Aurora",
  "wallpaper": { "id": "abc12345", "path": "/pictures/example.jpg" },
  "_scratch": { "glass.roughness": 0.3 }
}
```

```js
readRuntime();                 // { active: {profile?:string, wallpaper?:{id,path}}, scratch: ParamMap }
writeRuntime({active,scratch});// validates the whole record, then writeJsonAtomic(activePath(), ...)
readActive();                  // readRuntime().active
writeActive(active);           // preserve readRuntime().scratch; writeRuntime once
readScratch();                 // readRuntime().scratch
writeScratch(scratch);         // preserve readRuntime().active; writeRuntime once
```

Allow missing `_scratch` as an empty map, omit it on empty writes, and never unlink `active.json` just to clear scratch. Reject unknown fields, malformed slots, `_scratch` arrays/null, and the retired `pinned` field without rewriting anything. On `writeRuntime`, validate the `active` input separately: it may contain only `profile` and `wallpaper`, so an injected `active._scratch` can never be mistaken for serialized scratch. The explicit migration removes `pinned`; ordinary `readActive` no longer performs its old repair. All read-modify-write projections require the existing store lock, exactly like current mutations. Switches and Save As call `writeRuntime` directly to publish slots and scratch together.

This relocation is necessary: with separate files, no-wallpaper selection either reveals the old profile without scratch or the new profile with scratch between writes. Co-locating the two removes that intermediate appearance without a runtime journal.

### Pair selection and guards

`active.profile ?? null` selects the look. `loadLayers(active)` gets profile settings from that look and the wallpaper layer from `readPair(active.profile ?? null, active.wallpaper.id)`. A missing pair contributes `{}`; it never searches Default or another profile. Keep `held`, `fallback`, `layer`, `layers`, and describe’s public active shape unchanged.

Use tagged CLI tokens only where a name must encode Default or no wallpaper:

```text
look:       default | profile:<name>
wallpaper:  none    | id:<id>
```

A real profile called `Default`, `default`, or `-` therefore remains distinct from Default.

Add an optional, **paired** precondition suffix to `commit`, `context clear`, `context delete`, and `context rename`:

```text
--expect-look <look-token> --expect-wallpaper <wallpaper-token>
```

Both flags or neither; duplicate, malformed, or half-specified flags fail before writes. Direct CLI calls without guards intentionally act on the current store. Every panel Keep, Save As, Clear, Rename, and Delete supplies both tokens captured from the displayed model; preserve the existing positional wallpaper-id check too. Check guards inside the lock **before** interpreting scratch or calculating a write. Do not attach stale preconditions to profile-selection commands: their job is to select a requested destination through the shared transition, including a sequence of rapid selections.

Expose in `contexts.js`:

```js
parseExpectedSlots(args); // { args: string[], expected: null | {profile:string|null, wallpaper:string|null} }
assertExpectedSlots(active, expected); // void; throws if either slot differs
```

### Transition and commit write prefixes

Before the first write, validate the incoming look/pair, scratch, outgoing pair merge, and intended resolution. Normal switches reject an invalid outgoing fold. Preserve the existing recovery ability for explicit profile selection: selecting a valid incoming named look or Default (including doctor’s `context deactivate profile` remedy) must work when the currently named outgoing look or its selected pair is missing, malformed, unreadable, or fails parameter validation. Validate runtime, base, scratch, and the incoming look/pair independently **outside** the outgoing-read catch; do not swallow their errors. Only the outgoing named-look read/validation may select recovery, and only for explicit profile selection/deactivation with an independently valid incoming look. Preserve scratch unchanged, write no outgoing pair, and set `previous = null`, retaining the existing fan-out of every manifest-bound key when the previous appearance cannot be resolved. Doctor must continue recommending this command for missing/broken active profiles.

The source is intentionally unresolvable during recovery, so a pre-runtime prefix may remain broken; do not assert a valid old appearance for it. Recovery completes its store mutation at the atomic runtime write. Before that write, retry the original selection command. After it, assert the selected valid look plus preserved scratch is valid and use `prism apply` if the bus needs repair. Repeating the selection command after recovery has already completed is a **new** explicit look-selection action, with the ordinary save/discard rules; do not claim blind-retry convergence for that case. Doctor no longer recommends deactivation once the missing reference is cleared. No marker or special precondition is added for this exception. Discovery and doctor remain read-only.

| Operation | Ordered durable writes | Prefix and retry argument |
|---|---|---|
| Select profile/Default with wallpaper, including same-look selection | outgoing look file with merged pair; runtime with next slots and empty scratch; resolved bus | First write leaves old scratch on top of the same merged values. Runtime is the single visible switch. A retry before runtime merges identical values; after runtime scratch is empty and cannot reach the wrong look. |
| Wallpaper rotation/deactivation | outgoing look file with merged pair; runtime with next wallpaper and empty scratch; resolved bus | Same rule; deactivation has no incoming wallpaper. |
| Hook repeats same wallpaper | no writes | Preserve scratch; repeated compositor observations are not explicit look selection. |
| First wallpaper activation | runtime with incoming wallpaper and unchanged scratch; resolved bus | No outgoing pair exists; retain pending values and count. |
| Select profile/Default with no wallpaper | runtime with selected look and empty scratch; resolved bus | One atomic visible change, including selecting the same look. |
| Recover missing/broken active profile by selecting a valid named look or Default | runtime selecting the valid incoming look with unchanged scratch; resolved bus | Outgoing appearance is unavailable, so incoming state and scratch are validated separately and all bound keys fan out. The runtime write completes recovery; retry before it, use `prism apply` after it. Repeating the selection after completed recovery is a new action. |
| Keep for wallpaper | current look file with merged pair; runtime with empty scratch | No screen change; retry after final store write may report nothing to commit. |
| Keep in look | current look file with merged settings and scratch keys removed from its active pair; runtime with empty scratch | Settings and pair pruning are one replacement. Other pairs stay unchanged. Default uses default-elision for its values, as today. |
| Save As to different profile | destination file containing full `store.params` and preserved other destination pairs, with current wallpaper’s pair removed; runtime selecting destination and empty scratch | Before runtime the source is untouched. After runtime the snapshot has no current pair to override it. No source-pair stripping. Retry before runtime rewrites the same snapshot; after runtime a named-current-profile call may refuse empty scratch. |
| Clear active pair | current look file without that pair; resolved bus | Single intended visible change, scratch remains. A completed retry may report untuned. |
| Delete active profile | runtime selecting Default (scratch preserved, matching existing delete semantics); unlink entire profile file; resolved bus | Default’s current pair loads; neither source settings nor pairs outlive the deleted profile. Retry can delete the now-inactive file. Explicit select and delete are distinct actions. |
| Rename active profile | hard-link complete old file to new name; runtime naming new profile with same scratch; unlink old name | Reuse the existing inode-checked algorithm; pairs travel in the file. No bus or sink change. |

Deletion of a wallpaper context means deleting that pair from the **current look**; if it is the active wallpaper retain existing delete behavior (clear the wallpaper slot, preserve scratch), then remove the pair from that same captured look. `context clear` retains the wallpaper slot. Rename is profile-only. Invalid next-state resolution prevents any deletion writes. State stays reserved.

The bus may remain stale if interrupted after the final store write, as today; `prism apply` repairs it. Do not expand this task into sink transaction recovery. Save As to the already selected name retains current merging-commit behavior; explicit same-look CLI selection is a separate action and clears pending edits by saving them to the pair when a wallpaper is active (or discarding them without a wallpaper). The native same-option dropdown limitation is documented below.

### Explicit migration

Add `prism migrate pairs`; keep plain `prism migrate` for parameter replacements. The layout migration also moves old `scratch.yaml` into `_scratch`, preserving **all pending keys**, and explicitly drops retired `pinned`. It does not commit or normalize scratch, change active attribution, or run sinks.

Under the store lock, **each invocation plans from the current files**:

1. Read base, every current profile, all remaining old `contexts/wallpaper/*.yaml`, `active.json`, and old `scratch.yaml`. Validate the complete proposed state before any backup or store mutation. Validate known replacement-era keys through a `migrateValues` + `checkLayer` validation view, while copying original key/value maps unchanged; plain `prism migrate` remains the explicit parameter-conversion operation.
2. Copy each remaining global wallpaper map into Default and every currently existing profile. A missing destination pair is added; an identical `{source,values}` pair is safe; a conflicting existing pair refuses before writes. Preserve all other current pairs/settings, including hand edits. If runtime has no `_scratch`, import old scratch; if both representations exist, require equal maps, otherwise refuse. Explicitly present empty `_scratch` conflicting with nonempty old scratch is also a conflict. When the old scratch file is already gone, retain runtime scratch. Remove `pinned` explicitly without changing active slots. Profiles created after completion inherit no pairs.
3. Compute only the files that will change or be removed. Before touching any store file, make a **fresh immutable backup for this modifying attempt**, using the existing byte-copy layout extended for `state/active.json`. Back up every present changed/removed original, including look destinations, old globals, runtime, and old scratch. Write `originally-absent.txt` listing only originally absent output paths (`config/values.yaml`, `state/active.json`, etc.) for manual restoration. This plain text list is never read by migration. Use a unique suffix on the timestamp directory so an immediate retry can create a new backup without replacing any earlier one. If any backup copy or list write fails, stop before store mutation; retain even a partial backup rather than reusing it.
4. Install all changed **look documents first**, then the changed **runtime document**, and only then delete old global wallpaper files and old scratch. Never remove an old source before every destination and runtime write succeeds. Identical files need no rewrite. A failure during installation leaves every old source available for rerun; a failure during cleanup occurs only after every destination already contains its data. Reread the current store on retry, accept equal copies, and preserve/refuse a manually edited conflict instead of replaying frozen output.
5. Report the new backup path and every pair copied or already matching, and whether scratch moved. Keep the first complete backup: it holds the original files from before the first modifying attempt. Later attempt backups describe later prefixes and do not replace it. Manual full rollback uses that first backup: copy its config-relative files back to config, `state/` files back to state, and remove outputs named in its `originally-absent.txt`. This restores the old layout for old code or a fresh migration; no new restore command is added.

There is no migration pointer, persistent replay plan, versioned manifest, stored root identity, marker, or normal-write journal. `planPairMigration` is an in-memory plan for one locked invocation only. A completed rerun is a no-op and creates no backup.

Introduce `assertPairLayout()` in `migrate.js`: refuse normal store reads/writes while old global wallpaper files, old `scratch.yaml`, or retired runtime `pinned` remains, with `run 'prism migrate pairs'`. The sources themselves are the incomplete-layout signal. Check under the lock in every ordinary entry path, including `unset --base`, which currently bypasses `loadStore`. Plain parameter migration also refuses until layout migration finishes. Discovery (`context list/show`) and doctor stay read-only diagnostic paths: name the remaining old sources, never resolve them as fallback pairs. Once the last old source is deleted all destinations are already installed, so ordinary store use is safe without a completion marker.

## File map

| File | Responsibility |
|---|---|
| `src/contexts.js` | Look/pair document IO, runtime record/projections, profile lifecycle, expected-slot parsing and checks; retain existing atomic YAML and inode-safe rename code |
| `src/values.js`, `src/scratch.js` | Existing public value/scratch APIs become projections over look/runtime documents; setters preserve other document contents |
| `src/layers.js` | Resolve exactly one look–wallpaper pair; unchanged public describe provenance |
| `src/context-cli.js` | Task 2: shared transition/recovery and current-look command IO; Task 3: all-pair discovery and guarded clear/delete; preserve existing fan-out |
| `src/commit.js` | Atomic look/pair commits and Save As screen invariance |
| `src/migrate.js`, `src/cli.js`, `src/paths.js` | Task 2: current-store layout migration, legacy-source guard, all-pair parameter migration and diagnosis; Task 3: expected-slot command guards; no migration marker path |
| `integrations/noctalia-plugin/queue.luau`, `panel.luau`, `presentation.luau` | Captured slot guards, truthful optimistic selection/counts, pair labels; retain callback reconciliation |
| Existing tests plus `test/pairs.test.js`, `test/runtime.test.js`, `test/pair-migrate.test.js` | Tasks 1–3: behavior and migration fixtures; Task 4: exhaustive write-prefix/multiprocess matrix; Task 5: rendered lifecycle |
| `README.md`, `docs/notes/noctalia-plugin-contract.md`, new acceptance note | Final storage/CLI contract and reviewable desktop procedure |

---

### Task 1: Add atomic look and runtime document primitives

**Tracker:** `prism-95e0d0`. **Complexity:** mid. **Process:** direct. **Depends:** none.

**Files:** Modify `src/contexts.js`; create `test/pairs.test.js`, `test/runtime.test.js`. Keep old consumers untouched in this commit; the new helpers are the independently tested prerequisite, not a production dual-read path.

**Interfaces:** Produces `lookPath`, `readLook`, `writeLook`, `readPair`, `listPairs`, `readRuntime`, `writeRuntime` with the exact contracts above. Consumes existing `activePath`, `valuesPath`, `contextsDir`, `readJson`, `writeJsonAtomic`, `assertName`, and `yaml`.

- [ ] **Step 1: Write storage tests in isolated config/state directories.** Use existing `beforeEach` temp-store pattern. Include these tests and malformed metadata cases:

```js
test('same wallpaper has independent Default and named-look values', () => {
  writeLook(null, { values: {}, wallpapers: {
    w1: { source: '/w', values: { 'glass.roughness': 0.1 } },
  } });
  writeLook('Default', { values: { 'glass.roughness': 0.4 }, wallpapers: {
    w1: { source: '/w', values: { 'glass.roughness': 0.2 } },
  } });
  assert.equal(readPair(null, 'w1').values['glass.roughness'], 0.1);
  assert.equal(readPair('Default', 'w1').values['glass.roughness'], 0.2);
  assert.equal(readPair('Default', 'missing'), null);
  assert.equal(listPairs().length, 2);
});

test('runtime atomically carries selection and scratch without leaking metadata', () => {
  const state = { active: { profile: 'Aurora', wallpaper: { id: 'w1', path: '/w' } },
    scratch: { 'glass.roughness': 0.3 } };
  writeRuntime(state);
  assert.deepEqual(readRuntime(), state);
  writeRuntime({ active: { profile: 'Dark' }, scratch: {} });
  assert.deepEqual(readRuntime(), { active: { profile: 'Dark' }, scratch: {} });
});
```

Write table cases for `_wallpapers: []`, a pair without `_source`, `_scratch: []`, unknown runtime fields, invalid profile names, wallpaper unknown fields, and `pinned`. Read failures leave bytes unchanged; invalid `writeRuntime` inputs leave the previous valid record byte-identical. Include `writeRuntime({active:{_scratch:{x:1}},scratch:{}})` and assert rejection before filesystem calls. Flat profile YAML still decodes to `{values, wallpapers:{}}`; a missing named look is null; writing an existing look preserves exactly the explicitly supplied pair map.

- [ ] **Step 2: Run the new tests red.** `node --test test/pairs.test.js test/runtime.test.js`; expect missing-export failures, then implement.

- [ ] **Step 3: Add document parsing/writing using current atomic primitives.** Keep metadata outside parameter maps. The conversion’s core is:

```js
const { _wallpapers = {}, ...values } = doc;
// Validate each mapping and _source before constructing these entries.
const wallpapers = Object.fromEntries(Object.entries(_wallpapers).map(([id, pair]) => {
  const { _source, ...pairValues } = pair;
  return [id, { source: _source, values: pairValues }];
}));
return { values, wallpapers };
```

```js
export function writeRuntime({ active, scratch }) {
  for (const field of Object.keys(active)) {
    if (!['profile', 'wallpaper'].includes(field)) throw new Error(`unknown active field ${field}`);
  }
  // Validate input object shapes before this loop and serialization.
  const record = { ...active, ...(Object.keys(scratch).length ? { _scratch: scratch } : {}) };
  validateRuntimeRecord(record);
  writeJsonAtomic(activePath(), record);
}
```

Define `validateRuntimeRecord(record)` in `contexts.js`; it returns `{active,scratch}`, validates every field described above, and is used on reads and writes. `writeLook` uses the current temp-write/rename code, serializes `_source`, and validates document shape before creating directories. Keep low-level IO independent of `defs`; callers perform parameter validation.

- [ ] **Step 4: Run focused and full gates.** `node --test test/pairs.test.js test/runtime.test.js`, then `just test`, `just check`, `tasks check`. The existing suite must still pass because production consumers have not switched.

- [ ] **Step 5: Close this step through the CLI and commit only its files and task record.** `tasks done prism-95e0d0 "Added validated atomic look/pair and runtime document primitives."`; rerun `tasks check`; commit `feat(store): add look pairs and atomic runtime documents`.

### Task 2: Cut over store readers and writers with idempotent layout migration

**Tracker:** `prism-01554f`. **Complexity:** high. **Process:** direct. **Depends:** Task 1. **Goal:** `prism-d513ec`.

**Files:** Modify `src/{contexts,values,scratch,layers,context-cli,commit,migrate,cli,paths}.js`, `README.md`; create `test/pair-migrate.test.js`; update existing store/CLI/migration/write-order fixtures and plugin contract fixtures that create old wallpaper or scratch files. No guarded Lua command transport yet.

**Interfaces:** Consumes Task 1 document helpers; produces pair-scoped `loadStore`, all transition/commit behavior including the narrow recovery exception, and preserved `readActive/readValues/readScratch` projections. `readContext('profile', name)` remains a settings projection; value-only writers preserve pairs, while lifecycle/Save As use `writeLook`. Remove global wallpaper IO from ordinary context paths; only migration reads old files. Existing unqualified wallpaper CLI commands remain functional for the selected look through direct pair IO. Task 3 adds all-pair discovery and guards without another format switch.

**Migration interfaces:**

```js
assertPairLayout();                       // legacy-source presence check, no marker file
planPairMigration(defs);                  // null | { originals, outputs, removals, copies }
runPairMigration(defs, { print, now });    // lock held; rereads current files, returns copy count
writeBackup(files, now, { unique = false } = {}); // existing helper, optional fresh suffix
```

The plan is ephemeral. `originals` are present files passed to the existing backup helper; `outputs` are `{path, text, existed}` for changed look/runtime files; `removals` are old source paths; `copies` are `{look:string|null,id:string,existing:boolean}` for reporting. Paths are constructed from the configured store paths and validated context names, never deserialized from a saved plan. `originally-absent.txt` is derived from `outputs` with `existed:false`, for a human to undo new files; migration never reads it. Parameter migration retains `planMigration/writeMigrated`, grouping each physical look/runtime file into one output while reporting all changed logical maps.

- [ ] **Step 1: Add the behavioral regression before switching production readers.** Extend the current CLI test fixture with `writeLook` and this case (use the captured helper below, returning exactly `{code,stdout,stderr}`):

```js
async function runCaptured(argv, opts = {}) {
  let stdout = '', stderr = '';
  const code = await cli.run(argv, { runner: () => {}, ...opts,
    print: (text) => { stdout += text; }, eprint: (text) => { stderr += text; } });
  return { code, stdout, stderr };
}
```

```js
test('select saves outgoing edits to its pair and returns with no pending edits', async () => {
  writeLook('Aurora', { values: { 'glass.roughness': 0.4 }, wallpapers: {} });
  writeLook('Dark', { values: { 'glass.roughness': 0.8 }, wallpapers: {} });
  writeRuntime({ active: { profile: 'Aurora', wallpaper: { id: 'w1', path: '/w' } },
    scratch: { 'glass.roughness': 0.2, 'terminal.background.opacity.inactive': 0.5 } });
  assert.equal((await runCaptured(['context', 'activate', 'profile', 'Dark'])).code, 0);
  assert.deepEqual(readScratch(), {});
  assert.equal(loadStore(defs).params['glass.roughness'], 0.8);
  assert.equal(readPair('Dark', 'w1'), null);
  assert.equal(readPair('Aurora', 'w1').values['glass.roughness'], 0.2);
  assert.equal(Object.keys(readPair('Aurora', 'w1').values).length, 2);
  assert.equal((await runCaptured(['context', 'activate', 'profile', 'Aurora'])).code, 0);
  assert.deepEqual(readScratch(), {});
  assert.equal(loadStore(defs).params['glass.roughness'], 0.2);
});
```

Add same-look selection, Default selection, no-wallpaper discard, first wallpaper activation preserving scratch, duplicate hook preserving scratch, and profile-selection/wallpaper-rotation commutativity with empty scratch. Add malformed incoming/outgoing pair cases checking **all store bytes** unchanged, except the explicitly requested deactivate-profile recovery. Add the missing/broken-profile doctor-remedy tests below. Run `node --test test/context-cli.test.js` and confirm the new behavior fails under the old consumers.

Use the same captured helper to exercise doctor’s remedy with nonempty scratch:

```js
test('doctor remedy leaves a missing active profile without losing scratch', async () => {
  writeLook(null, { values: { 'glass.roughness': 0.4 }, wallpapers: {} });
  const scratch = { 'glass.roughness': 0.3 };
  writeRuntime({ active: { profile: 'Missing', wallpaper: { id:'w1', path:'/w' } }, scratch });
  const diagnosis = await runCaptured(['doctor']);
  assert.equal(diagnosis.code, 1);
  assert.match(diagnosis.stdout, /prism context deactivate profile/);
  assert.equal((await runCaptured(['context','deactivate','profile'])).code, 0);
  assert.deepEqual(readActive(), { wallpaper: { id:'w1', path:'/w' } });
  assert.deepEqual(readScratch(), scratch);
  assert.equal(loadStore(defs).params['glass.roughness'], 0.3);
  assert.equal(readPair(null, 'w1'), null, 'recovery must not attribute edits to Default');
});
```

Repeat with a malformed outgoing profile document and with no wallpaper. Preserve the broken document byte-for-byte and verify the command's runner receives every bound key (including keys whose new value matches a default). Add invalid base, invalid scratch, and invalid incoming Default pair variants that refuse with **zero writes**. A malformed incoming profile during normal activation still refuses; recovery is explicit selection away from a currently named broken look. Add a valid named destination variant to preserve the existing ability to recover by selecting that profile; wallpaper rotation alone still fails because it leaves the broken selected look in its incoming fold.

- [ ] **Step 2: Wire projections and the resolver together.** Replace the implementations of `readActive/readScratch/readValues` and their writers with the documented projections. A value-only writer performs a locked read/replace of its containing document:

```js
export function writeValues(values) {
  const look = readLook(null);
  writeLook(null, { ...look, values });
}
export function writeScratch(scratch) {
  writeRuntime({ ...readRuntime(), scratch });
}
```

Keep the old scratch path only for explicit migration; remove ordinary reads/writes of it. In `loadLayers`, use `readPair(active.profile ?? null, active.wallpaper.id)` for wallpaper; preserve `LAYER_ORDER`, `RESOLUTION_ORDER`, and scratch normalization against `beneath`. Rename/delete keeps the existing whole-file operations because pairs are embedded. Audit **every** `readContext/writeContext`, `writeValues`, and `writeActive` caller with `rg` so no value-only write drops embedded pairs or scratch.

- [ ] **Step 3: Implement one transition for profile selection and wallpaper changes.** Replace `wallpaperLeaving/planFold`’s wallpaper-only decision with explicit transition intent. Keep hook-repeat detection separate from explicit profile selection. Compute `recoverOutgoing` first: only explicit profile selection/deactivation with a currently named profile may catch its outgoing document read/validation failure. Read/validate runtime, base, scratch and the incoming look/pair outside that catch. On recovery set `previous = null`; on normal transitions resolve the previous state normally. Do not call `loadStore` in a broad try/catch that also swallows incoming/base/scratch failures:

```js
const outgoing = active.wallpaper;
const selectLook = intent === 'select-profile';
const wallpaperChanged = active.wallpaper?.id !== next.wallpaper?.id;
const saveOutgoing = !recoverOutgoing && outgoing !== undefined && (selectLook || wallpaperChanged);
const scratchAfter = recoverOutgoing ? scratch : (selectLook || saveOutgoing ? {} : scratch);
if (saveOutgoing && Object.keys(scratch).length) {
  const old = readPair(active.profile ?? null, outgoing.id);
  const merged = { source: old?.source ?? outgoing.path, values: { ...(old?.values ?? {}), ...scratch } };
  // Put merged into the outgoing Look in memory, validate both complete folds,
  // then write that Look followed by writeRuntime({active: next, scratch: scratchAfter}).
}
```

For same-look selection, compute incoming layers from the **planned merged look**, not a stale read of its pair. For all selections use the planned final runtime in resolution before writing. A readable outgoing Default or profile with a missing pair is simply untuned, not a recovery case. When `previous === null`, fan out every unique manifest-bound key; otherwise run fan-out only for changed resolved values; provenance-only changes still need persisted runtime/describe refresh. Preserve the existing apply recovery rule for a stale bus.

Keep existing unqualified wallpaper commands working during the atomic format switch: replace their global file reads/writes with explicit `readPair(active.profile ?? null, id)` and whole-look writes. List/show may retain current-look scope until Task 3 adds all-pair discovery. Clear/delete must already touch only that selected look; no temporary global IO or compatibility reader survives this commit. Document active-profile **delete** separately in README: it removes the profile and all its pairs, selects Default, and preserves scratch, unlike a successful ordinary explicit selection.

- [ ] **Step 4: Implement commits from whole look documents.** For Keep in look, merge scratch into settings and remove precisely its keys from the selected pair **in the same document**. For Keep for wallpaper, merge scratch into that look’s active pair. For Save As, create this destination before publishing runtime:

```js
const target = readLook(name) ?? { values: {}, wallpapers: {} };
const wallpapers = { ...target.wallpapers };
if (active.wallpaper !== undefined) delete wallpapers[active.wallpaper.id];
const nextLook = { values: { ...store.params }, wallpapers };
// Resolve the destination with empty scratch and this planned pair map;
// assert isDeepStrictEqual(nextParams, store.params) before the first write.
writeLook(name, nextLook);
writeRuntime({ active: { ...active, profile: name }, scratch: {} });
```

Do not overwrite the outgoing pair during Save As; do not strip any other destination pair. Extend `commitKeepsScreen` tests for replacement with a conflicting current destination pair, empty scratch, Default source, and a destination retaining a second wallpaper’s pair. `resolved.json` stays byte-identical and the runner is uncalled on every commit.

- [ ] **Step 5: Build and test the explicit migration before enabling its guard.** Use the current-store migration algorithm above and existing atomic writers. Extend `writeBackup(files, now, {unique = false} = {})` so `unique: true` uses `fs.mkdtempSync(backupDir(now) + "-")`; existing callers retain their current timestamp/collision behavior. Pair migration passes `unique: true` for a fresh backup on every modifying attempt. Write the restoration-only `originally-absent.txt` after all copies and before the first store write. Extend backup handling to `state/active.json`, preserving byte-for-byte originals and originally absent destinations. Add `migrate pairs` dispatch; it acquires the existing lock once. Plain `migrate` traverses Default and all named-look settings/pairs plus runtime scratch and writes each physical file once, so two changed maps in one profile never overwrite each other.

Representative fixture in `test/pair-migrate.test.js`, with local isolated dirs and the existing CLI captured-output pattern:

```js
test('layout migration copies globals to every existing look and preserves pending scratch', async () => {
  fs.writeFileSync(valuesPath(), 'glass.roughness: 0.4\n');
  fs.mkdirSync(path.dirname(contextPath('profile', 'Aurora')), { recursive: true });
  fs.writeFileSync(contextPath('profile', 'Aurora'), 'glass.roughness: 0.6\n');
  fs.mkdirSync(path.dirname(contextPath('wallpaper', 'w1')), { recursive: true });
  fs.writeFileSync(contextPath('wallpaper', 'w1'), '_source: /w\nglass.roughness: 0.2\n');
  fs.writeFileSync(activePath(), JSON.stringify({profile:'Aurora', wallpaper:{id:'w1',path:'/w'}}));
  fs.writeFileSync(scratchPath(), 'glass.roughness: 0.3\n');
  assert.equal((await runCaptured(['migrate', 'pairs'])).code, 0);
  assert.equal(readPair(null, 'w1').values['glass.roughness'], 0.2);
  assert.equal(readPair('Aurora', 'w1').values['glass.roughness'], 0.2);
  assert.deepEqual(readScratch(), { 'glass.roughness': 0.3 });
  assert.equal(readActive().profile, 'Aurora');
  assert.equal(fs.existsSync(scratchPath()), false);
  assert.equal(fs.existsSync(contextPath('wallpaper', 'w1')), false);
  writeLook('New', {values:{}, wallpapers:{}});
  assert.equal(readPair('New', 'w1'), null);
});
```

Cover zero old wallpaper files with scratch-only migration; multiple active/inactive profiles; preserved YAML backup comments; malformed inactive pair/global file; already-present conflicting pair; conflicting scratch sources; missing original base/runtime; `pinned`; equal existing pairs and equal dual scratch representations; explicit empty/new versus nonempty/old scratch conflict; clean repeat; and a replacement parameter in an inactive pair. Byte snapshots must show ordinary describe/get/list never repairs layout. Doctor must identify each bad pair with look and id and keep diagnosing remaining valid documents.

- [ ] **Step 6: Finish the atomic consumer cutover and run full gates.** Replace old global-wallpaper test fixture writes with explicit look/pair setup except where testing migration. Replace assertions requiring scratch survival on profile selection with the approved zero-pending behavior. Keep first-activation, same-wallpaper-hook, typed-value validation, and slider-echo regression assertions intact. Update README’s storage, explicit migration/restore instructions, recovery boundary, active-profile-delete scratch preservation, and interruption table. Existing argv stays accepted; expected-slot suffixes and broader discovery arrive in Task 3. Adapt existing write-order fixtures/assertions as needed to keep the current complete suite green; the expanded adversarial matrix is Task 4. Run focused tests, then `just test`, `just check`, `tasks check`; all Node, Lua, and contract tests must pass together.

- [ ] **Step 7: Close and commit this atomic format cutover.** `tasks done prism-01554f "Cut over look/pair and runtime storage, preserved broken-profile recovery, and added backed-up idempotent layout migration."`; rerun `tasks check`; commit `feat(store): cut over to profile wallpaper pairs`. The required atomic boundary is the actual reader/writer and fixture format switch; the separate guard/discovery and adversarial-verification tasks each have their own full-suite gate.

### Task 3: Guard pair actions and expose all-pair discovery

**Tracker:** `prism-fba116`. **Complexity:** mid. **Process:** direct. **Depends:** Task 2. **Goal:** `prism-d513ec`.

**Files:** Modify `src/{contexts,context-cli,commit}.js`, `integrations/noctalia-plugin/{queue,panel}.luau`, `plugin_test.lua`, `contract.test.mjs`, `test/{context-cli,commit,plugin-client}.test.js`, `README.md`, `docs/notes/noctalia-plugin-contract.md`.

**Interfaces:** Consumes Task 2’s pair-aware store and existing unqualified commands. Produces `parseExpectedSlots(args)` and `assertExpectedSlots(active, expected)` with the signatures in Pair selection and guards; `Queue.captureSlots(model)` returns `{look:string,wallpaper:string}` tagged tokens; `item.expected` is optional only for intentional direct/current-store CLI behavior. Produces all-look `context list`, `context show wallpaper <id> [--look <token>]`, and guard-aware clear/delete/commit/rename. No storage format change.

- [ ] **Step 1: Write the stale-owner and discovery regressions, then run them red.** Use `{code,stdout,stderr}` captured results and existing isolated fixtures. For each `commit wallpaper w1`, `context clear wallpaper w1`, and active profile delete/rename, capture Aurora/W tokens, switch the store to Dark/W, and assert a guarded request returns nonzero with all files byte-identical. Repeat with only wallpaper changed and with Default versus a profile named Default. List must show identical ids under two looks as separate owned pairs; show with an explicit inactive look must return that look’s values. Run `node --test test/context-cli.test.js test/commit.test.js test/plugin-client.test.js` before implementation.

- [ ] **Step 2: Wire explicit slot guards and pair discovery.** Parse guard suffixes before existing positional arguments. Check the parsed expectation inside each mutation’s lock before reads leading to writes. Add a shared Lua `Queue.captureSlots(model)` returning `{look=<tagged token>, wallpaper=<tagged token>}`; append both flags from `item.expected` in `argvFor`. Capture on the rendered action, before `commitAction` optimistically changes `state.model.active`, and before replace confirmation queues Save As. Do not capture at process launch, where the model may already have changed.

```lua
local item = {verb = "commit", destination = "profile", target = name,
  expected = Queue.captureSlots(state.model)}
-- Existing optimistic handling follows capture.
```

For `context show wallpaper <id>` add optional `--look <look-token>`; default is the currently loaded look. `context list` enumerates all pairs as `wallpaper <look-token> <id> <source>` and marks only the exact active pair. `context show profile <name>` prints the whole look document, so exported profiles carry their pairs. Preserve raw-text diagnostics for malformed files; malformed one-look discovery must not hide the other looks. Explicit `context activate wallpaper <id>` requires a saved pair in the current look and uses its source; the hook remains the way to activate an untuned path.

Test guard mismatch with the same wallpaper/different look, same look/different wallpaper, Default versus a profile called `Default`, no wallpaper versus an id, and half-specified flags. Each mismatch must preserve all files. Verify every actual queue argv against the CLI parser in the existing contract harness. Keep direct CLI calls without preconditions usable.

- [ ] **Step 3: Verify clear/delete ownership and update command documentation.** Keep a same-id pair in Default, Aurora, and Dark; clear Aurora/W with both expected slots, assert only Aurora/W disappears and scratch stays; delete wallpaper W under Aurora, assert only Aurora's pair and the active wallpaper slot are removed while scratch survives. Delete an active named profile with scratch and multiple pairs, assert the full profile file is removed, Default is selected, and scratch survives. Stale guarded versions must mutate none of these files. README and the plugin contract must distinguish active-profile deletion from ordinary selection and show both expectation flags and inactive-look show syntax.

- [ ] **Step 4: Run full gates, close, and commit.** Run focused CLI/queue/contract tests, then `just test`, `just check`, `tasks check`. `tasks done prism-fba116 "Added expected-slot guards, captured panel pair identity, and all-look pair discovery and management."`; rerun `tasks check`; commit `feat(context): guard and inspect look wallpaper pairs`.

### Task 4: Verify interruption prefixes and concurrent pair mutations

**Tracker:** `prism-5bcb56`. **Complexity:** high. **Process:** direct. **Depends:** Task 3. **Goal:** `prism-d513ec`.

**Files:** Modify `test/write-order.test.js`, `test/pair-migrate.test.js`, `test/lock-multiprocess.test.js`; make minimal source fixes only if the new adversarial tests expose an invariant violation. Preserve Tasks 2–3 public interfaces.

**Interfaces:** Consumes all durable transitions, commits, guards, and the current-store migration. Extends the existing real-filesystem injection harness (rename/link/rm/unlink and migration copy/write failures); no production failure-hook API or transaction abstraction.

- [ ] **Step 1: Extend ordinary-transition prefix tests.** Exercise every operation in the prefix table with distinct values and at least two same-id pairs under different looks. Include no-wallpaper selection, same-look selection, Default round-trips, Keep in look, Save As replacement with other destination pairs, and active rename carrying pairs. At each write prefix assert exact before/after resolved appearance, correct source/destination pair maps, and retry convergence to the clean-run store (completed refusals only after final mutation). Add recovery separately: before its runtime write retry the selection/deactivation; after that write assert the valid incoming look plus unchanged scratch, then run `prism apply` and assert the bus, without treating a new explicit selection as a recovery retry.

- [ ] **Step 2: Exercise every migration write prefix from current state.** Add interruption points during backup copies, `originally-absent.txt` write, each look replacement, runtime replacement, each global deletion, and old scratch deletion. Before store mutation, every original stays byte-identical. After any store-write prefix, rerun `migrate pairs` against the current files and compare final look/runtime outputs with the clean result; after the final legacy deletion it is a no-op. Ignore fresh backup-directory names in output comparison, but retain and byte-verify the first complete backup against all pre-first-attempt originals and its absent-output list. Verify a modifying retry creates a different backup and never edits the first; backup failure creates no store mutation. Restore from the first backup plus plain absent-output list in a temporary store and compare original present/absent files exactly.

Add deliberate manual conflicts between attempts: change an already copied destination pair while its old global source still exists, or change `_scratch` while old scratch remains. The rerun must refuse before any backup or store write and preserve the manual edit; after resolving the conflict intentionally, rerun can finish. Also change a nonconflicting unrelated pair/setting and assert rerun retains it. No saved output is replayed over current content.

```js
// After an injected stop following one look replacement, before any source deletion:
const current = readLook('Aurora');
current.wallpapers.w1.values['glass.roughness'] = 0.7;
writeLook('Aurora', current); // simulate a deliberate hand edit, not normal CLI during migration
const beforeRetry = files();
const refused = await runCaptured(['migrate', 'pairs']);
assert.equal(refused.code, 1);
assert.match(refused.stderr, /conflict/);
assert.deepEqual(files(), beforeRetry);
```

- [ ] **Step 3: Extend multiprocess coverage and fix only demonstrated failures.** Run competing profile selections and guarded pair commits through the real store lock. Assert both commands serialize, a stale guarded command refuses, pending keys are attributed to the look/wallpaper active when their transition executes, and final runtime/looks parse and resolve. Use the existing subprocess harness; do not introduce a second lock or production test hook. Run `node --test test/write-order.test.js test/pair-migrate.test.js test/lock-multiprocess.test.js` and address each failing invariant at its shared implementation point.

- [ ] **Step 4: Run full gates, close, and commit the verification deliverable.** Run `just test`, `just check`, `tasks check`. `tasks done prism-5bcb56 "Verified all pair write prefixes, current-store migration retries and conflict refusal, recovery apply boundary, and multiprocess attribution."`; rerun `tasks check`; commit `test(store): verify pair interruption and concurrency guarantees`. Once all three children are done, the controller verifies and closes goal `prism-d513ec`; no child closes that goal itself.

### Task 5: Show pair ownership and verify profile selection in the open panel

**Tracker:** `prism-0c82ac`. **Complexity:** mid. **Process:** direct. **Depends:** Task 4.

**Files:** Modify `integrations/noctalia-plugin/{panel,presentation}.luau`, `plugin_test.lua`, `contract.test.mjs`, `test/plugin-presentation.test.js`, `test/plugin-panel-lifecycle.test.js`, `README.md`, `docs/notes/noctalia-plugin-contract.md`; create `docs/notes/2026-09-20-profile-wallpaper-pairs-acceptance.md`.

**Interfaces:** Consumes unchanged describe `active/profile/held/fallback` fields and Task 3’s `Queue.captureSlots(model)` guarded transport. `Presentation.wallpaperHeader(model)` adds only `look` (display name) to existing `{id,name,tuned}`. The panel captures guarded actions with `Queue.captureSlots(model)`; presentation does not carry a second guard representation. No new describe protocol version, polling timer, shell observation, or model cache.

- [ ] **Step 1: Add presentation/lifecycle expectations before changing copy.** Test header text `2 for Aurora + this wallpaper` and `2 for Default + this wallpaper`, zero visible saved keys, no wallpaper row, and a hidden CLI-only pair key excluded from the count. Verify saved pairs and profile settings never contribute to pending count. Reuse the existing Lua host and its immediate/deferred reconciliation callbacks; do not create another harness.

In that host, exercise this exact sequence:

```text
Describe Aurora/W, zero scratch → change two sliders → show 2 edits.
Select Dark → optimistic pending count becomes zero; no set is queued by model callbacks.
Complete activation and describe Dark/W → still zero edits, Dark values and its own saved count.
Select Aurora → describe restores its two saved pair values, zero pending edits, two saved adjustments.
Re-render and fire the periodic refresh → values/counts unchanged, no new set commands.
```

Test an explicit same-look activation command with both visible and CLI-only scratch in Task 2; never gate that transition on the visible edit count. Model native programmatic selection updates as silent. Keep current same-index panel handling; changing a Lua guard cannot create an event that the host does not emit. Preserve `fde3bc8`’s slider callback handling unchanged unless a failing test demonstrates a required fix. The native dropdown limitation below remains outside this repository scope; a simulated callback is not evidence that a physical same-option click is emitted. Existing Keep for wallpaper already saves the current pair and clears pending edits without a new control.

- [ ] **Step 2: Implement truthful optimistic selection and pair labels.** An ordinary user selection clears each parameter’s optimistic `edited` flag before render. Recovery selection is an exception that retains scratch; the accepted authoritative describe restores those pending flags, as it does after a failed selection. Do not rewrite `held` or pretend to know incoming saved values: the queued describe reconciles those. Failed activation’s follow-up describe restores the true count and existing error banner. Add one `state.selectionPending` boolean, set before queueing profile selection or Save As. Clear it only when `described()` accepts an authoritative, non-invalidated model; queue drain does not clear it. A failed command keeps it set until its reconciliation describe is accepted; a failed/invalidated describe keeps it set until a later accepted refresh. While it is set, disable and handler-guard Keep/Clear/Rename/Delete/Save As actions so optimistic `active.profile` cannot combine an incoming name with outgoing values. Profile selection and sliders remain enabled. Real slider edits queued behind a selection write the incoming look’s scratch; do not disable sliders or discard their queued set commands while `selectionPending` is true. Rapid consecutive selections stay available; preserve the existing queue and stale-and-replay mechanism. Existing captured closures must still carry their original expectation when tested after the store changes.

```lua
-- In the genuine user-selection path, before enqueue and render:
state.selectionPending = true
for _, param in ipairs(state.model.params) do param.edited = false end
-- In described(), after accepting and installing a non-invalidated model:
state.selectionPending = false
-- Header copy uses the look supplied by wallpaperHeader:
text = header.tuned .. " for " .. header.look .. " + this wallpaper"
```

Keep the basename in the tooltip. Use `Keep N edits for <look> + this wallpaper` and `Clear <look> + this wallpaper's N adjustments`; a saved pair is never described as pending edits. Count/reset visibility rules stay unchanged. The selector’s index 0 remains `Default`.

- [ ] **Step 3: Verify complete control semantics through existing harnesses.** Cover Keep in look and Keep for wallpaper with stale look and stale wallpaper; Clear preserves scratch and other pairs; failed Keep restores optimistic pending flags from describe; Neutral then Revert restores profile+pair without changing stored look bytes; Save As replaces the current destination pair while retaining another destination pair. Test the interval after the queue drains but before describe completes: selectionPending still disables pair actions. Failed and invalidated describes must not reopen them. While selection is pending, move a slider, verify it stays enabled, and assert its genuine set is queued after selection and appears in the incoming scratch after accepted describe. Contrast that real user write with model-echo callbacks, which must still enqueue no set. Test two rapid selections and delayed periodic describe while the queue is busy: the existing stale-and-replay path runs once after drain and restores authoritative counts. No `context wallpaper` command may originate from panel events.

- [ ] **Step 4: Update the user contract and prepare desktop acceptance.** The contract note records exact guards, pair labels, zero edits after ordinary explicit selection, first-wallpaper and broken-profile-recovery exceptions, active-profile deletion preserving scratch, no-wallpaper discard, runtime scratch location, and CLI same-look selection. Write the acceptance note with this runnable temporary-store preflight:

```sh
just test
just check
tasks check
```

Then give a desktop checklist matching all six amendment acceptance items, with spaces to record observed results: zero-count selection while open; Aurora/W versus Dark/W round-trip; independent rotation; Keep/Clear locality; Neutral/Revert; rename plus migration/backup evidence. Add Save As replacement, Default, and no-wallpaper cases. State that automated failure injection supplies interruption evidence and desktop work must not corrupt real files to simulate crashes. Record migration command/report/backup location when the existing acceptance task runs it; do not claim desktop acceptance now. Have `prism-439774` consume this note rather than create a second acceptance task.

- [ ] **Step 5: Run the full gate and commit the finished UI contract.** Run `node --test test/plugin-presentation.test.js test/plugin-panel-lifecycle.test.js integrations/noctalia-plugin/contract.test.mjs`, then `just test`, `just check`, `tasks check`. Close the step via `tasks done prism-0c82ac "Panel names the active look–wallpaper pair and verifies zero pending edits across selection and reconciliation."`; commit `feat(panel): show wallpaper adjustments for the selected look`.

## Native dropdown capability found during planning

Read-only inspection of the installed Noctalia source found `src/ui/controls/select.cpp` calls `setSelectedIndexInternal(index, true)` for a user option click, but suppresses a same-index callback unless `m_notifyOnReselect` is enabled (default false in `select.h`). `src/ui/ui_tree_reconciler.cpp` applies model `selectedIndex` via `setSelectedIndexSilently`, so model reconciliation itself does not notify. Its select property allowlist and setter code do **not** expose the existing `setNotifyOnReselect` capability to Lua.

Thus Prism can guarantee same-look selection through its CLI/shared transition, but this checkout alone cannot make the native dropdown emit a same-option activation. Changing Prism’s callback guard alone cannot provide that event. Keep this plan scoped to Prism: CLI same-look selection works, and the existing Keep for wallpaper action provides save-current-pair with zero pending edits in the panel. Local idea `prism-02befb` tracks exposing Noctalia’s existing boolean property; it is not a dependency of these tasks. Do not invent callback heuristics, add a new Prism control, or claim same-option desktop acceptance from the Lua mock. The desktop acceptance note must state this native event limitation.

## Handoff and completion

The user has reviewed this plan; these three requested amendments are incorporated and the controller verifies them before continuing with the preserved execution method. The reviewed architecture and unaffected decisions do not need a second approval. After implementation, dispatch the required whole-branch review through the preserved subagent-driven method, run `just gate`, and resolve its findings before live acceptance. Keep the branch unmerged until `prism-439774` records desktop results for the amendment. The controller owns existing parent task/spec status updates and any cross-project follow-up; children must not close or rewrite unrelated task records.
