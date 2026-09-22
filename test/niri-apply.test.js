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
  'glass.lightIor': 6,
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
  'glass.iridescence': 0,
  'glass.aurora': 0,
  'glass.auroraDriftHz': 4,
  'glass.auroraColorA': "#3dffb0",
  'glass.auroraColorB': "#7a5cff",
  'glass.ring.focus': true,
  'glass.ring.colorSource': 'manual',
  'glass.ring.color': '#f2c14e',
  'glass.ring.beamSpeed': 450,
  'glass.ring.gap': 10,
  'glass.ring.glow': 1.2,

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
if [ "$1" = "--version" ]; then
  echo "niri 26.04 (fake)"
  exit 0
fi
if [ "$1" = validate ]; then
  echo validate >> "$NIRI_FAKE_LOG"
  if [ -n "$NIRI_FAKE_VALIDATE_FAILS" ]; then
    printf '%s\\n' "$NIRI_FAKE_DIAGNOSTIC" >&2
    exit 1
  fi
  # A build that knows the material node but not one property: it refuses only
  # the configs that carry the pattern, exactly as an outdated package does.
  if [ -n "$NIRI_FAKE_REJECT_PATTERN" ] && grep -q "$NIRI_FAKE_REJECT_PATTERN" "$3"; then
    printf "error: unknown property '%s'\\n" "$NIRI_FAKE_REJECT_PATTERN" >&2
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
  const writeParams = (overrides) =>
    fs.writeFileSync(resolvedFile, JSON.stringify({ params: { ...PARAMS, ...overrides } }));

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

  return { dir, state, target, run, calls, inode, writeParams };
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
  assert.doesNotMatch(result.stderr, /Buffer\(|Uint8Array/,
    'the error object must never be inspected onto stderr');
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
  assert.doesNotMatch(status.niri.error, /Buffer\(|Uint8Array/);
  assert.doesNotMatch(status.niri.error, /Command failed:/,
    'the recorded status is the diagnostic, not prism restating its own invocation');
});

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
  assert.deepEqual(result.stderr.trim().split('\n'), [
    'this niri does not accept the config prism emits (installed: niri 26.04 (fake))',
    'niri: unexpected node `material`',
  ]);
  assert.doesNotMatch(result.stderr, /Buffer\(|Uint8Array/);
});

// The case three shipped packages were in: they knew `material`, and predated the
// type= prism emits on noise. A probe of a minimal block says yes and apply then
// fails, so the probe is the fragment the sink writes, rendered from the same code.
for (const property of ['type=', 'iridescence', 'aurora']) test(`probe-material rejects a build too old for ${property}`, (t) => {
  const { dir } = fixture(t);
  const probe = fileURLToPath(new URL('../integrations/niri/probe-material', import.meta.url));

  const result = spawnSync(probe, [], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${path.join(dir, 'bin')}:${process.env.PATH}`,
           NIRI_FAKE_LOG: path.join(dir, 'niri.log'),
           NIRI_FAKE_REJECT_PATTERN: property },
  });

  assert.equal(result.status, 1);
  assert.deepEqual(result.stderr.trim().split('\n'), [
    'this niri does not accept the config prism emits (installed: niri 26.04 (fake))',
    `niri: error: unknown property '${property}'`,
  ]);
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

// The outer bound kills the probe, not the probe's children. If validate were
// unbounded, a hanging niri would outlive the probe and its temp config would
// never be removed.
test('a hanging niri is killed by the probe and leaves nothing behind', (t) => {
  const { dir } = fixture(t);
  const probe = fileURLToPath(new URL('../integrations/niri/probe-material', import.meta.url));
  const pidFile = path.join(dir, 'niri.pid');
  const tmp = path.join(dir, 'probe-tmp');
  fs.mkdirSync(tmp);

  // A niri that answers --version at once but never returns from validate.
  fs.writeFileSync(path.join(dir, 'bin', 'niri'), `#!/bin/sh
if [ "$1" = "--version" ]; then
  echo "niri 26.04 (fake)"
  exit 0
fi
echo $$ > "$NIRI_FAKE_PIDFILE"
exec sleep 60
`, { mode: 0o755 });

  const started = Date.now();
  const result = spawnSync(probe, [], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${path.join(dir, 'bin')}:${process.env.PATH}`,
           NIRI_FAKE_PIDFILE: pidFile, TMPDIR: tmp },
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /does not accept the config prism emits \(installed: niri 26\.04 \(fake\)\)/);
  assert.ok(Date.now() - started < 5_000, 'the probe must return inside the outer bound');

  const hung = Number(fs.readFileSync(pidFile, 'utf8').trim());
  assert.throws(() => process.kill(hung, 0), /ESRCH/,
    'the probe must not leave the command it was waiting on running');
  assert.deepEqual(fs.readdirSync(tmp), [],
    'the probe must remove the config it wrote');
});

