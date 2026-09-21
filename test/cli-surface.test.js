// prism's declared command table equals its rows in tools/cli.toml, and `run` behaves
// as the CLI vocabulary requires (ops docs/specs/2026-09-20-cli-conventions-design.md).
import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMMANDS } from '../src/commands.js';
import { wallpaperId, canonicalWallpaperPath } from '../src/contexts.js';
import * as cli from '../src/cli.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const key = (row) => JSON.stringify(row);
const normalize = (names) => [...names.filter((n) => n.startsWith('--')), ...names.filter((n) => !n.startsWith('--'))];

function liveRows() {
  const rows = new Set();
  for (const cmd of COMMANDS) {
    rows.add(key(['command', cmd.path, cmd.summary]));
    (cmd.args ?? []).forEach((a, i) => rows.add(key(['arg', cmd.path, i, a.name, a.value, a.values ?? [], a.required, a.variadic ?? false])));
    for (const o of cmd.options ?? []) {
      const flag = o.value === 'none';
      rows.add(key(['option', cmd.path, normalize(o.names), o.value, o.values ?? [], flag ? (o.default === 'true' ? 'true' : null) : (o.default ?? null), flag ? null : (o.arity ?? '1'), o.repeatable ?? false, o.required ?? false]));
    }
  }
  return rows;
}

function tableRows() {
  const text = execFileSync('python3', [path.join(ROOT, 'tools', 'cli_surface.py'), 'rows', 'prism', path.join(ROOT, 'tools', 'cli.toml')], { encoding: 'utf8' });
  return new Set(text.trim().split('\n').map((line) => key(JSON.parse(line))));
}

let dir;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-cli-'));
  process.env.PRISM_CONFIG_DIR = path.join(dir, 'config'); process.env.PRISM_STATE_DIR = path.join(dir, 'state');
});
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); delete process.env.PRISM_CONFIG_DIR; delete process.env.PRISM_STATE_DIR; });

async function run(argv, env = {}) {
  const out = [], err = [];
  const code = await cli.run(argv, { print: (t) => out.push(t), eprint: (t) => err.push(t), runner: () => {}, env: { ...process.env, ...env } });
  return { code, stdout: out.join(''), stderr: err.join('') };
}

test('declared surface equals tools/cli.toml', () => {
  const live = liveRows(), table = tableRows();
  assert.deepEqual({ parserOnly: [...live].filter((r) => !table.has(r)), tableOnly: [...table].filter((r) => !live.has(r)) }, { parserOnly: [], tableOnly: [] });
});

test('help on root and every command, -h, and help routing', async () => {
  for (const cmd of [{ path: [] }, ...COMMANDS]) {
    for (const flag of ['--help', '-h']) {
      const r = await run([...cmd.path, flag]);
      assert.deepEqual({ path: cmd.path, flag, code: r.code, err: r.stderr, empty: r.stdout === '' }, { path: cmd.path, flag, code: 0, err: '', empty: false });
    }
    if (cmd.path.length) assert.equal((await run(['help', ...cmd.path])).stdout, (await run([...cmd.path, '--help'])).stdout);
  }
});

test('version', async () => {
  for (const flag of ['--version', '-V']) { const r = await run([flag]); assert.equal(r.code, 0); assert.match(r.stdout, /^prism \d/); }
});

test('usage errors exit 2 with stderr only', async () => {
  for (const args of [['bogus'], ['list', '--bogus'], ['get'], ['help', 'bogus'], ['context', 'bogus'], ['--json', 'list', '--pretty']]) {
    const r = await run(args);
    assert.deepEqual({ args, code: r.code, out: r.stdout }, { args, code: 2, out: '' });
    assert.ok(r.stderr.trim().split('\n').length <= 2, r.stderr);
  }
});

