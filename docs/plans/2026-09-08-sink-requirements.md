# Declared sink requirements and legible sink failures — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A sink states what it needs in its manifest, prism checks it before
running the sink and names the fix, and no sink failure is ever reported by
inspecting a Node error object.

**Architecture:** One new module, `src/sink.js`, holds the three primitives
the sinks and the fan-out share: `diagnose` (a child's own words out of an
error object), `sinkMain` (an apply script's top-level guard) and `onPath`.
`manifest.yaml` grows an optional `requires` list that `loadManifests`
validates; `fanOut` evaluates it before spawning `apply` and `doctor` reports
it directly. Each sink then declares what it needs.

**Tech Stack:** Node 20+, ESM, `node --test`, `yaml`. No new dependencies.

**Spec:** `docs/specs/2026-09-08-sink-requirements-design.md`

## Global Constraints

- Node `>=20`, ESM only (`package.json` sets `"type": "module"`). No new dependencies.
- Every child process prism spawns is bounded: `SINK_TIMEOUT = 5_000` ms with `killSignal: 'SIGKILL'`. Probes share the bound `apply` already has.
- A `probe: <name>` entry names the executable `<sink dir>/probe-<name>`.
- An unmet requirement is recorded as `ok: false` with the message in `entry.error`. No new sink status state.
- Prism-composed messages are one line. A child's diagnostic is passed through as written, newlines included.
- Comments explain why, not what, and match the density of the file they land in. No file gets a header comment it did not already have.
- Run `just check` before each commit; it runs `tasks check` and the pre-commit gate.
- Commit messages are conventional commits with no AI-attribution trailer.

---

### Task 1: `src/sink.js` and the three apply scripts

Closes `prism-2983d1`.

**Files:**
- Create: `src/sink.js`
- Create: `test/sink.test.js`
- Modify: `src/fanout.js:40` (record `diagnose(error)`, not `String(error)`)
- Modify: `integrations/niri/apply` (wrap in `sinkMain`, drop the bare `throw`)
- Modify: `integrations/debug-backdrop/apply` (wrap in `sinkMain`)
- Modify: `integrations/kitty/apply` (wrap in `sinkMain`)
- Modify: `test/niri-apply.test.js` (assert no Buffer dump reaches stderr)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `diagnose(error): string` — the child's stderr, else its stdout, else a spawn `ENOENT` message, else `error.message`, else `String(error)`. Never empty, never an inspected object.
  - `sinkMain(fn: () => void): void` — runs `fn`; on a throw writes `diagnose(error)` and a newline to stderr and exits 1.
  - `onPath(command: string): boolean` — true when `command` is an executable file in a `PATH` directory.

- [ ] **Step 1: Write the failing tests**

Create `test/sink.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { diagnose, onPath } from '../src/sink.js';

// What execFileSync hands back: the child's output as Buffers. Printing the
// error object renders these as Buffer(2383) [Uint8Array] [69, 114, ...] and
// buries the one part an operator can act on.
test('diagnose returns the child stderr a Buffer is hiding', () => {
  const error = new Error('Command failed: niri validate');
  error.stderr = Buffer.from('error: material "terminal-glass": bad value\n');
  error.stdout = Buffer.from('');

  assert.equal(diagnose(error), 'error: material "terminal-glass": bad value');
});

// niri rejects a config with a multi-line miette report. The body carries the
// property name and its position, so collapsing it would discard the answer.
test('diagnose preserves a multi-line diagnostic intact', () => {
  const report = [
    'Error:   × unexpected node `material`',
    '   ╭─[prism.kdl:2:1]',
    ' 2 │ material "terminal-glass" {',
    '   ╰────',
  ].join('\n');
  const error = new Error('Command failed');
  error.stderr = Buffer.from(`${report}\n`);

  assert.equal(diagnose(error), report);
});

test('diagnose falls back to stdout when stderr is empty', () => {
  const error = new Error('Command failed');
  error.stderr = Buffer.from('   \n');
  error.stdout = Buffer.from('qs: no running instances\n');

  assert.equal(diagnose(error), 'qs: no running instances');
});

test('diagnose names the command a failed spawn could not find', () => {
  const error = new Error('spawnSync qs ENOENT');
  error.code = 'ENOENT';
  error.syscall = 'spawnSync qs';
  error.path = 'qs';

  assert.equal(diagnose(error), 'qs is not installed');
});

// A missing file is not a missing command: only a spawn ENOENT means the
// command itself was not found.
test('diagnose leaves a filesystem ENOENT as its own message', () => {
  const error = new Error("ENOENT: no such file or directory, open '/nope'");
  error.code = 'ENOENT';
  error.syscall = 'open';
  error.path = '/nope';

  assert.equal(diagnose(error), "ENOENT: no such file or directory, open '/nope'");
});

test('diagnose falls back to the message, then to the error itself', () => {
  assert.equal(diagnose(new Error('plain failure')), 'plain failure');
  assert.equal(diagnose('not an error at all'), 'not an error at all');
});

test('onPath finds an executable and ignores a non-executable of the same name', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-path-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'runnable'), '#!/bin/sh\n', { mode: 0o755 });
  fs.writeFileSync(path.join(dir, 'inert'), 'not executable\n', { mode: 0o644 });

  const restore = process.env.PATH;
  process.env.PATH = dir;
  t.after(() => { process.env.PATH = restore; });

  assert.equal(onPath('runnable'), true);
  assert.equal(onPath('inert'), false);
  assert.equal(onPath('absent'), false);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/sink.test.js`
Expected: FAIL — `Cannot find module '../src/sink.js'`.

- [ ] **Step 3: Write `src/sink.js`**

```js
import fs from 'node:fs';
import path from 'node:path';

const text = (value) => (Buffer.isBuffer(value) ? value.toString('utf8') : value ?? '').trim();

// A child's own words, never Node's inspection of the error object. An
// execFileSync failure carries the child's output as Buffers, and printing the
// error renders them as Buffer(2383) [Uint8Array] [69, 114, ...] — which then
// becomes the parent's stderr, and its parent's, until doctor prints it.
// Multi-line output is passed through as written: niri's report names the
// rejected property in its body.
export function diagnose(error) {
  const stderr = text(error?.stderr);
  if (stderr) return stderr;
  const stdout = text(error?.stdout);
  if (stdout) return stdout;
  if (error?.code === 'ENOENT' && String(error.syscall).startsWith('spawn') && error.path) {
    return `${error.path} is not installed`;
  }
  return text(error?.message) || String(error);
}

// An apply script's top-level guard: a throw at any depth leaves as the
// diagnostic itself, and the exit code still fails the sink.
export function sinkMain(fn) {
  try {
    fn();
  } catch (error) {
    process.stderr.write(`${diagnose(error)}\n`);
    process.exit(1);
  }
}

export function onPath(command) {
  const dirs = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean);
  return dirs.some((dir) => {
    const candidate = path.join(dir, command);
    try {
      if (!fs.statSync(candidate).isFile()) return false;
      fs.accessSync(candidate, fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/sink.test.js`
Expected: PASS, 7 tests.

- [ ] **Step 5: Route the recorded fan-out failure through `diagnose`**

In `src/fanout.js`, add `import { diagnose } from './sink.js';` and replace
the one line in the `catch`:

```js
    } catch (error) {
      const text = diagnose(error);
      await record(manifest.sink, { ok: false, at, params, error: text });
      failed.push({ sink: manifest.sink, error: text });
    }
```

`String(error)` also prefixed every recorded status with
`Error: Command failed: /…/integrations/niri/apply /…/resolved.json glass.roughness …`
— prism restating its own invocation to an operator who did not type it.

- [ ] **Step 6: Wrap the niri apply script**

In `integrations/niri/apply`, import `sinkMain` from `../../src/sink.js` and
move the whole body into `sinkMain(() => { … })`. The bare `throw error` after
the rollback stays a `throw` — it is now caught by `sinkMain`, which prints
niri's report and exits 1. Keep both existing comments (the one explaining why
validation happens after the rename, and the one explaining the deliberately
unwrapped reload) exactly where they are.

