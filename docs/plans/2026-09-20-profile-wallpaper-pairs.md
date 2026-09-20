# Profile–Wallpaper Pairs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The user already chose this execution method; review this written plan before implementation.

**Goal:** Selecting a look saves outgoing wallpaper edits and loads the selected look’s own wallpaper adjustments with zero pending edits.

**Architecture:** Put each look’s `_wallpapers` map in its existing settings file, so one atomic replacement updates settings and pairs together and profile rename/delete carries both. Put pending scratch in `active.json` alongside the selected slots, so selection and clearing scratch are one atomic write. Keep the existing lock, resolver, atomic writers, and hook; explicitly migrate old global wallpaper files and `scratch.yaml`, with no runtime fallback or transaction engine.

**Tech Stack:** Node.js >=20, existing `yaml` dependency, `node:test`, existing Lua/Noctalia plugin harness, `just` and `tasks`.

**Spec:** [Approved amendment](../specs/2026-09-20-profile-wallpaper-pairs-design.md); inherited requirements in [compositional profiles](../specs/2026-09-19-compositional-profiles-design.md), except its superseded global-wallpaper and scratch-survival rules.

**Task:** `prism-a3484e`, under `prism-aec90f`.

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

1. Selecting a profile without an active wallpaper and with scratch must expose only the before or after appearance at every write prefix; scratch and slots change atomically (Task 2).
2. Save As replacing a profile with an existing current-wallpaper pair must preserve the exact screen, destination pairs for other wallpapers, and the source look’s pairs, including after interruption (Task 2).
3. A queued Keep/Clear captured under Aurora/W must fail without writes after either the look or wallpaper changes, including switching between Default and a profile actually named `Default` (Tasks 2–3).
4. Interrupted migration must preserve the original pending scratch and active pair attribution, never replace the original backup with partial output, and finish from its fixed original inventory (Task 2).
5. Equal values, hidden CLI keys, malformed inactive pairs, and synchronous/deferred slider callbacks must not inflate the pending count, hide corruption from doctor, or cause a post-selection edit write (Tasks 2–3).

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

Before the first write, validate the incoming look/pair, outgoing scratch, outgoing pair merge, and entire intended resolution. Do not keep `changeSlots`’ catch-and-ignore behavior for an invalid outgoing fold. Discovery and doctor still diagnose broken files without mutating them.

| Operation | Ordered durable writes | Prefix and retry argument |
|---|---|---|
| Select profile/Default with wallpaper, including same-look selection | outgoing look file with merged pair; runtime with next slots and empty scratch; resolved bus | First write leaves old scratch on top of the same merged values. Runtime is the single visible switch. A retry before runtime merges identical values; after runtime scratch is empty and cannot reach the wrong look. |
| Wallpaper rotation/deactivation | outgoing look file with merged pair; runtime with next wallpaper and empty scratch; resolved bus | Same rule; deactivation has no incoming wallpaper. |
| Hook repeats same wallpaper | no writes | Preserve scratch; repeated compositor observations are not explicit look selection. |
| First wallpaper activation | runtime with incoming wallpaper and unchanged scratch; resolved bus | No outgoing pair exists; retain pending values and count. |
| Select profile/Default with no wallpaper | runtime with selected look and empty scratch; resolved bus | One atomic visible change, including selecting the same look. |
| Keep for wallpaper | current look file with merged pair; runtime with empty scratch | No screen change; retry after final store write may report nothing to commit. |
| Keep in look | current look file with merged settings and scratch keys removed from its active pair; runtime with empty scratch | Settings and pair pruning are one replacement. Other pairs stay unchanged. Default uses default-elision for its values, as today. |
| Save As to different profile | destination file containing full `store.params` and preserved other destination pairs, with current wallpaper’s pair removed; runtime selecting destination and empty scratch | Before runtime the source is untouched. After runtime the snapshot has no current pair to override it. No source-pair stripping. Retry before runtime rewrites the same snapshot; after runtime a named-current-profile call may refuse empty scratch. |
| Clear active pair | current look file without that pair; resolved bus | Single intended visible change, scratch remains. A completed retry may report untuned. |
| Delete active profile | runtime selecting Default (scratch preserved, matching existing delete semantics); unlink entire profile file; resolved bus | Default’s current pair loads; neither source settings nor pairs outlive the deleted profile. Retry can delete the now-inactive file. Explicit select and delete are distinct actions. |
| Rename active profile | hard-link complete old file to new name; runtime naming new profile with same scratch; unlink old name | Reuse the existing inode-checked algorithm; pairs travel in the file. No bus or sink change. |

