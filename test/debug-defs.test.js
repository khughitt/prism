import test from 'node:test';
import assert from 'node:assert/strict';
import { loadDefs } from '../src/defs.js';
import { loadManifests } from '../src/manifest.js';
import { defsDir, integrationsDir } from '../src/paths.js';

test('debug.backdrop is one live CLI-only switch outside the native glass grammar', () => {
  const defs = loadDefs(defsDir());
  const manifests = loadManifests(integrationsDir(), defs);
  const def = defs.get('debug.backdrop');

  assert.deepEqual(
    { type: def?.type, default: def?.default, ui: def?.ui, description: def?.description },
    {
      type: 'bool',
      default: false,
      ui: { group: 'Debug', control: 'none' },
      description: 'Cover the wallpaper with a checkerboard so refraction is visible (CLI only)',
    },
  );

  assert.deepEqual(
    manifests
      .filter((manifest) => manifest.binds.some((bind) => bind.param === 'debug.backdrop'))
      .map((manifest) => ({ sink: manifest.sink, binds: manifest.binds, generates: manifest.generates })),
    [{
      sink: 'debug-backdrop',
      binds: [{ param: 'debug.backdrop', liveness: 'live' }],
      generates: [],
    }],
  );
});
