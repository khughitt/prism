import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../integrations/noctalia-plugin/PrismClient.qml', import.meta.url), 'utf8');

test('describe refresh requests made in flight are coalesced and replayed after exit', () => {
  assert.match(source, /property bool refreshPending: false/);
  assert.match(source, /if \(describeProcess\.running\) \{\s*refreshPending = true;\s*return;/);
  assert.match(source, /function finishRefresh\(\) \{\s*if \(refreshPending\) \{\s*refreshPending = false;\s*describeProcess\.running = true;/);

  const describeProcess = source.slice(source.indexOf('id: describeProcess'), source.indexOf('id: writeProcess'));
  assert.doesNotMatch(describeProcess, /\breturn;/, 'every describe exit path must reach the replay');
  assert.equal(describeProcess.match(/root\.finishRefresh\(\);/g)?.length, 1);
});