Deletion of a wallpaper context means deleting that pair from the **current look**; if it is the active wallpaper retain existing delete behavior (clear the wallpaper slot, preserve scratch), then remove the pair from that same captured look. `context clear` retains the wallpaper slot. Rename is profile-only. Invalid next-state resolution prevents any deletion writes. State stays reserved.

The bus may remain stale if interrupted after the final store write, as today; `prism apply` repairs it. Do not expand this task into sink transaction recovery. Save As to the already selected name retains current merging-commit behavior; selecting that same look through the selector is a separate action and must clear pending edits by saving them to the pair.

### Explicit migration

Add `prism migrate pairs`; keep plain `prism migrate` for parameter replacements. The layout migration also moves old `scratch.yaml` into `_scratch`, preserving **all pending keys**, and explicitly drops retired `pinned`. It does not commit or normalize scratch, change active attribution, or run sinks.

Under the store lock:

1. Read and validate a complete source inventory: base, every profile, every old `contexts/wallpaper/*.yaml`, `active.json`, and `scratch.yaml`, including presence/absence of destinations. Refuse unknown malformed input before creating any backup or store write. Validate replacement-era keys using `migrateValues` plus `checkLayer` for the validation view; copy original key/value maps unchanged so plain `prism migrate` remains the explicit parameter conversion operation.
2. Plan copies of every global wallpaper map into Default and **every profile in this inventory**. Reject an existing conflicting pair instead of silently overwriting it; an identical pair is safe. Newly created profiles after completion start with no inherited pairs. If both `_scratch` and old `scratch.yaml` exist, accept only equal maps or an empty `_scratch`; otherwise refuse the ambiguity before writes.
3. Use the existing timestamp backup directory and byte-copy conventions, extended for `state/active.json`. Write a small manifest containing schema version `1`, config/state root identities, complete relative original-file inventory with absence markers, all intended output documents, and copied pair labels. Backup **all files being changed or removed**, including originals of profile/base destinations, old wallpaper files, runtime, and scratch. Write the complete manifest atomically only after all byte copies succeed.
4. Publish `state/pair-migration.json` atomically as `{ "backup": "<absolute backup directory>" }`. This pointer means migration is pending. No store file has changed before it. A crash during backup leaves original files intact; a new invocation may choose a new timestamp backup. Never use a partial backup or overwrite an existing backup directory.
5. Install the planned look documents, then the planned runtime; delete old global wallpaper files and old `scratch.yaml`; remove the pending pointer **last**. Resume from the same validated manifest whenever the pointer exists, even if some old files are already gone. Writes replay identical documents from the original inventory, not a fresh listing of partially migrated files. Validate the pointer, manifest version, roots, and relative paths before reading or replaying it. Permit only the inventoried look destinations and `state/active.json` as output locations, and validate every planned output document again before replay’s first write; a modified invalid manifest cannot install malformed runtime state.
6. Report the backup location, every `Default/<id>` and `<profile>/<id>` copy, scratch relocation, and precise manual restoration instructions. Restoration uses the manifest’s original inventory: copy backed-up present files to the proper config/state roots, remove outputs originally absent, and remove a pending pointer only after restoring files. It restores old layout, to be used with the old code or migrated again; no new restore command is required.

A one-time pending backup pointer is needed because migration has multiple destination files. It is **not** consulted as a normal-write journal and creates no runtime transaction framework.