- [ ] **Step 7: Wrap the other two apply scripts**

Same change in `integrations/debug-backdrop/apply` and
`integrations/kitty/apply`: import `sinkMain`, move the body into it. No other
behaviour changes — in particular `applyToKittySockets` keeps throwing when it
finds no sockets (`integrations/kitty/live.js:38`), which
`test/kitty-sink.test.js:57` requires.

- [ ] **Step 8: Pin the absence of the dump**

In `test/niri-apply.test.js`, extend the two tests that already assert the
diagnostic survives — `an invalid composed config restores the previous target
exactly` and `the recorded sink failure names the value niri rejected` — with
the assertion that nothing else does:

```js
  assert.doesNotMatch(result.stderr, /Buffer\(|Uint8Array/,
    'the error object must never be inspected onto stderr');
```

and, in the recorded-status test:

```js
  assert.doesNotMatch(status.niri.error, /Buffer\(|Uint8Array/);
  assert.doesNotMatch(status.niri.error, /Command failed:/,
    'the recorded status is the diagnostic, not prism restating its own invocation');
```

- [ ] **Step 9: Run the full suite**

Run: `just test`
Expected: PASS. The count rises by 7 from the current 212.

- [ ] **Step 10: Close the task and commit**

```bash
tasks done prism-2983d1 "apply scripts and fan-out report the child's diagnostic; no error object is ever inspected"
just check
git add src/sink.js test/sink.test.js src/fanout.js integrations/*/apply test/niri-apply.test.js tasks/
git commit -m "fix(sinks): report a child's diagnostic instead of inspecting its error"
```

