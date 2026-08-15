import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const pluginDir = new URL('./', import.meta.url);

test('manifest names prism and references each runtime entry point', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', pluginDir), 'utf8'));

  assert.deepEqual(manifest.entryPoints, {
    main: 'Main.qml',
    barWidget: 'BarWidget.qml',
    panel: 'Panel.qml',
  });
  assert.equal(manifest.id, 'prism');
  await Promise.all(Object.values(manifest.entryPoints).map((file) => access(new URL(file, pluginDir))));
});
