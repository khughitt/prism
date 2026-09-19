import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.PRISM_CONFIG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-cfg-'));
process.env.PRISM_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-state-'));

const contexts = await import('../src/contexts.js');
const { activePath, contextsDir } = await import('../src/paths.js');

beforeEach(() => {
  for (const dir of [process.env.PRISM_CONFIG_DIR, process.env.PRISM_STATE_DIR]) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  }
});

test('kinds: profile and wallpaper are accepted, state is reserved, anything else is unknown', () => {
  contexts.assertKind('profile');
  contexts.assertKind('wallpaper');
  assert.throws(() => contexts.assertKind('state'), /kind state is reserved/);
  assert.throws(() => contexts.assertKind('theme'), /unknown kind theme/);
  assert.deepEqual(contexts.LAYER_ORDER, ['profile', 'wallpaper', 'state']);
  assert.deepEqual(contexts.VERB_KINDS, ['profile', 'wallpaper']);
});

test('names are filesystem-safe', () => {
  for (const ok of ['dusk', 'dusk-2', 'a.b_c', '3f9a1c2e']) contexts.assertName(ok);
  for (const bad of ['', 'a b', '../x', 'x/y', 'ü']) {
    assert.throws(() => contexts.assertName(bad), /invalid context name/);
  }
});

test('wallpaperId is 8 hex chars, stable, and refuses an empty path', () => {
  const id = contexts.wallpaperId('/walls/a.jpg');
  assert.match(id, /^[0-9a-f]{8}$/);
  assert.equal(contexts.wallpaperId('/walls/a.jpg'), id);
  assert.notEqual(contexts.wallpaperId('/walls/b.jpg'), id);
  assert.throws(() => contexts.wallpaperId(''), /wallpaper path must not be empty/);
  assert.throws(() => contexts.wallpaperId('   '), /wallpaper path must not be empty/);
});

test('context files round-trip; wallpaper files carry _source', () => {
  assert.equal(contexts.readContext('profile', 'dusk'), null);
  contexts.writeContext('profile', 'dusk', { source: null, values: { 'glass.ior': 1.3 } });
  assert.deepEqual(contexts.readContext('profile', 'dusk'), { source: null, values: { 'glass.ior': 1.3 } });
  assert.equal(contexts.contextPath('profile', 'dusk'), path.join(contextsDir(), 'profile', 'dusk.yaml'));

  contexts.writeContext('wallpaper', 'abc12345', { source: '/walls/a.jpg', values: { 'glass.ior': 1.1 } });
  const text = fs.readFileSync(contexts.contextPath('wallpaper', 'abc12345'), 'utf8');
  assert.match(text, /^_source: \/walls\/a\.jpg\n/);
  assert.deepEqual(contexts.readContext('wallpaper', 'abc12345'),
    { source: '/walls/a.jpg', values: { 'glass.ior': 1.1 } });
});

test('malformed context files fail loudly', () => {
  fs.mkdirSync(path.join(contextsDir(), 'profile'), { recursive: true });
  fs.mkdirSync(path.join(contextsDir(), 'wallpaper'), { recursive: true });
  fs.writeFileSync(contexts.contextPath('profile', 'list'), '- 1\n- 2\n');
  assert.throws(() => contexts.readContext('profile', 'list'), /profile list: context must be a flat object/);
  fs.writeFileSync(contexts.contextPath('profile', 'src'), '_source: /x\n');
  assert.throws(() => contexts.readContext('profile', 'src'), /profile src: _source is only allowed in wallpaper contexts/);
  fs.writeFileSync(contexts.contextPath('wallpaper', 'nosrc'), 'glass.ior: 1\n');
  assert.throws(() => contexts.readContext('wallpaper', 'nosrc'), /wallpaper nosrc: missing _source/);
});

test('inspectContext reports a parse failure instead of throwing, with the raw text attached', () => {
  fs.mkdirSync(path.join(contextsDir(), 'profile'), { recursive: true });
  fs.mkdirSync(path.join(contextsDir(), 'wallpaper'), { recursive: true });
  contexts.writeContext('wallpaper', 'good', { source: '/x', values: { 'glass.ior': 1 } });
  assert.deepEqual(contexts.inspectContext('wallpaper', 'good'),
    { context: { source: '/x', values: { 'glass.ior': 1 } }, text: '_source: /x\nglass.ior: 1\n', error: null });

  fs.writeFileSync(contexts.contextPath('wallpaper', 'nosrc'), 'glass.ior: 1\n');
  assert.deepEqual(contexts.inspectContext('wallpaper', 'nosrc'),
    { context: null, text: 'glass.ior: 1\n', error: 'missing _source' });

  fs.writeFileSync(contexts.contextPath('profile', 'syntax'), 'glass.ior: [\n');
  const syntax = contexts.inspectContext('profile', 'syntax');
  assert.equal(syntax.context, null);
  assert.equal(syntax.text, 'glass.ior: [\n');
  assert.match(syntax.error, /^invalid YAML: /);
  assert.doesNotMatch(syntax.error, /\n/);
  // readContext throws the same reason, prefixed with the context it names.
  assert.throws(() => contexts.readContext('profile', 'syntax'), /^Error: profile syntax: invalid YAML: /);

  assert.equal(contexts.inspectContext('profile', 'absent'), null);
});