test('enum baselines cover every enum row', async () => {
  const wallpaper = path.join(dir, 'wallpaper.jpg'); fs.writeFileSync(wallpaper, '');
  assert.equal((await run(['context', 'wallpaper', wallpaper])).code, 0); // commit wallpaper and clear need an active wallpaper
  const id = wallpaperId(canonicalWallpaperPath(wallpaper));
  const baselines = [ // in order: an edit before commit, commit before show/activate/rename/delete
    [['reset'], 'mode', ['reset', 'neutral']],
    [['migrate'], 'target', ['migrate', 'pairs']],
    [['commit'], 'destination', ['set', 'glass.ior', '1.4'], ['commit', 'profile', 'dusk']],
    [['context', 'show'], 'kind', ['context', 'show', 'profile', 'dusk']],
    [['context', 'activate'], 'kind', ['context', 'activate', 'profile', 'dusk']],
    [['context', 'deactivate'], 'kind', ['context', 'deactivate', 'profile']],
    [['context', 'rename'], 'kind', ['context', 'rename', 'profile', 'dusk', 'dawn']],
    [['context', 'delete'], 'kind', ['context', 'delete', 'profile', 'dawn']],
    [['context', 'clear'], 'kind', ['set', 'glass.ior', '1.6'], ['commit', 'wallpaper', id], ['context', 'clear', 'wallpaper', id]],
  ];
  const table = [...tableRows()].map((r) => JSON.parse(r)).filter((r) => r[0] === 'arg' && r[4] === 'enum').map((r) => `${r[1].join(' ')} ${r[3]}`).sort();
  assert.deepEqual(baselines.map(([p, b]) => `${p.join(' ')} ${b}`).sort(), table, 'every enum row needs a baseline');
  for (const [path, binding, ...steps] of baselines) {
    const argv = steps.at(-1);
    for (const step of steps) { const ok = await run(step); assert.equal(ok.code, 0, `${step.join(' ')}: ${ok.stderr}`); }
    const bad = [...argv]; bad[path.length] = '__not_in_set__';
    const r = await run(bad);
    assert.equal(r.code, 2, bad.join(' ')); assert.ok(r.stderr.includes(binding) && r.stderr.includes('__not_in_set__'), r.stderr);
  }
});

test('global routing and output precedence', async () => {
  const isJson = (s) => { try { JSON.parse(s); return true; } catch { return false; } };
  for (const args of [['--json', 'list'], ['list', '--json']]) { const r = await run(args); assert.ok(isJson(r.stdout), args.join(' ')); }
  for (const args of [['--pretty', 'list'], ['list', '--pretty'], ['list']]) { const r = await run(args); assert.ok(!isJson(r.stdout), args.join(' ')); }
  assert.ok(isJson((await run(['list'], { PRISM_FORMAT: 'json' })).stdout));
  assert.ok(!isJson((await run(['--pretty', 'list'], { PRISM_FORMAT: 'json' })).stdout));
  assert.ok(isJson((await run(['--json', 'describe'])).stdout));
});

test('json failure is the error object on stderr', async () => {
  const r = await run(['--json', 'get', 'no.such.param']);
  assert.equal(r.code, 1); assert.equal(r.stdout, '');
  const err = JSON.parse(r.stderr).error;
  assert.equal(typeof err.kind, 'string'); assert.equal(typeof err.detail, 'string');
});

test('color', async () => {
  assert.equal((await run(['--color', 'never', 'list'])).code, 0);
  assert.equal((await run(['list', '--color', 'never'])).code, 0);
  assert.equal((await run(['--color', 'sometimes', 'list'])).code, 2);
  assert.equal((await run(['list'], { PRISM_COLOR: 'always' })).code, 0);
});