Introduce `assertPairLayout()` in `migrate.js`: refuse normal store reads/writes while a pending pointer, old global wallpaper files, old `scratch.yaml`, or retired runtime `pinned` exists, with `run 'prism migrate pairs'`. Check it under the lock in every ordinary store entry path, including `unset --base`, which currently bypasses `loadStore`. Plain parameter migration also refuses until layout migration finishes. Discovery (`context list/show`) and doctor remain read-only diagnostic paths: report old files and pending migration explicitly, never resolve them as fallback pairs. A fresh empty store needs no migration and creates no version file. A completed `migrate pairs` on a clean layout is a no-op.

## File map

| File | Responsibility |
|---|---|
| `src/contexts.js` | Look/pair document IO, runtime record/projections, profile lifecycle, expected-slot parsing and checks; retain existing atomic YAML and inode-safe rename code |
| `src/values.js`, `src/scratch.js` | Existing public value/scratch APIs become projections over look/runtime documents; setters preserve other document contents |
| `src/layers.js` | Resolve exactly one look–wallpaper pair; unchanged public describe provenance |
| `src/context-cli.js` | Shared profile/wallpaper transition, pair-scoped list/show/clear/delete, existing fan-out |
| `src/commit.js` | Atomic look/pair commits and Save As screen invariance |
| `src/migrate.js`, `src/cli.js`, `src/paths.js` | Explicit layout migration, guards, all-pair parameter migration, diagnostics, runtime/backup paths |
| `integrations/noctalia-plugin/queue.luau`, `panel.luau`, `presentation.luau` | Captured slot guards, truthful optimistic selection/counts, pair labels; retain callback reconciliation |
| Existing Node/Lua tests plus `test/pairs.test.js`, `test/runtime.test.js`, `test/pair-migrate.test.js` | Storage, CLI behavior, interruption prefixes, queue and rendered lifecycle coverage |
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

### Task 2: Switch all store consumers to durable profile–wallpaper pairs

**Tracker:** `prism-d513ec`. **Complexity:** high. **Process:** direct. **Depends:** Task 1.

**Files:** Modify `src/{contexts,values,scratch,layers,context-cli,commit,migrate,cli,paths}.js`; create `test/pair-migrate.test.js`; modify `test/{contexts,values,scratch,layers,context-cli,commit,migrate,cli,write-order,lock-multiprocess}.test.js` and other existing fixtures that directly create old wallpaper/scratch files; modify `integrations/noctalia-plugin/{queue,panel}.luau`, `plugin_test.lua`, `contract.test.mjs`, and `test/plugin-client.test.js` for the guarded command transport. Update README’s storage/migration/CLI sections in this same deliverable.

**Interfaces:** Consumes Task 1’s document helpers. Produces pair-scoped `loadStore`, the transition behavior in the prefix table, preserved public `readActive/readValues/readScratch` APIs, `parseExpectedSlots/assertExpectedSlots`, and `prism migrate pairs`. `readContext('profile', name)` remains a settings projection; ordinary profile value writes preserve pairs, while lifecycle/Save As use explicit `writeLook`. Remove global wallpaper IO from ordinary `readContext/writeContext` paths; only the layout migrator reads old files. `listContexts().profile` stays a name list; pair discovery uses `listPairs()` rather than ambiguous `.wallpaper` names.

**Migration interfaces:**

```js
pairMigrationPath();                       // stateDir()/pair-migration.json, in paths.js
assertPairLayout();                        // throws a migration-required diagnostic
planPairMigration(defs);                   // null | fully validated { originals, outputs, copies }
runPairMigration(defs, { print, now });     // called with lock held; returns copy count
```

`originals` entries are `{root:'config'|'state', relative:string, present:boolean}`; `outputs` entries use the same root/relative identity plus final document text; `copies` entries are `{look:string|null,id:string}`. Store these exact forms in backup manifest version `1`; no absolute path from an entry is joined to a root. Validate nonempty relative paths and reject traversal/absolute paths. Manifest root identities must match the current invocation before replay. Parameter migration continues `planMigration/writeMigrated`, but plans one output per **physical** look/runtime file, preserving non-migrated maps and reporting each pair’s logical location.

