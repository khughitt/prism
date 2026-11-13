import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parse } from 'yaml';

const root = fileURLToPath(new URL('../', import.meta.url));

function executable(name) {
  const found = process.env.PATH.split(path.delimiter)
    .map((dir) => path.join(dir, name)).find((p) => {
      try { fs.accessSync(p, fs.constants.X_OK); return true; } catch { return false; }
    });
  assert.ok(found, `${name} is required for test-policy checks`);
  return fs.realpathSync(found);
}

function fixture(t, { policy = false, refs = 'refs/heads/*' } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-policy-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const repo = path.join(dir, 'repo'), home = path.join(dir, 'home'), bin = path.join(dir, 'bin');
  for (const p of [repo, home, bin]) fs.mkdirSync(p);
  for (const name of ['python3', 'sh', 'git', 'just', 'cat', 'awk']) {
    fs.symlinkSync(executable(name), path.join(bin, name));
  }
  const markers = path.join(dir, 'markers.jsonl'), log = path.join(dir, 'tt.jsonl');
  const env = ({ force = false, hosted = false, hygieneExit = 0, suiteExit = 0, keepalive = 60 } = {}) => {
    const result = {
      PATH: bin, HOME: home, USER: 'fixture',
      XDG_CONFIG_HOME: path.join(home, 'config'), XDG_STATE_HOME: path.join(home, 'state'),
      GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1',
      TT_LOG: log, PROBE_MARKERS: markers,
      PROBE_HYGIENE_EXIT: String(hygieneExit), PROBE_SUITE_EXIT: String(suiteExit),
      PROBE_KEEPALIVE: String(keepalive),
    };
    if (force) result.TT_FORCE = '1';
    if (hosted) result.GITHUB_ACTIONS = 'true';
    return result;
  };
  const run = (args, options = {}) => spawnSync('just', args, {
    cwd: repo, env: env(options), encoding: 'utf8', input: '', timeout: 15_000,
  });
  const git = (args) => {
    const r = spawnSync('git', args, { cwd: repo, env: env(), encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  };
  git(['init', '-q']);
  assert.equal(git(['rev-parse', '--show-toplevel']), fs.realpathSync(repo));
  assert.ok(git(['rev-parse', '--absolute-git-dir']).startsWith(`${fs.realpathSync(repo)}/`));
  for (const p of ['tools', '.githooks']) fs.mkdirSync(path.join(repo, p));
  fs.copyFileSync(path.join(root, 'tools/tt'), path.join(repo, 'tools/tt'));
  fs.copyFileSync(path.join(root, '.githooks/pre-push'), path.join(repo, '.githooks/pre-push'));
  let justfile = fs.readFileSync(path.join(root, 'justfile'), 'utf8');
  for (const [key, value] of Object.entries({
    fast_cmd: 'probe suite', test_cmd: 'probe suite', check_cmd: 'probe hygiene',
    one_cmd: 'probe focused', ci_suite_refs: refs,
  })) {
    const pattern = new RegExp(`^${key} := .*`, 'gm');
    assert.equal([...justfile.matchAll(pattern)].length, 1, `one assignment for ${key}`);
    justfile = justfile.replace(pattern, `${key} := ${JSON.stringify(value)}`);
  }
  fs.writeFileSync(path.join(repo, 'justfile'), justfile);
  if (policy !== null) fs.writeFileSync(path.join(repo, '.tt.toml'),
    `automatic_broad = ${policy}\nbroad_targets = ["test", "test-fast"]\n`);
  fs.writeFileSync(path.join(bin, 'probe'), `#!/usr/bin/env python3
import json, os, sys
role = sys.argv[1]
with open(os.environ['PROBE_MARKERS'], 'a') as f:
    f.write(json.dumps({'role': role, 'args': sys.argv[2:], 'stdin': sys.stdin.read()}) + '\\n')
sys.exit(int(os.environ['PROBE_HYGIENE_EXIT'] if role == 'hygiene' else os.environ['PROBE_SUITE_EXIT']))
`, { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'npm'), '#!/bin/sh\nexec probe lua "$@"\n', { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'ssh'), '#!/bin/sh\nprintf "serveraliveinterval %s\\n" "$PROBE_KEEPALIVE"\n', { mode: 0o755 });
  const jsonLines = (p) => fs.existsSync(p) ? fs.readFileSync(p, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
  return {
    run, markers: () => jsonLines(markers), rows: () => jsonLines(log),
    push: (remote, input, options = {}) => spawnSync(path.join(repo, '.githooks/pre-push'),
      [remote, options.ssh ? 'git@example.test:repo.git' : 'https://example.test/repo.git'],
      { cwd: repo, env: env(options), input, encoding: 'utf8', timeout: 15_000 }),
  };
}

for (const [hook, broad] of [['hook-pre-push', 'test'], ['hook-pre-push-fast', 'test-fast']]) {
  test(`${hook} times hygiene separately from the enabled suite`, (t) => {
    const f = fixture(t, { policy: true });
    const r = f.run([hook]);
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(f.markers().map((m) => m.role), ['hygiene', 'suite']);
    assert.deepEqual(f.rows().map((r) => r.target), [hook, broad]);
  });
  test(`${hook} keeps hygiene when broad work is disabled`, (t) => {
    const f = fixture(t);
    const r = f.run([hook]);
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(f.markers().map((m) => m.role), ['hygiene']);
    assert.deepEqual(f.rows().map((r) => r.target), [hook, broad]);
    const skipped = f.rows()[1];
    assert.equal(skipped.execution, 'skipped');
    for (const key of ['exit', 'tests', 'selection', 'slowest']) assert.equal(skipped[key], null);
  });
  test(`${hook} stops on hygiene failure`, (t) => {
    const f = fixture(t);
    const r = f.run([hook], { hygieneExit: 7 });
    assert.notEqual(r.status, 0);
    assert.deepEqual(f.markers().map((m) => m.role), ['hygiene']);
    assert.equal(f.rows().length, 1);
    assert.equal(f.rows()[0].exit, 7);
  });
}

test('test-one forwards literal arguments while policy is off', (t) => {
  const f = fixture(t);
  const args = ['a file.js', '$literal', '*.js', 'a"quote'];
  const r = f.run(['test-one', ...args]);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(f.markers()[0].args, args);
  assert.equal(f.rows()[0].target, 'test-one');
  assert.equal(f.rows()[0].execution, 'ran');
});

test('test-plugin-lua remains a focused subsystem route', (t) => {
  const f = fixture(t);
  const r = f.run(['test-plugin-lua']);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(f.markers()[0].args, ['run', '--silent', 'test:plugin-lua']);
  assert.equal(f.rows()[0].target, 'test-plugin-lua');
  assert.equal(f.rows()[0].execution, 'ran');
});

test('test-full forces one child and preserves its failure', (t) => {
  const f = fixture(t);
  const r = f.run(['test-full'], { suiteExit: 7 });
  assert.equal(r.status, 7, r.stderr);
  assert.deepEqual(f.markers().map((m) => m.role), ['suite']);
  assert.equal(f.rows().length, 1);
  assert.equal(f.rows()[0].target, 'test');
  assert.equal(f.rows()[0].execution_reason, 'forced');
  assert.equal(f.rows()[0].exit, 7);
});

test('a hosted hook without force refuses the broad child', (t) => {
  const f = fixture(t);
  const r = f.run(['hook-pre-push'], { hosted: true });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /TT_FORCE=1/);
  assert.deepEqual(f.markers().map((m) => m.role), ['hygiene']);
});

const oid = 'a'.repeat(40), zero = '0'.repeat(40);
for (const [label, remote, ref, valid, covered] of [
  ['nested branch', 'origin', 'refs/heads/feature/x', true, true],
  ['other remote', 'upstream', 'refs/heads/main', true, false],
  ['tag', 'origin', 'refs/tags/v1', true, false],
  ['malformed input', 'origin', 'refs/heads/main', false, false],
]) {
  test(`pre-push preserves input and reports coverage for ${label}`, (t) => {
    const f = fixture(t);
    const input = valid ? `refs/heads/main ${oid} ${ref} ${zero}\n` : 'malformed\n';
    const r = f.push(remote, input);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(f.markers()[0].stdin, input);
    assert.equal(f.rows()[0].target, covered ? 'hook-pre-push-fast' : 'hook-pre-push');
    assert.equal(/coverage is not declared/.test(r.stderr), !covered);
    assert.deepEqual(f.markers().map((m) => m.role), ['hygiene']);
  });
}

test('pre-push retains the SSH keepalive refusal', (t) => {
  const f = fixture(t);
  const r = f.push('origin', `refs/heads/main ${oid} refs/heads/main ${zero}\n`, { ssh: true, keepalive: 0 });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /no SSH keepalive/);
  assert.deepEqual(f.markers(), []);
});

function workflow() {
  return parse(fs.readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8'));
}

function allBranches(w) {
  const push = w.on?.push;
  return push?.branches?.includes('**')
    && !push.branches.some((p) => p.startsWith('!'))
    && !['branches-ignore', 'paths', 'paths-ignore'].some((k) => k in push);
}

test('CI covers every branch once and forces the complete suite', () => {
  const w = workflow();
  assert.ok(allBranches(w), 'push includes nested branches without filtering');
  assert.ok('workflow_dispatch' in w.on);
  assert.ok(!('pull_request' in w.on) && !('pull_request_target' in w.on));
  assert.equal(w.concurrency['cancel-in-progress'], true);
  assert.match(w.concurrency.group, /github\.ref/);
  assert.match(w.concurrency.group, /github\.workflow/);
  const job = Object.values(w.jobs).find((j) => j.steps.some((s) =>
    s.run?.split('\n').some((line) => line.trim() === 'just test')));
  assert.ok(job, 'a job actually invokes the full test front door');
  assert.equal(job.env.TT_FORCE, '1');
  const suite = job.steps.find((s) => s.run?.split('\n').some((line) => line.trim() === 'just test'));
  assert.equal(suite.if, undefined);
  assert.ok(!suite['continue-on-error']);
});

test('declared remote refs stay within workflow coverage and permit rollback', () => {
  const w = workflow();
  const declared = fs.readFileSync(path.join(root, 'justfile'), 'utf8')
    .match(/^ci_suite_refs := "([^"]*)"$/m)[1].split(/\s+/).filter(Boolean);
  const covered = (refs, config) => refs.every((ref) => ref.startsWith('refs/heads/') && allBranches(config));
  assert.ok(covered(declared, w));
  assert.ok(covered(['refs/heads/*'], w));
  assert.ok(!covered(['refs/tags/*'], w));
  assert.ok(!covered(['refs/heads/*'], { on: { push: { branches: ['main'] } } }));
  assert.ok(covered([], { on: {} }));
});

test('CI supplies the pinned renderer and its guard rejects missing input', (t) => {
  const w = workflow();
  const job = Object.values(w.jobs).find((j) => j.env?.NIRI_MATERIAL_DIR);
  assert.ok(job);
  const checkout = job.steps.find((s) => s.with?.repository === 'khughitt/niri-material');
  assert.equal(checkout.with.ref, '3be57dc203fe6c8e854b6f0e427a645688d343ab');
  assert.equal(checkout.with['sparse-checkout'], 'resources/materials/pipeline.json');
  assert.equal(checkout.with['sparse-checkout-cone-mode'], false);
  assert.equal(job.env.NIRI_MATERIAL_DIR, `\${{ github.workspace }}/${checkout.with.path}`);
  const guard = job.steps.find((s) => s.id === 'renderer-input');
  assert.ok(guard && guard.run);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-renderer-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const run = () => spawnSync('sh', ['-c', guard.run], {
    env: { PATH: '/usr/bin:/bin', HOME: dir, NIRI_MATERIAL_DIR: dir,
      GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' },
    encoding: 'utf8', input: '', timeout: 5_000,
  });
  assert.notEqual(run().status, 0);
  fs.mkdirSync(path.join(dir, 'resources/materials'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'resources/materials/pipeline.json'), '{}');
  assert.equal(run().status, 0);
});