---

### Task 2: Declared requirements, checked before apply

Closes `prism-bba7ec`.

**Files:**
- Modify: `src/manifest.js` (validate and carry `requires`)
- Modify: `src/fanout.js` (evaluate requirements before spawning `apply`)
- Modify: `src/cli.js:281-290` (`doctor` reports an unmet requirement)
- Modify: `integrations/debug-backdrop/manifest.yaml` (declare `qs`)
- Modify: `integrations/debug-backdrop/apply` (nothing to stop when absent and off)
- Modify: `test/manifest.test.js`, `test/fanout.test.js`, `test/debug-backdrop-sink.test.js`, `test/cli.test.js`

**Interfaces:**
- Consumes: `diagnose`, `onPath` from `src/sink.js` (Task 1).
- Produces:
  - `loadManifests` results carry `requires: Array<{command?, probe?, when?, fix}>`, `[]` when the key is absent.
  - `SINK_TIMEOUT: number` exported from `src/fanout.js` (5000).
  - `unmetRequirement(manifest, resolved, {timeout?}): string | null` exported from `src/fanout.js` — the one-line message for the first unmet requirement, or `null`. `timeout` defaults to `SINK_TIMEOUT` and exists so a test can prove the bound without waiting for it.

- [ ] **Step 1: Write the failing manifest tests**

In `test/manifest.test.js`, the shared `defs` map needs a bool param. Replace
the existing line with:

```js
const defs = new Map([
  ['a.x', { key: 'a.x' }],
  ['a.on', { key: 'a.on', type: 'bool' }],
]);
```

Then add:

```js
function loadRequires(body) {
  const root = integ({
    'alpha/manifest.yaml': `sink: alpha\nbinds:\n  - {param: a.x, liveness: live}\nrequires:\n${body}`,
    'alpha/probe-present': '#!/bin/sh\nexit 0\n',
  });
  fs.chmodSync(path.join(root, 'alpha', 'probe-present'), 0o755);
  return () => loadManifests(root, defs);
}

test('absent requires defaults to empty', () => {
  const root = integ({ 'alpha/manifest.yaml': 'sink: alpha\nbinds:\n  - {param: a.x, liveness: live}\n' });
  assert.deepEqual(loadManifests(root, defs)[0].requires, []);
});

test('a command requirement is parsed with its fix and optional when', () => {
  const load = loadRequires('  - {command: qs, when: a.on, fix: install quickshell}\n');
  assert.deepEqual(load()[0].requires, [{ command: 'qs', when: 'a.on', fix: 'install quickshell' }]);
});

test('a probe requirement names an executable beside apply', () => {
  const load = loadRequires('  - {probe: present, fix: install it}\n');
  assert.deepEqual(load()[0].requires, [{ probe: 'present', fix: 'install it' }]);
});

test('a requirement needs exactly one of command and probe', () => {
  assert.throws(loadRequires('  - {fix: do something}\n'), /exactly one of command or probe/);
  assert.throws(loadRequires('  - {command: qs, probe: present, fix: x}\n'), /exactly one of command or probe/);
});

test('a requirement needs a fix', () => {
  assert.throws(loadRequires('  - {command: qs}\n'), /needs a fix/);
  assert.throws(loadRequires('  - {command: qs, fix: "  "}\n'), /needs a fix/);
});

test('a probe that is not an executable beside apply is a manifest error', () => {
  assert.throws(loadRequires('  - {probe: absent, fix: x}\n'), /probe absent/);
});

// A when that names nothing, or names a param prism cannot read as a switch,
// would silently never fire. Both are manifest errors.
test('when must name a defined bool param', () => {
  assert.throws(loadRequires('  - {command: qs, when: a.nope, fix: x}\n'), /undefined param a\.nope/);
  assert.throws(loadRequires('  - {command: qs, when: a.x, fix: x}\n'), /a\.x must be type bool/);
});
```

