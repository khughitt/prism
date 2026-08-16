import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../integrations/noctalia-plugin/PrismClient.qml', import.meta.url), 'utf8');
const panel = await readFile(new URL('../integrations/noctalia-plugin/Panel.qml', import.meta.url), 'utf8');

test('describe refresh requests made in flight are coalesced and replayed after exit', () => {
  assert.match(source, /property bool refreshPending: false/);
  assert.match(source, /if \(describeProcess\.running\) \{\s*refreshPending = true;\s*return;/);
  assert.match(source, /function finishRefresh\(\) \{\s*if \(refreshPending\) \{\s*refreshPending = false;\s*describeProcess\.running = true;/);

  const describeProcess = source.slice(source.indexOf('id: describeProcess'), source.indexOf('id: writeProcess'));
  assert.doesNotMatch(describeProcess, /\breturn;/, 'every describe exit path must reach the replay');
  assert.equal(describeProcess.match(/root\.finishRefresh\(\);/g)?.length, 1);
});

test('panel Connections use explicit signal handlers accepted by current QML', () => {
  assert.match(panel, /function onDescribed\(model\) \{/);
  assert.doesNotMatch(panel, /onDescribed:\s*function/);
});

test('a sample-only drain does not refresh and replace the pressed slider', () => {
  const writeDone = source.slice(source.indexOf('function writeDone'), source.indexOf('Process {'));

  assert.match(writeDone, /var completedSample = Queue\.isSample\(queue\.inFlight\);\s*var result = Queue\.finish\(queue\);/);
  assert.match(writeDone, /else if \(result\.drained\) \{\s*drained\(\);\s*if \(!completedSample\) \{\s*refresh\(\);\s*\}/);
});

test('slider commits keyboard and wheel moves without changing pointer drag behavior', () => {
  assert.match(panel, /property bool pointerPressed: false/);
  assert.doesNotMatch(panel, /onTriggered: client\.set\(modelData\.key, valueSlider\.value, false\)/);
  assert.match(panel, /property real pendingValue: 0/);
  assert.match(panel, /id: commitGate\s*interval: 100\s*repeat: false\s*onTriggered: client\.set\(modelData\.key, valueSlider\.pendingValue, false\)/);
  assert.match(panel, /onMoved: function\(value\) \{\s*if \(pointerPressed\) \{\s*if \(liveDrag && !sampleGate\.running\)/);
  assert.match(panel, /\} else \{\s*pendingValue = value;\s*commitGate\.restart\(\);\s*\}\s*\}/);
  assert.match(panel, /onPressedChanged: function\(pressed, value\) \{\s*pointerPressed = pressed;\s*commitGate\.stop\(\);\s*if \(!pressed\) \{\s*client\.set\(modelData\.key, value, false\);/);
});

test('slider flushes a pending keyboard or wheel write before destruction', () => {
  const slider = panel.slice(panel.indexOf('NValueSlider {'), panel.indexOf('NToggle {'));

  assert.match(slider, /Component\.onDestruction: \{\s*if \(commitGate\.running\) \{\s*commitGate\.stop\(\);\s*client\.set\(modelData\.key, valueSlider\.pendingValue, false\);\s*\}\s*\}/);
});
