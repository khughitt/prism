# Task 7 report: sink manifests

## Implementation

- Added `loadManifests(dir, defs)` to load one `manifest.yaml` from each sorted integration subdirectory and skip manifest-less directories.
- Added binding validation against the supplied definitions map and the exported `LIVENESS` values (`live`, `reload`, `restart`).
- Added optional `generates` parsing with an empty-list default and strict list-of-strings validation.

## Files

- `src/manifest.js`
- `test/manifest.test.js`

## TDD evidence

### RED

Command:

```sh
node --test test/manifest.test.js
```

Exact relevant output:

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '<checkout>/.worktrees/prism-v1/src/manifest.js' imported from <checkout>/.worktrees/prism-v1/test/manifest.test.js
✖ test/manifest.test.js (51.490709ms)
ℹ tests 1
ℹ pass 0
ℹ fail 1
```

### GREEN

Focused command:

```sh
node --test test/manifest.test.js
```

Exact output summary:

```text
ℹ tests 4
ℹ pass 4
ℹ fail 0
```

Full-suite command:

```sh
npm test
```

Exact output summary:

```text
ℹ tests 46
ℹ pass 46
ℹ fail 0
```

Additional check:

```sh
git diff --check
```

Passed with no whitespace errors.

## Self-review

- Confirmed missing integration roots return an empty list and manifest-less subdirectories are skipped.
- Confirmed output includes only the sink name, integration directory, bindings, and generated names; no config-path or sink-specific knowledge was added.
- Confirmed directory traversal is deterministic and the existing `yaml` dependency is reused.
- Confirmed tests use temporary directories and no HOME-dependent setup was added.
- Confirmed no plan/spec files were modified.

## Concerns

None for the specified manifest schema.