test('a noctalia-driven ring lights in the palette accent the apply reads', (t) => {
  const { dir, target, run, calls, writeParams } = fixture(t);
  writeParams({ 'glass.ring.colorSource': 'noctalia' });
  const colors = path.join(dir, 'colors.json');
  fs.writeFileSync(colors, JSON.stringify({ mPrimary: '#a1b2c3' }));

  const result = run({ PRISM_NOCTALIA_COLORS: colors });

  assert.equal(result.status, 0, result.stderr);
  const kdl = fs.readFileSync(target, 'utf8');
  assert.match(kdl, /ring-color "#a1b2c3"/);
  assert.match(kdl, /accent "none"/, 'no second driver may tint the ring');
  assert.deepEqual(calls(), ['validate', 'msg action load-config-file']);
});

test('a noctalia-driven ring rests on the manual color while no palette exists', (t) => {
  const { dir, target, run, writeParams } = fixture(t);
  writeParams({ 'glass.ring.colorSource': 'noctalia' });

  const result = run({ PRISM_NOCTALIA_COLORS: path.join(dir, 'absent.json') });

  assert.equal(result.status, 0, result.stderr);
  assert.match(fs.readFileSync(target, 'utf8'), /ring-color "#f2c14e"/);
});

test('a palette that does not parse fails the apply before anything is written', (t) => {
  const { dir, target, run, calls, writeParams } = fixture(t);
  writeParams({ 'glass.ring.colorSource': 'noctalia' });
  const colors = path.join(dir, 'colors.json');
  fs.writeFileSync(colors, '{ not json');

  const result = run({ PRISM_NOCTALIA_COLORS: colors });

  assert.notEqual(result.status, 0, 'a broken palette must fail the sink');
  assert.match(result.stderr, /colors\.json: not valid JSON/);
  assert.equal(fs.existsSync(target), false, 'the failed render must leave no target');
  assert.deepEqual(calls(), [], 'niri is never asked to validate');
});

test('a palette without a primary fails the apply', (t) => {
  const { dir, run, writeParams } = fixture(t);
  writeParams({ 'glass.ring.colorSource': 'noctalia' });
  const colors = path.join(dir, 'colors.json');
  fs.writeFileSync(colors, JSON.stringify({ mSurface: '#13140f' }));

  const result = run({ PRISM_NOCTALIA_COLORS: colors });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /mPrimary missing or not a #rrggbb color/);
});

test('a familiar-driven ring never reads the palette file', (t) => {
  const { dir, target, run, writeParams } = fixture(t);
  writeParams({ 'glass.ring.colorSource': 'familiar' });
  const colors = path.join(dir, 'colors.json');
  fs.writeFileSync(colors, '{ not json');

  const result = run({ PRISM_NOCTALIA_COLORS: colors });

  assert.equal(result.status, 0, result.stderr);
  const kdl = fs.readFileSync(target, 'utf8');
  assert.match(kdl, /accent "ring"/);
  assert.match(kdl, /ring-color "#f2c14e"/);
});

test('a broken palette does not block an apply with the glass off', (t) => {
  const { dir, target, run, calls, writeParams } = fixture(t);
  writeParams({ 'glass.enabled': false, 'glass.ring.colorSource': 'noctalia' });
  const colors = path.join(dir, 'colors.json');
  fs.writeFileSync(colors, '{ not json');

  const result = run({ PRISM_NOCTALIA_COLORS: colors });

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(fs.readFileSync(target, 'utf8'), /material/,
    'no ring is emitted for the palette to drive');
  assert.deepEqual(calls(), ['validate', 'msg action load-config-file']);
});