- [ ] **Step 2: Run the manifest tests to verify they fail**

Run: `node --test test/manifest.test.js`
Expected: FAIL — `requires` is not parsed, so the deep-equal and `assert.throws` cases both miss.

- [ ] **Step 3: Validate and carry `requires` in `src/manifest.js`**

Inside the per-entry loop, after the `generates` block and before `manifests.push`:

```js
    const requires = m.requires ?? [];
    if (!Array.isArray(requires)) throw new Error(`${file}: requires must be a list`);
    for (const r of requires) {
      const forms = ['command', 'probe'].filter((key) => r?.[key] !== undefined);
      if (forms.length !== 1) {
        throw new Error(`${file}: each requires entry needs exactly one of command or probe`);
      }
      const [form] = forms;
      if (typeof r[form] !== 'string' || r[form] === '') {
        throw new Error(`${file}: bad ${form} ${JSON.stringify(r[form])}`);
      }
      if (typeof r.fix !== 'string' || r.fix.trim() === '') {
        throw new Error(`${file}: requires ${r[form]} needs a fix`);
      }
      if (form === 'probe') {
        const probe = path.join(dir, entry.name, `probe-${r.probe}`);
        try {
          fs.accessSync(probe, fs.constants.X_OK);
        } catch {
          throw new Error(`${file}: probe ${r.probe} is not an executable at ${probe}`);
        }
      }
      if (r.when !== undefined) {
        const def = defs.get(r.when);
        if (!def) throw new Error(`${file}: when names undefined param ${r.when}`);
        if (def.type !== 'bool') throw new Error(`${file}: when param ${r.when} must be type bool`);
      }
    }
```

and add `requires` to the pushed object:

```js
    manifests.push({ sink: m.sink, dir: path.join(dir, entry.name), binds: m.binds, generates, requires });
```

- [ ] **Step 4: Run the manifest tests to verify they pass**

Run: `node --test test/manifest.test.js`
Expected: PASS.

- [ ] **Step 5: Write the failing fan-out tests**

Add to `test/fanout.test.js`:

```js
const { unmetRequirement, SINK_TIMEOUT } = await import('../src/fanout.js');

function sinkDir(t, files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-sink-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const [name, body] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), body, { mode: 0o755 });
  }
  return dir;
}

test('a command requirement whose when param is false is not checked', (t) => {
  const manifest = {
    sink: 'alpha',
    dir: sinkDir(t, {}),
    binds: [],
    generates: [],
    requires: [{ command: 'definitely-not-installed', when: 'a.on', fix: 'install it' }],
  };

  assert.equal(unmetRequirement(manifest, { params: { 'a.on': false } }), null);
  assert.match(
    unmetRequirement(manifest, { params: { 'a.on': true } }),
    /definitely-not-installed is not installed — install it/,
  );
});

// The probe owns what is actually installed; the manifest owns what to do.
test('an unmet probe requirement joins the probe stderr to the manifest fix', (t) => {
  const manifest = {
    sink: 'alpha',
    dir: sinkDir(t, { 'probe-thing': '#!/bin/sh\necho "no thing here (installed: 1.0)" >&2\nexit 1\n' }),
    binds: [],
    generates: [],
    requires: [{ probe: 'thing', fix: 'install thing' }],
  };

  assert.equal(
    unmetRequirement(manifest, { params: {} }),
    'no thing here (installed: 1.0) — install thing',
  );
});

test('a satisfied probe requirement reports nothing', (t) => {
  const manifest = {
    sink: 'alpha',
    dir: sinkDir(t, { 'probe-thing': '#!/bin/sh\nexit 0\n' }),
    binds: [],
    generates: [],
    requires: [{ probe: 'thing', fix: 'install thing' }],
  };

  assert.equal(unmetRequirement(manifest, { params: {} }), null);
});

// A probe that cannot answer has not established that the requirement is met,
// and an unbounded one would hang the fan-out, every later sink, and doctor.
test('a hung probe is killed at the bound and reported as unmet', (t) => {
  const manifest = {
    sink: 'alpha',
    dir: sinkDir(t, { 'probe-slow': '#!/bin/sh\nsleep 30\n' }),
    binds: [],
    generates: [],
    requires: [{ probe: 'slow', fix: 'install thing' }],
  };

  const started = Date.now();
  const unmet = unmetRequirement(manifest, { params: {} }, { timeout: 200 });

  assert.match(unmet, /probe slow did not finish within 0\.2s — install thing/);
  assert.ok(Date.now() - started < 5_000, 'the probe must not have run to completion');
});

test('an unmet requirement fails only its own sink and never spawns apply', async (t) => {
  freshState();
  const spawned = [];
  const blocked = {
    sink: 'blocked',
    dir: sinkDir(t, {}),
    binds: [{ param: 'a.on', liveness: 'live' }],
    generates: [],
    requires: [{ command: 'definitely-not-installed', fix: 'install it' }],
  };
  const later = {
    sink: 'later', dir: sinkDir(t, {}), binds: [{ param: 'a.on', liveness: 'live' }],
    generates: [], requires: [],
  };

  const { applied, failed } = await fanOut({
    manifests: [blocked, later],
    resolved: { params: { 'a.on': true } },
    changedKeys: ['a.on'],
    runner: (manifest) => { spawned.push(manifest.sink); },
  });

  assert.deepEqual(spawned, ['later'], 'the blocked sink must not be spawned');
  assert.deepEqual(applied, ['later'], 'a blocked sink must not stop a later one');
  assert.equal(failed.length, 1);
  assert.match(failed[0].error, /definitely-not-installed is not installed — install it/);

  const status = JSON.parse(fs.readFileSync(sinkStatusPath(), 'utf8'));
  assert.equal(status.blocked.ok, false);
  assert.match(status.blocked.error, /install it/);
});

test('SINK_TIMEOUT is the bound both apply and probes run under', () => {
  assert.equal(SINK_TIMEOUT, 5_000);
});
```