test('completion callback and scripts', async () => {
  const candidates = async (words, index) => (await run(['--', ...words], { PRISM_COMPLETE: 'zsh', PRISM_COMPLETE_INDEX: String(index) })).stdout.split('\n').filter(Boolean).map((l) => l.split('\t')[0]);
  const root = await candidates(['prism', ''], 1);
  for (const cmd of COMMANDS) if (cmd.path.length === 1) assert.ok(root.includes(cmd.path[0]), cmd.path[0]);
  assert.ok((await candidates(['prism', 'context', ''], 2)).includes('deactivate'));
  assert.ok((await candidates(['prism', 'reset', '--'], 2)).includes('--base'));
  assert.deepEqual((await candidates(['prism', 'reset', ''], 2)).sort(), ['neutral', 'revert', 'symmetric']);
  assert.deepEqual((await candidates(['prism', 'reset', '--base', ''], 3)).sort(), ['neutral', 'revert', 'symmetric']);
  assert.deepEqual((await candidates(['prism', 're'], 1)).sort(), ['requirements', 'reset']);
  assert.deepEqual((await candidates(['prism', '--json', 'reset', 'n'], 3)), ['neutral']);
  assert.deepEqual(await candidates(['prism', '--color', 'never', 'context', 'dea'], 4), ['deactivate']);
  const zsh = path.join(dir, '_prism'); fs.writeFileSync(zsh, (await run([], { PRISM_COMPLETE: 'zsh' })).stdout);
  assert.equal(execFileSync('zsh', ['-f', '-c', `autoload -Uz compinit; compinit -D -u; source ${zsh}; print -r -- \${_comps[prism]}`], { encoding: 'utf8' }).trim(), '_prism');
  const bash = path.join(dir, 'prism.bash'); fs.writeFileSync(bash, (await run([], { PRISM_COMPLETE: 'bash' })).stdout);
  execFileSync('bash', ['-c', `source ${bash}; complete -p prism`]);
});

// Every command row without an `output` row follows the CLI default and its precedence:
// under --json, or PRISM_FORMAT=json, stdout is exactly one JSON value. The rows come from
// the table, so a command added there without a fixture here fails this test.
function commandRowsWithoutOutput() {
  const script = 'import json, sys, tomllib\n'
    + 'rows = tomllib.load(open(sys.argv[1], "rb"))["cli"]["prism"]["commands"]\n'
    + 'print(json.dumps([r["path"] for r in rows if "output" not in r]))';
  return JSON.parse(execFileSync('python3', ['-c', script, path.join(ROOT, 'tools', 'cli.toml')], { encoding: 'utf8' }));
}

test('every command without an output row emits one JSON value under --json and PRISM_FORMAT=json', async () => {
  const wallpaper = path.join(dir, 'wallpaper.jpg'); fs.writeFileSync(wallpaper, '');
  const fixture = [ // in an order each step leaves valid for the next
    ['set', 'glass.ior', '1.4'], ['get', 'glass.ior'], ['unset', 'glass.ior'], ['reset', 'neutral'],
    ['list'], ['describe'], ['apply'], ['requirements'], ['doctor'], ['migrate'],
    ['context', 'wallpaper', wallpaper], ['set', 'glass.ior', '1.4'], ['commit', 'profile', 'dusk'],
    ['context', 'list'], ['context', 'show', 'profile', 'dusk'],
    ['context', 'activate', 'profile', 'dusk'], ['context', 'deactivate', 'profile'],
    ['context', 'rename', 'profile', 'dusk', 'dawn'], ['context', 'delete', 'profile', 'dawn'],
    ['set', 'glass.ior', '1.6'], ['commit', 'wallpaper', wallpaperId(canonicalWallpaperPath(wallpaper))], ['context', 'clear', 'wallpaper', wallpaperId(canonicalWallpaperPath(wallpaper))],
  ];
  const isGroup = (p) => COMMANDS.some((c) => c.path.length === p.length + 1 && p.every((w, i) => c.path[i] === w));
  const runnable = commandRowsWithoutOutput().filter((p) => !isGroup(p)).map((p) => p.join(' ')).sort();
  const covered = fixture.map((argv) => COMMANDS.filter((c) => c.path.every((w, i) => argv[i] === w)).sort((a, b) => b.path.length - a.path.length)[0].path.join(' '));
  assert.deepEqual([...new Set(covered)].sort(), runnable, 'every runnable command row needs a fixture invocation');
  for (const via of ['flag', 'env']) {
    for (const argv of fixture) {
      const r = via === 'flag' ? await run(['--json', ...argv]) : await run(argv, { PRISM_FORMAT: 'json' });
      assert.equal(r.stderr, '', `${via}: ${argv.join(' ')}: ${r.stderr}`);
      assert.ok([0, 1].includes(r.code), `${via}: ${argv.join(' ')}: exit ${r.code}`);
      assert.doesNotThrow(() => JSON.parse(r.stdout), `${via}: ${argv.join(' ')}: stdout is not one JSON value: ${JSON.stringify(r.stdout)}`);
      assert.equal(typeof JSON.parse(r.stdout), 'object', `${via}: ${argv.join(' ')}`);
    }
  }
});