- [ ] **Step 1: Add the behavioral regression before switching production readers.** Extend the current CLI test fixture with `writeLook` and this case (the existing `runCaptured` helper returns `{code,stderr}`):

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

Add same-look selection, Default selection, no-wallpaper discard, first wallpaper activation preserving scratch, duplicate hook preserving scratch, and profile-selection/wallpaper-rotation commutativity with empty scratch. Add malformed incoming/outgoing pair cases checking **all store bytes** unchanged, not only selected slots. Run `node --test test/context-cli.test.js` and confirm the new behavior fails under the old consumers.

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

- [ ] **Step 3: Implement one transition for profile selection and wallpaper changes.** Replace `wallpaperLeaving/planFold`’s wallpaper-only decision with explicit transition intent. Keep hook-repeat detection separate from explicit profile selection:

```js
const outgoing = active.wallpaper;
const selectLook = intent === 'select-profile';
const wallpaperChanged = active.wallpaper?.id !== next.wallpaper?.id;
const saveOutgoing = outgoing !== undefined && (selectLook || wallpaperChanged);
const scratchAfter = selectLook || saveOutgoing ? {} : scratch;
if (saveOutgoing && Object.keys(scratch).length) {
  const old = readPair(active.profile ?? null, outgoing.id);
  const merged = { source: old?.source ?? outgoing.path, values: { ...(old?.values ?? {}), ...scratch } };
  // Put merged into the outgoing Look in memory, validate both complete folds,
  // then write that Look followed by writeRuntime({active: next, scratch: scratchAfter}).
}
```

For same-look selection, compute incoming layers from the **planned merged look**, not a stale read of its pair. For all selections use the planned final runtime in resolution before writing. Only run fan-out when the resolved appearance changed; provenance-only changes still need persisted runtime/describe refresh. Preserve the existing apply recovery rule for a stale bus.

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

- [ ] **Step 5: Wire explicit slot guards and pair discovery.** Parse guard suffixes before existing positional arguments. Check the parsed expectation inside each mutation’s lock before reads leading to writes. Add a shared Lua `Queue.captureSlots(model)` returning `{look=<tagged token>, wallpaper=<tagged token>}`; append both flags from `item.expected` in `argvFor`. Capture on the rendered action, before `commitAction` optimistically changes `state.model.active`, and before replace confirmation queues Save As. Do not capture at process launch, where the model may already have changed.

```lua
local item = {verb = "commit", destination = "profile", target = name,
  expected = Queue.captureSlots(state.model)}
-- Existing optimistic handling follows capture.
```

For `context show wallpaper <id>` add optional `--look <look-token>`; default is the currently loaded look. `context list` enumerates all pairs as `wallpaper <look-token> <id> <source>` and marks only the exact active pair. `context show profile <name>` prints the whole look document, so exported profiles carry their pairs. Preserve raw-text diagnostics for malformed files; malformed one-look discovery must not hide the other looks. Explicit `context activate wallpaper <id>` requires a saved pair in the current look and uses its source; the hook remains the way to activate an untuned path.

Test guard mismatch with the same wallpaper/different look, same look/different wallpaper, Default versus a profile called `Default`, no wallpaper versus an id, and half-specified flags. Each mismatch must preserve all files. Verify every actual queue argv against the CLI parser in the existing contract harness. Keep direct CLI calls without preconditions usable.

- [ ] **Step 6: Build and test the explicit migration before enabling its guard.** Use the migration algorithm above, existing `writeBackup`, atomic JSON helpers, and a versioned backup manifest. Extend backup handling to `state/active.json`, preserving byte-for-byte originals and originally absent destinations. Add `migrate pairs` dispatch; it acquires the existing lock once. Plain `migrate` traverses Default and all named-look settings/pairs plus runtime scratch and writes each physical file once, so two changed maps in one profile never overwrite each other.

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