- [ ] **Step 6: Run the fan-out tests to verify they fail**

Run: `node --test test/fanout.test.js`
Expected: FAIL — `unmetRequirement` is not exported.

- [ ] **Step 7: Implement the check in `src/fanout.js`**

Add the imports and the constant at the top:

```js
import { diagnose, onPath } from './sink.js';

export const SINK_TIMEOUT = 5_000;
```

Change `runApply`'s default to the constant:

```js
export function runApply(manifest, resolvedFile, keys, timeout = SINK_TIMEOUT) {
```

Add the evaluator:

```js
// A probe is a child like any other and gets the bound apply already has: an
// unbounded one would hang the fan-out, every sink behind it, and doctor. A
// probe killed at the bound has not established that the requirement is met,
// so silence counts as unmet rather than as satisfaction.
function probeProblem(file, name, timeout) {
  try {
    execFileSync(file, [], { stdio: 'pipe', timeout, killSignal: 'SIGKILL' });
    return null;
  } catch (error) {
    if (error?.killed) return `probe ${name} did not finish within ${timeout / 1000}s`;
    return diagnose(error);
  }
}

// A requirement whose `when` param is false is not checked: the sink still
// runs, it simply does not need the thing. The probe or prism states the
// problem, the manifest states the fix.
export function unmetRequirement(manifest, resolved, { timeout = SINK_TIMEOUT } = {}) {
  for (const requirement of manifest.requires ?? []) {
    if (requirement.when !== undefined && resolved.params[requirement.when] !== true) continue;
    const problem = requirement.command !== undefined
      ? (onPath(requirement.command) ? null : `${requirement.command} is not installed`)
      : probeProblem(path.join(manifest.dir, `probe-${requirement.probe}`), requirement.probe, timeout);
    if (problem) return `${problem} — ${requirement.fix}`;
  }
  return null;
}
```

In `fanOut`, check before the `try`:

```js
  for (const manifest of selectSinks(manifests, changedKeys)) {
    const at = new Date().toISOString();
    const params = boundParams(manifest, resolved);
    const unmet = unmetRequirement(manifest, resolved);
    if (unmet) {
      await record(manifest.sink, { ok: false, at, params, error: unmet });
      failed.push({ sink: manifest.sink, error: unmet });
      continue;
    }
    try {
```

- [ ] **Step 8: Run the fan-out tests to verify they pass**

Run: `node --test test/fanout.test.js`
Expected: PASS.

- [ ] **Step 9: Write the failing doctor test**

In `test/cli.test.js`, follow the file's existing fixture style for a
`doctor` run and add:

`integrationsDir()` reads `PRISM_INTEGRATIONS_DIR` on every call
(`src/paths.js:24`), so this test points it at its own directory rather than
adding a fourth sink to the module-level fixture, where a requirement would
leak into every other `doctor` assertion.

```js
// doctor exists so a machine learns what it is missing without first
// provoking a failed apply.
test('doctor reports an unmet requirement, and says nothing when its when is false', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-req-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'reqsink'));
  fs.writeFileSync(path.join(dir, 'reqsink', 'manifest.yaml'), [
    'sink: reqsink',
    'requires:',
    '  - {command: definitely-not-installed, when: debug.backdrop, fix: install it}',
    'binds:',
    '  - {param: debug.backdrop, liveness: live}',
    '',
  ].join('\n'));

  const restore = process.env.PRISM_INTEGRATIONS_DIR;
  process.env.PRISM_INTEGRATIONS_DIR = dir;
  t.after(() => { process.env.PRISM_INTEGRATIONS_DIR = restore; });

  const doctorOutput = async () => {
    let out = '';
    await cli.run(['doctor'], { runner: () => {}, print: (text) => { out += text; } });
    return out;
  };

  // debug.backdrop defaults to false, so the requirement does not apply.
  assert.doesNotMatch(await doctorOutput(), /definitely-not-installed/);

  await cli.run(['set', 'debug.backdrop', 'true'], { runner: () => {} });
  assert.match(await doctorOutput(),
    /doctor: reqsink: definitely-not-installed is not installed — install it/);
});
```

- [ ] **Step 10: Report unmet requirements in `doctor`**

In `src/cli.js`, import `unmetRequirement` alongside `fanOut, boundParams`,
and in the status loop (`src/cli.js:281`) report the requirement first, so a
machine is told what it is missing rather than that a sink failed:

```js
        for (const manifest of manifests) {
          const unmet = unmetRequirement(manifest, { params });
          if (unmet) {
            print(`doctor: ${manifest.sink}: ${unmet}\n`);
            problems++;
            continue;
          }
          const entry = status[manifest.sink];
```

- [ ] **Step 11: Run the cli tests to verify they pass**

Run: `node --test test/cli.test.js`
Expected: PASS.

- [ ] **Step 12: Declare quickshell, and skip cleanly when it is absent**

`integrations/debug-backdrop/manifest.yaml`:

```yaml
sink: debug-backdrop
generates: []
requires:
  - command: qs
    when: debug.backdrop
    fix: "install quickshell (extra/quickshell); it comes from extra, not from Noctalia"
binds:
  - {param: debug.backdrop, liveness: live}
```

In `integrations/debug-backdrop/apply`, after `enabled` is read:

```js
// The manifest declares qs, but only checks it when the backdrop is on. With
// the backdrop off and quickshell absent there is nothing to stop: no instance
// of this shell can be running if qs was never installed.
if (!enabled && !onPath('qs')) return;
```

- [ ] **Step 13: Write and run the debug-backdrop test**

In `test/debug-backdrop-sink.test.js`, following its existing fixture style,
add a case that runs the apply script with `debug.backdrop: false` and a `PATH`
holding no `qs`:

```js
test('the backdrop off with quickshell absent is a clean skip', (t) => {
  const result = runApply(t, { 'debug.backdrop': false }, { PATH: emptyBinDir(t) });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr.trim(), '');
});
```

Run: `node --test test/debug-backdrop-sink.test.js`
Expected: PASS.

- [ ] **Step 14: Run the full suite**

Run: `just test`
Expected: PASS.

- [ ] **Step 15: Close the task and commit**

```bash
tasks done prism-bba7ec "sinks declare prerequisites in the manifest; debug-backdrop declares qs and skips cleanly when the backdrop is off"
just check
git add src/manifest.js src/fanout.js src/cli.js integrations/debug-backdrop/ test/ tasks/
git commit -m "feat(sinks): declare sink prerequisites and check them before apply"
```

---

### Task 3: The niri sink's niri-material requirement

Closes `prism-d836de`.

**Files:**
- Create: `integrations/niri/probe-material` (executable, mode 0755)
- Modify: `integrations/niri/manifest.yaml` (declare the probe)
- Modify: `integrations/niri/render.js` (glass off emits no `material` node)
- Modify: `test/niri-render.test.js`, `test/niri-apply.test.js`

**Interfaces:**
- Consumes: the `requires`/`probe` machinery from Task 2; `SINK_TIMEOUT` bounds the probe.
- Produces: nothing later tasks rely on.

- [ ] **Step 1: Write the failing render test**