test('deleteContext removes the file and refuses a missing one', () => {
  contexts.writeContext('profile', 'dusk', { source: null, values: {} });
  contexts.deleteContext('profile', 'dusk');
  assert.equal(fs.existsSync(contexts.contextPath('profile', 'dusk')), false);
  assert.throws(() => contexts.deleteContext('profile', 'dusk'), /profile dusk: no such context/);
});

test('listContexts lists every kind sorted, empty when nothing exists', () => {
  assert.deepEqual(contexts.listContexts(), { profile: [], wallpaper: [] });
  contexts.writeContext('profile', 'zed', { source: null, values: {} });
  contexts.writeContext('profile', 'alpha', { source: null, values: {} });
  contexts.writeContext('wallpaper', 'abc12345', { source: '/w', values: {} });
  assert.deepEqual(contexts.listContexts(), { profile: ['alpha', 'zed'], wallpaper: ['abc12345'] });
});

test('active slots round-trip and reject the reserved kind and bad shapes', () => {
  assert.deepEqual(contexts.readActive(), {});
  contexts.writeActive({ wallpaper: { id: 'abc12345', path: '/w' }, profile: 'dusk' });
  assert.deepEqual(JSON.parse(fs.readFileSync(activePath(), 'utf8')),
    { wallpaper: { id: 'abc12345', path: '/w' }, profile: 'dusk' });
  assert.deepEqual(contexts.readActive(), { wallpaper: { id: 'abc12345', path: '/w' }, profile: 'dusk' });

  fs.writeFileSync(activePath(), JSON.stringify({ state: 'dark' }));
  assert.throws(() => contexts.readActive(), (err) => {
    assert.match(err.message, /kind state is reserved/);
    assert.ok(err.message.includes(activePath()), 'must name active.json');
    return true;
  });
  fs.writeFileSync(activePath(), JSON.stringify({ wallpaper: 'abc12345' }));
  assert.throws(() => contexts.readActive(), /active wallpaper must carry id and path/);
  fs.writeFileSync(activePath(), JSON.stringify({ profile: 7 }));
  assert.throws(() => contexts.readActive(), /invalid context name/);
  fs.writeFileSync(activePath(), JSON.stringify({ wallpaper: { id: 'abc12345', path: '/w', given: '/x' } }));
  assert.throws(() => contexts.readActive(), /active wallpaper carries unknown field given/);
});

test('a slot carrying the retired pinned field is repaired once on read, keeping the profile and wallpaper', () => {
  fs.writeFileSync(activePath(), JSON.stringify({ wallpaper: { id: 'abc12345', path: '/w', pinned: false }, profile: 'dusk' }));
  let warned = '';
  const repaired = contexts.readActive({ warn: (text) => { warned += text; } });
  assert.deepEqual(repaired, { wallpaper: { id: 'abc12345', path: '/w' }, profile: 'dusk' });
  assert.equal(warned, 'prism: dropped the retired pinned field from active.json\n');
  assert.deepEqual(JSON.parse(fs.readFileSync(activePath(), 'utf8')),
    { wallpaper: { id: 'abc12345', path: '/w' }, profile: 'dusk' }, 'the file is rewritten at once');
  warned = '';
  contexts.readActive({ warn: (text) => { warned += text; } });
  assert.equal(warned, '', 'the repair is unreachable once it has run');
});

test('retired pinned repair validates the active profile before writing', () => {
  const original = JSON.stringify({ wallpaper: { id: 'abc12345', path: '/w', pinned: false }, profile: 'bad name' });
  fs.writeFileSync(activePath(), original);
  let warned = '';
  assert.throws(() => contexts.readActive({ warn: (text) => { warned += text; } }), /invalid context name/);
  assert.equal(warned, '');
  assert.equal(fs.readFileSync(activePath(), 'utf8'), original);
});