Cover zero old wallpaper files with scratch-only migration; multiple active/inactive profiles; preserved YAML backup comments; malformed inactive pair/global file; already-present conflicting pair; conflicting scratch sources; missing original base/runtime; `pinned`; missing or path-traversing pending manifest; clean repeat; and a replacement parameter in an inactive pair. Byte snapshots must show ordinary describe/get/list never repairs layout. Doctor must identify each bad pair with look and id and keep diagnosing remaining valid documents.

- [ ] **Step 7: Inject interruption at every write and check retry, not merely final values.** Extend `test/write-order.test.js`’s real filesystem monkeypatch harness (rename/link/rm/unlink) for every row in the prefix table. Include no-wallpaper selection, same-look selection, Default round-trips, Save As replacement, and active rename with nonempty pair maps. Check each prefix resolves to the exact old or new complete appearance, source/destination pair contents, and retry converges to clean-run store bytes. Completed refusals are allowed only after all store changes are already final.

For migration, additionally inject failure during backup copies and manifest/pointer publication. Before pending-pointer publication originals are untouched; afterward normal store operations fail explicitly until `migrate pairs` resumes. Retry must use the original backup and inventory, preserve original scratch bytes in the backup, and match clean-run outputs (ignore timestamp/backup-path differences when comparing). Simulate the final legacy-file deletion before pointer removal. Verify manual restore from the manifest reconstructs the original present/absent files exactly in a temporary store. Extend `lock-multiprocess` coverage to two competing selections/commits, checking no cross-look attribution.

- [ ] **Step 8: Finish the atomic consumer cutover and run full gates.** Replace old global-wallpaper test fixture writes with explicit look/pair setup except where testing migration. Replace assertions requiring scratch survival on profile selection with the approved zero-pending behavior. Keep first-activation, same-wallpaper-hook, typed-value validation, and slider-echo regression assertions intact. Update README’s actual storage, guards, discovery commands, explicit migration/restore instructions, and interruption table. Run focused tests, then `just test`, `just check`, `tasks check`; all Node, Lua, and contract tests must pass together.

- [ ] **Step 9: Close and commit this complete consumer change.** `tasks done prism-d513ec "Switched store, CLI, and guarded panel commands to durable look–wallpaper pairs with explicit resumable migration."`; rerun `tasks check`; commit `feat(profiles): persist wallpaper adjustments per look`. Do not split this task into a commit with old readers and new writers, or omit migrated test fixtures to achieve a green subset.

### Task 3: Show pair ownership and verify profile selection in the open panel

**Tracker:** `prism-0c82ac`. **Complexity:** mid. **Process:** direct. **Depends:** Task 2.

**Files:** Modify `integrations/noctalia-plugin/{panel,presentation}.luau`, `plugin_test.lua`, `contract.test.mjs`, `test/plugin-presentation.test.js`, `test/plugin-panel-lifecycle.test.js`, `README.md`, `docs/notes/noctalia-plugin-contract.md`; create `docs/notes/2026-09-20-profile-wallpaper-pairs-acceptance.md`.

**Interfaces:** Consumes unchanged describe `active/profile/held/fallback` fields and Task 2’s `Queue.captureSlots(model)` guarded transport. `Presentation.wallpaperHeader(model)` adds only `look` (display name) to existing `{id,name,tuned}`. The panel captures guarded actions with `Queue.captureSlots(model)`; presentation does not carry a second guard representation. No new describe protocol version, polling timer, shell observation, or model cache.

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

- [ ] **Step 2: Implement truthful optimistic selection and pair labels.** A user selection clears each parameter’s optimistic `edited` flag before render, since successful selection empties scratch. Do not rewrite `held` or pretend to know incoming saved values: the queued describe reconciles those. Failed activation’s follow-up describe restores the true count and existing error banner. Add one `state.selectionPending` boolean, set before queueing profile selection or Save As. Clear it only when `described()` accepts an authoritative, non-invalidated model; queue drain does not clear it. A failed command keeps it set until its reconciliation describe is accepted; a failed/invalidated describe keeps it set until a later accepted refresh. While it is set, disable and handler-guard Keep/Clear/Rename/Delete/Save As actions so optimistic `active.profile` cannot combine an incoming name with outgoing values. Profile selection itself remains available for rapid consecutive selections; preserve the existing queue and stale-and-replay mechanism. Existing captured closures must still carry their original expectation when tested after the store changes.

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