In `test/niri-render.test.js`, following its existing fixture style:

```js
// A niri without niri-material rejects the whole config over a material node
// it does not know, so glass off must leave none behind. The sink still owns
// gaps, the terminal window rules and the inert background effect — all of it
// upstream vocabulary, which a stock niri parses.
test('glass off emits no material node at all', () => {
  const fragment = renderNiriFragment({ params: { ...PARAMS, 'glass.enabled': false } });

  assert.doesNotMatch(fragment, /material /);
  assert.match(fragment, /gaps 54/);
  assert.match(fragment, /background-effect \{/);
  assert.match(fragment, /blur false/);
});

test('glass on still emits the material definition and its assignment', () => {
  const fragment = renderNiriFragment({ params: { ...PARAMS, 'glass.enabled': true } });

  assert.match(fragment, /material "terminal-glass" \{/);
  assert.match(fragment, /    material "terminal-glass"/);
});
```

- [ ] **Step 2: Run the render test to verify it fails**

Run: `node --test test/niri-render.test.js`
Expected: FAIL — the definitions are emitted unconditionally today; `glass.enabled` controls only the window rule's assignment.

- [ ] **Step 3: Make glass off an escape hatch in `render.js`**

Replace the body of `renderNiriFragment`:

```js
export function renderNiriFragment(resolved) {
  const params = resolved.params;
  const matcher = appMatcher(params['terminal.apps']);
  const glass = params['glass.enabled'];
  const split = glass && params['glass.focusSplit'];
  return [
    '// generated by prism — do not edit',
    layoutBlock(params),
    // Glass off leaves no material node behind: the node is niri-material's
    // own, and a niri without it rejects the whole config over one it does not
    // know. Everything that remains is upstream vocabulary.
    ...(glass ? [definition(MATERIAL, params, activeGlass(params))] : []),
    ...(split ? [definition(INACTIVE_MATERIAL, params, inactiveGlass(params))] : []),
    ...(matcher === null ? []
      : split ? [
        assignmentRule(matcher, MATERIAL, true),
        assignmentRule(matcher, INACTIVE_MATERIAL, false),
      ]
      : [assignmentRule(matcher, glass ? MATERIAL : null)]),
    '',
  ].join('\n');
}
```

- [ ] **Step 4: Run the render test to verify it passes**

Run: `node --test test/niri-render.test.js`
Expected: PASS.

- [ ] **Step 5: Write the probe**

Create `integrations/niri/probe-material`, mode 0755:

```js
#!/usr/bin/env node
// Stock niri answers a config containing a material node with a screenful of
// KDL parse errors that name a syntax position and never the cause. Ask it
// about a minimal material block on its own, so the answer is one yes or no.
// niri --version prints upstream's version with a build commit, so there is no
// niri-material version to compare a minimum against: this states a capability.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const PROBE = 'material "prism-probe" {\n    glass {\n        ior 1.5\n    }\n}\n';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-probe-material-'));
const file = path.join(dir, 'probe.kdl');

let failure = null;
try {
  fs.writeFileSync(file, PROBE);
  execFileSync('niri', ['validate', '-c', file], { stdio: 'pipe' });
} catch (error) {
  failure = error?.code === 'ENOENT'
    ? 'niri is not installed'
    : `this niri does not accept the material node (${installed()})`;
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}

// process.exit skips finally, so the temp dir is gone before this runs.
if (failure !== null) {
  process.stderr.write(`${failure}\n`);
  process.exit(1);
}

function installed() {
  try {
    return `installed: ${execFileSync('niri', ['--version'], { encoding: 'utf8' }).trim()}`;
  } catch {
    return 'its version could not be read';
  }
}
```

- [ ] **Step 6: Declare the requirement**

At the top of `integrations/niri/manifest.yaml`, above `binds`:

```yaml
sink: niri
generates: [prism.kdl]
requires:
  - probe: material
    when: glass.enabled
    fix: "install niri-material; stock niri does not know the material node"
```

- [ ] **Step 7: Write the failing probe test**

In `test/niri-apply.test.js`, reusing the fake-niri `fixture` already in the
file (extend the fake so `validate` honours `NIRI_FAKE_VALIDATE_FAILS`, which
it already does, and add a `--version` branch printing `niri 26.04 (fake)`):

