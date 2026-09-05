import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const pluginDir = new URL('./', import.meta.url);

test('v5 manifest declares the Prism widget and panel only', async () => {
  const parsed = spawnSync('python3', [
    '-c',
    'import json, sys, tomllib; print(json.dumps(tomllib.load(open(sys.argv[1], "rb"))))',
    fileURLToPath(new URL('plugin.toml', pluginDir)),
  ], { encoding: 'utf8' });

  assert.equal(parsed.status, 0, parsed.stderr);
  const manifest = JSON.parse(parsed.stdout);
  assert.equal(manifest.id, 'khughitt/prism');
  assert.equal(manifest.plugin_api, 22);
  assert.ok(manifest.plugin_api <= 23);
  assert.deepEqual(manifest.dependencies, ['prism']);
  assert.deepEqual(manifest.widget, [{ id: 'widget', entry: 'widget.luau' }]);
  assert.deepEqual(manifest.panel, [{
    id: 'panel',
    entry: 'panel.luau',
    width: 756,
    height: 798,
    placement: 'attached',
    position: 'auto',
  }]);
  assert.equal(manifest.setting, undefined);

  await Promise.all(['widget.luau', 'panel.luau'].map((file) => access(new URL(file, pluginDir))));
  await Promise.all([
    'manifest.json',
    'Main.qml',
    'BarWidget.qml',
    'Panel.qml',
    'ParamControl.qml',
    'PrismClient.qml',
    'presentation.mjs',
    'queue.mjs',
  ].map(async (file) => {
    await assert.rejects(access(new URL(file, pluginDir)), { code: 'ENOENT' });
  }));
});