- [ ] **Step 3: Verify complete control semantics through existing harnesses.** Cover Keep in look and Keep for wallpaper with stale look and stale wallpaper; Clear preserves scratch and other pairs; failed Keep restores optimistic pending flags from describe; Neutral then Revert restores profile+pair without changing stored look bytes; Save As replaces the current destination pair while retaining another destination pair. Test the interval after the queue drains but before describe completes: selectionPending still disables pair actions. Failed and invalidated describes must not reopen them. Test two rapid selections and delayed periodic describe while the queue is busy: the existing stale-and-replay path runs once after drain and restores authoritative counts. No `context wallpaper` command may originate from panel events.

- [ ] **Step 4: Update the user contract and prepare desktop acceptance.** The contract note records exact guards, pair labels, zero edits after explicit selection, first-wallpaper exception, no-wallpaper discard, runtime scratch location, and same-look selection. Write the acceptance note with this runnable temporary-store preflight:

```sh
just test
just check
tasks check
```

Then give a desktop checklist matching all six amendment acceptance items, with spaces to record observed results: zero-count selection while open; Aurora/W versus Dark/W round-trip; independent rotation; Keep/Clear locality; Neutral/Revert; rename plus migration/backup evidence. Add Save As replacement, Default, and no-wallpaper cases. State that automated failure injection supplies interruption evidence and desktop work must not corrupt real files to simulate crashes. Record migration command/report/backup location when the existing acceptance task runs it; do not claim desktop acceptance now. Have `prism-439774` consume this note rather than create a second acceptance task.

- [ ] **Step 5: Run the full gate and commit the finished UI contract.** Run `node --test test/plugin-presentation.test.js test/plugin-panel-lifecycle.test.js integrations/noctalia-plugin/contract.test.mjs`, then `just test`, `just check`, `tasks check`. Close the step via `tasks done prism-0c82ac "Panel names the active look–wallpaper pair and verifies zero pending edits across selection and reconciliation."`; commit `feat(panel): show wallpaper adjustments for the selected look`.

## Native dropdown capability found during planning

Read-only inspection of the installed Noctalia source found `src/ui/controls/select.cpp` calls `setSelectedIndexInternal(index, true)` for a user option click, but suppresses a same-index callback unless `m_notifyOnReselect` is enabled (default false in `select.h`). `src/ui/ui_tree_reconciler.cpp` applies model `selectedIndex` via `setSelectedIndexSilently`, so model reconciliation itself does not notify. Its select property allowlist and setter code do **not** expose the existing `setNotifyOnReselect` capability to Lua.

Thus Prism can guarantee same-look selection through its CLI/shared transition, but this checkout alone cannot make the native dropdown emit a same-option activation. Changing Prism’s callback guard alone cannot provide that event. Keep this plan scoped to Prism: CLI same-look selection works, and the existing Keep for wallpaper action provides save-current-pair with zero pending edits in the panel. Exposing Noctalia’s existing boolean property can be requested as a separate follow-up at plan review; it is not a dependency of these tasks. Do not invent callback heuristics, add a new Prism control, or claim same-option desktop acceptance from the Lua mock. The desktop acceptance note must state this native event limitation.

## Handoff and completion

The plan requires written user review before Task 1. After implementation, dispatch the required whole-branch review through the preserved subagent-driven method, run `just gate`, and resolve its findings before live acceptance. Keep the branch unmerged until `prism-439774` records desktop results for the amendment. The controller owns existing parent task/spec status updates and any cross-project follow-up; children must not close or rewrite unrelated task records.