```js
// The probe's whole job is to replace a screenful of KDL parse errors with a
// statement of the cause.
test('probe-material names niri-material and what is installed', (t) => {
  const { dir } = fixture(t);
  const probe = fileURLToPath(new URL('../integrations/niri/probe-material', import.meta.url));

  const result = spawnSync(probe, [], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${path.join(dir, 'bin')}:${process.env.PATH}`,
           NIRI_FAKE_LOG: path.join(dir, 'niri.log'),
           NIRI_FAKE_DIAGNOSTIC: 'unexpected node `material`',
           NIRI_FAKE_VALIDATE_FAILS: '1' },
  });

  assert.equal(result.status, 1);
  assert.equal(result.stderr.trim(),
    'this niri does not accept the material node (installed: niri 26.04 (fake))');
  assert.doesNotMatch(result.stderr, /Buffer\(|Uint8Array/);
});

test('probe-material succeeds against a niri that accepts the node', (t) => {
  const { dir } = fixture(t);
  const probe = fileURLToPath(new URL('../integrations/niri/probe-material', import.meta.url));

  const result = spawnSync(probe, [], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${path.join(dir, 'bin')}:${process.env.PATH}`,
           NIRI_FAKE_LOG: path.join(dir, 'niri.log') },
  });

  assert.equal(result.status, 0, result.stderr);
});
```

Extend the fake niri in `fixture` with a `--version` branch, before its
catch-all `echo "$*"` line:

```sh
if [ "$1" = "--version" ]; then
  echo "niri 26.04 (fake)"
  exit 0
fi
```

- [ ] **Step 8: Run the probe test to verify it passes**

Run: `node --test test/niri-apply.test.js`
Expected: PASS. If it fails on the executable bit, `chmod 755 integrations/niri/probe-material` and confirm `git ls-files -s` records mode `100755`.

- [ ] **Step 9: Run the full suite**

Run: `just test`
Expected: PASS.

- [ ] **Step 10: Verify the escape hatch against the real niri**

```bash
node -e "
  import('./integrations/niri/render.js').then(async (m) => {
    const { loadDefs } = await import('./src/defs.js');
    const defs = loadDefs('./defs');
    const params = Object.fromEntries([...defs].map(([k, d]) => [k, d.default]));
    require('node:fs').writeFileSync('/tmp/prism-glass-off.kdl',
      m.renderNiriFragment({ params: { ...params, 'glass.enabled': false } }));
  });
"
niri validate -c /tmp/prism-glass-off.kdl
```

Expected: `config is valid`. This machine runs niri-material, so it proves the
fragment parses but not that it avoids niri-material vocabulary — the render
test's `doesNotMatch(/material /)` is what proves that. Record the result in a
task note.

- [ ] **Step 11: Close the task and commit**

```bash
tasks done prism-d836de "the niri sink probes for the material node and states the requirement; glass off emits none"
just check
git add integrations/niri/ test/ tasks/
git commit -m "feat(niri): probe for the material node and let glass off emit none"
```

---

### Task 4: File the follow-ups

**Files:**
- Modify: `tasks/` (via the `tasks` CLI only)

**Interfaces:**
- Consumes: the landed behaviour from Tasks 1-3.
- Produces: nothing.

- [ ] **Step 1: File the dotfiles preflight task**

```bash
tasks add "setup_preflight reads prism's declared sink requirements" \
  --project dots -p 2 --size s --tag prism --tag setup \
  -b "setup.sh hardcodes 'quickshell (qs) — the debug-backdrop sink needs it' and a niri-accepts-the-generated-config check, restating knowledge the sink now declares in its manifest (prism docs/specs/2026-09-08-sink-requirements-design.md). Replace both with a call that reads prism's declaration, behind the node_modules check already above them — preflight runs on machines where npm ci has never run. Outcome: one statement of each prerequisite, in the sink that needs it."
```

- [ ] **Step 2: Note the boundary on the niri-material side**

```bash
tasks note material-09d8c0 "prism's probe-material covers a niri that does not know the material node at all; a niri-material build too old for a property prism emits (the type= on noise) stays this task's case"
```

- [ ] **Step 3: Verify and commit**

```bash
tasks check
git add tasks/
git commit -m "chore(tasks): file the preflight follow-up and record the probe's boundary"
```

---

## Verification

Before the branch is finished:

```bash
just gate
```

Expected: the full suite passes and `tasks check` reports zero errors. Confirm
`prism-2983d1`, `prism-bba7ec` and `prism-d836de` are all `done` and that
`docs/specs/2026-09-08-sink-requirements-design.md` still describes what
landed — correct its status header in the merge commit if anything diverged.
