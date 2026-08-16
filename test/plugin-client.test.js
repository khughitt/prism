import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../integrations/noctalia-plugin/PrismClient.qml', import.meta.url), 'utf8');
const panel = await readFile(new URL('../integrations/noctalia-plugin/Panel.qml', import.meta.url), 'utf8');
const control = await readFile(new URL('../integrations/noctalia-plugin/ParamControl.qml', import.meta.url), 'utf8');

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

test('panel groups parameters and replaces root-local expansion state explicitly', () => {
  assert.match(panel, /property var expandedGroups: \(\{\}\)/);
  assert.match(panel, /function setGroupExpanded\(name, expanded\)/);
  assert.match(panel, /root\.expandedGroups = next/);
  assert.doesNotMatch(panel, /expandedGroups\[[^\]]+\]\s*=(?!=)/);
  assert.match(panel, /Presentation\.groupParams\(model\.params\)/);
});

test('advanced headers use a passive chevron and quiet icon reset', () => {
  const start = panel.indexOf('id: groupHeader');
  const header = panel.slice(start, panel.indexOf('ColumnLayout {', start));

  assert.match(header, /NIcon\s*\{[\s\S]*icon: groupSurface\.expanded \? "chevron-down" : "chevron-right"/);
  assert.match(header, /NText\s*\{[\s\S]*text: groupSurface\.modelData\.name/);
  assert.match(header, /NIconButton\s*\{[\s\S]*visible: groupSurface\.modifiedCount > 0[\s\S]*icon: "restore"[\s\S]*onClicked: root\.resetGroup\(groupSurface\.groupParams\)/);
  assert.doesNotMatch(header, /\bNButton\s*\{/);
});

test('parameter rows use presentation metadata and one Prism reset action', () => {
  assert.match(control, /readonly property bool liveDrag: param\.effectiveDrag === "live"/);
  assert.match(control, /showReset: false/);
  assert.match(control, /tooltipText: "Reset to default"/);
  assert.equal(control.match(/tooltipText: "Reset to default"/g)?.length, 1);
  assert.match(control, /Presentation\.formatValue\(value, stepSize\)/);
});

test('a sample-only drain does not refresh and replace the pressed slider', () => {
  const writeDone = source.slice(source.indexOf('function writeDone'), source.indexOf('Process {'));

  assert.match(writeDone, /var completedSample = Queue\.isSample\(queue\.inFlight\);\s*var result = Queue\.finish\(queue\);/);
  assert.match(writeDone, /else if \(result\.drained\) \{\s*drained\(\);\s*if \(!completedSample\) \{\s*refresh\(\);\s*\}/);
});

test('slider commits keyboard and wheel moves without changing pointer drag behavior', () => {
  assert.match(control, /property bool pointerPressed: false/);
  assert.doesNotMatch(control, /onTriggered: client\.set\(param\.key, valueSlider\.value, false\)/);
  assert.match(control, /property real pendingValue: 0/);
  assert.match(control, /id: commitGate\s*interval: 100\s*repeat: false\s*onTriggered: sendSlider\(valueSlider\.pendingValue, false\)/);
  assert.match(control, /onMoved: function\(value\) \{\s*if \(pointerPressed\) \{\s*if \(liveDrag && !sampleGate\.running\)/);
  assert.match(control, /\} else \{\s*pendingValue = value;\s*commitGate\.restart\(\);\s*\}\s*\}/);
  assert.match(control, /onPressedChanged: function\(pressed, value\) \{\s*pointerPressed = pressed;\s*commitGate\.stop\(\);\s*if \(!pressed\) \{\s*sendSlider\(value, false\);/);
});

test('slider flushes a pending keyboard or wheel write before destruction', () => {
  const slider = control.slice(control.indexOf('NValueSlider {'), control.indexOf('NToggle {'));

  assert.match(slider, /Component\.onDestruction: \{\s*if \(commitGate\.running\) \{\s*commitGate\.stop\(\);\s*sendSlider\(valueSlider\.pendingValue, false\);\s*\}\s*\}/);
});

test('every slider write uses the quantizing helper', () => {
  const helper = control.slice(control.indexOf('function sendSlider'), control.indexOf('function selectOptions'));
  const slider = control.slice(control.indexOf('NValueSlider {'), control.indexOf('NToggle {'));

  assert.match(helper, /client\.set\(param\.key, Presentation\.quantizeValue\(value, stepSize\), sample\)/);
  assert.doesNotMatch(slider, /client\.set\(param\.key,/);
  assert.equal(slider.match(/sendSlider\(/g)?.length, 4);
});
