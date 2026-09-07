import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const applyBin = fileURLToPath(new URL('../integrations/niri/apply', import.meta.url));

// The reason niri gives for rejecting a config is the only thing that tells an
// operator which value to correct, so it has to survive the whole path from the
// validator's stderr to the recorded sink status.
const OFFENDING = 'attenuation-distance';
const DIAGNOSTIC = `error: material "terminal-glass": ${OFFENDING}: value must be greater than 0 and at most 65535`;

const PARAMS = {
  'compositor.gaps': 54,
  'terminal.apps': ['kitty'],
  'glass.enabled': true,
  'glass.paneLip': 5,
  'glass.paneShiftX': 4,
  'glass.paneShiftY': 4,
  'glass.ior': 1.38,
  'glass.thickness': 32,
  'glass.attenuationColor': '#bbc7db',
  'glass.attenuationDistance': 178,
  'glass.chromaticAberration': 0.68,
  'glass.distortion': 0.32,
  'glass.distortionScale': 0.05,
  'glass.anisotropicBlur': 0,
  'glass.roughness': 0.08,
  'glass.backdropBlur': true,
  'glass.jellyFlex': 0.0038,
  'glass.jellyRipple': 0.15,
  'glass.noise': 0,
  'glass.noiseType': 'fine',
  'glass.saturation': 1,
};

// A fake niri whose two subcommands fail independently, and which records the
// order it was called in so a test can prove the reload was never requested.
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-apply-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const bin = path.join(dir, 'bin');
  const state = path.join(dir, 'state');
  const log = path.join(dir, 'niri.log');
  fs.mkdirSync(bin);
  fs.mkdirSync(state);

  fs.writeFileSync(path.join(bin, 'niri'), `#!/bin/sh
if [ "$1" = validate ]; then
  echo validate >> "$NIRI_FAKE_LOG"
  if [ -n "$NIRI_FAKE_VALIDATE_FAILS" ]; then
    printf '%s\\n' "$NIRI_FAKE_DIAGNOSTIC" >&2
    exit 1
  fi
  exit 0
fi
echo "$*" >> "$NIRI_FAKE_LOG"
[ -z "$NIRI_FAKE_RELOAD_FAILS" ] || exit 1
exit 0
`, { mode: 0o755 });

  const resolvedFile = path.join(dir, 'resolved.json');
  fs.writeFileSync(resolvedFile, JSON.stringify({ params: PARAMS }));

  const target = path.join(state, 'generated', 'prism.kdl');
  const run = (extra = {}) => {
    const env = {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      PRISM_STATE_DIR: state,
      NIRI_FAKE_LOG: log,
      NIRI_FAKE_DIAGNOSTIC: DIAGNOSTIC,
      ...extra,
    };
    delete env.NIRI_SOCKET;   // the deferred-reload path must look like a cold start
    return spawnSync(applyBin, [resolvedFile], { encoding: 'utf8', env });
  };

  const calls = () => (fs.existsSync(log)
    ? fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean)
    : []);
  const inode = () => fs.statSync(target).ino;

  return { dir, state, target, run, calls, inode };
}

test('an invalid composed config restores the previous target exactly', (t) => {
  const { target, run, calls } = fixture(t);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const previous = '// previous accepted generation\nlayout {\n    gaps 24\n}\n';
  fs.writeFileSync(target, previous);

  const result = run({ NIRI_FAKE_VALIDATE_FAILS: '1' });

  assert.notEqual(result.status, 0, 'a rejected config must fail the sink');
  assert.equal(fs.readFileSync(target, 'utf8'), previous);
  assert.deepEqual(calls(), ['validate'], 'a rejected config must not be loaded');
  assert.match(result.stderr, new RegExp(OFFENDING));
});

test('an invalid composed config with no previous target leaves none behind', (t) => {
  const { state, target, run, calls } = fixture(t);

  const result = run({ NIRI_FAKE_VALIDATE_FAILS: '1' });

  assert.notEqual(result.status, 0);
  assert.equal(fs.existsSync(target), false, 'the rejected candidate must not survive');
  assert.deepEqual(
    fs.readdirSync(path.join(state, 'generated')), [],
    'no temporary file may be left behind either',
  );
  assert.deepEqual(calls(), ['validate']);
});

test('a valid config survives a failed reload request so cold start can load it', (t) => {
  const { target, run, calls, inode } = fixture(t);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, '// previous accepted generation\n');
  const before = inode();

  const result = run({ NIRI_FAKE_RELOAD_FAILS: '1' });

  // The three facts dotfiles setup consumes to accept a deferred reload.
  assert.notEqual(result.status, 0, 'a failed transport must still fail the sink');
  assert.ok(fs.statSync(target).size > 0, 'the generated file must be nonempty');
  assert.notEqual(inode(), before, 'the generated file must have been replaced');

  assert.match(fs.readFileSync(target, 'utf8'), /material "terminal-glass" \{/);
  assert.match(fs.readFileSync(target, 'utf8'), /roughness 0\.08/);
  assert.deepEqual(calls(), ['validate', 'msg action load-config-file']);
});

test('a valid config that loads keeps the target and succeeds', (t) => {
  const { target, run, calls } = fixture(t);

  const result = run();

  assert.equal(result.status, 0, result.stderr);
  assert.match(fs.readFileSync(target, 'utf8'), /material "terminal-glass" \{/);
  assert.deepEqual(calls(), ['validate', 'msg action load-config-file']);
});

test('the recorded sink failure names the value niri rejected', async (t) => {
  const { dir, state } = fixture(t);
  const restoreState = process.env.PRISM_STATE_DIR;
  process.env.PRISM_STATE_DIR = state;
  t.after(() => { process.env.PRISM_STATE_DIR = restoreState; });
  const { fanOut, runApply } = await import('../src/fanout.js');
  const { sinkStatusPath, resolvedPath } = await import('../src/paths.js');
  // fan-out hands the sink resolvedPath(), not an arbitrary file.
  fs.copyFileSync(path.join(dir, 'resolved.json'), resolvedPath());

  const manifest = {
    sink: 'niri',
    dir: fileURLToPath(new URL('../integrations/niri', import.meta.url)),
    binds: [{ param: 'glass.attenuationDistance', liveness: 'reload' }],
    generates: ['prism.kdl'],
  };

  // runApply itself, not a stub: the diagnostic has to cross both process
  // boundaries — the validator's stderr into apply, and apply's into fan-out.
  const { failed } = await fanOut({
    manifests: [manifest],
    resolved: { params: PARAMS },
    changedKeys: ['glass.attenuationDistance'],
    runner: (m, f, keys) => {
      const restore = process.env.PATH;
      process.env.PATH = `${path.join(dir, 'bin')}:${restore}`;
      process.env.NIRI_FAKE_LOG = path.join(dir, 'niri.log');
      process.env.NIRI_FAKE_DIAGNOSTIC = DIAGNOSTIC;
      process.env.NIRI_FAKE_VALIDATE_FAILS = '1';
      try {
        runApply(m, f, keys);
      } finally {
        process.env.PATH = restore;
        delete process.env.NIRI_FAKE_VALIDATE_FAILS;
      }
    },
  });

  assert.equal(failed.length, 1);
  const status = JSON.parse(fs.readFileSync(sinkStatusPath(), 'utf8'));
  assert.equal(status.niri.ok, false);
  assert.match(status.niri.error, new RegExp(OFFENDING),
    'doctor must be able to report which value niri rejected');
});
