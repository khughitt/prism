import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../integrations/noctalia-plugin/PrismClient.qml', import.meta.url), 'utf8');
const panel = await readFile(new URL('../integrations/noctalia-plugin/Panel.qml', import.meta.url), 'utf8');
const control = await readFile(new URL('../integrations/noctalia-plugin/ParamControl.qml', import.meta.url), 'utf8');
const bar = await readFile(new URL('../integrations/noctalia-plugin/BarWidget.qml', import.meta.url), 'utf8');

test('describe refresh requests made in flight are coalesced and replayed after exit', () => {
  assert.match(source, /property bool refreshPending: false/);
  assert.match(source, /if \(describeProcess\.running\) \{\s*refreshPending = true;\s*return;/);
  assert.match(source, /function finishRefresh\(\) \{\s*if \(refreshPending\) \{\s*refreshPending = false;\s*describeProcess\.running = true;/);

  const describeProcess = source.slice(source.indexOf('id: describeProcess'), source.indexOf('id: writeProcess'));
  assert.doesNotMatch(describeProcess, /\breturn;/, 'every describe exit path must reach the replay');
  assert.equal(describeProcess.match(/root\.finishRefresh\(\);/g)?.length, 1);
});

test('bar widget matches Noctalia native capsule contract', () => {
  assert.match(bar, /import qs\.Services\.UI/);
  assert.match(bar, /baseSize: Style\.getCapsuleHeightForScreen\(screen\?\.name\)/);
  assert.match(bar, /applyUiScale: false/);
  assert.match(bar, /customRadius: Style\.radiusL/);
  assert.match(bar, /icon: "wand"/);
  assert.match(bar, /colorBg: Style\.capsuleColor/);
  assert.match(bar, /colorFg: Color\.mOnSurface/);
  assert.match(bar, /colorBgHover: Color\.mHover/);
  assert.match(bar, /colorFgHover: Color\.mOnHover/);
  assert.match(bar, /colorBorder: "transparent"/);
  assert.match(bar, /colorBorderHover: "transparent"/);
  assert.match(bar, /border\.color: Style\.capsuleBorderColor/);
  assert.match(bar, /border\.width: Style\.capsuleBorderWidth/);
  assert.match(bar, /tooltipDirection: BarService\.getTooltipDirection\(screen\?\.name\)/);
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
  assert.match(panel, /root\.titleSetting = Presentation\.titleParam\(model\.params\)/);
  assert.match(panel, /root\.groups = Presentation\.groupParams\(model\.params\)/);
});

test('panel extracts the title toggle without naming its parameter key', () => {
  assert.match(panel, /property var titleSetting: null/);
  assert.match(panel, /root\.titleSetting = Presentation\.titleParam\(model\.params\)/);
  assert.match(panel, /root\.client\.set\(root\.titleSetting\.key, checked, false\)/);
  assert.doesNotMatch(panel, /glass\.enabled/);
});

test('basic controls start directly below the title and use compact type', () => {
  assert.doesNotMatch(panel, /text: "Quick"/);
  assert.match(panel, /text: "Prism"[\s\S]*pointSize: Style\.fontSizeL/);
  assert.match(control, /id: parameterLabel[\s\S]*pointSize: Style\.fontSizeM/);
  assert.match(control, /id: parameterDescription[\s\S]*pointSize: Style\.fontSizeS/);
  assert.match(control, /textSize: Style\.fontSizeS/);
});

test('panel keeps preview controls stable and clear of the scrollbar', () => {
  assert.doesNotMatch(panel, /reserveScrollbarSpace: false/);
  assert.match(panel, /userRightPadding: Style\.marginS/);
  assert.match(panel, /ColumnLayout \{\s*visible: groupSurface\.modelData\.name === "Diagnostics"/);
  assert.doesNotMatch(panel, /RowLayout \{\s*visible: groupSurface\.modelData\.name === "Diagnostics"/);
});

test('controls update local display state before writing', () => {
  assert.match(control, /property var displayedValue: param\.value/);
  assert.match(control, /value: root\.displayedValue/);
  assert.match(control, /root\.displayedValue = value;[\s\S]*sendSlider\(value,/);
  assert.match(control, /root\.displayedValue = checked;[\s\S]*root\.client\.set\(root\.param\.key, checked, false\)/);
  assert.match(control, /root\.displayedValue = key;[\s\S]*root\.client\.set\(root\.param\.key, key, false\)/);
  assert.match(control, /root\.displayedValue = hex;[\s\S]*root\.client\.set\(root\.param\.key, hex, false\)/);
});

test('hint and reset share the trailing edge of the control row', () => {
  const row = control.slice(control.indexOf('id: controlRow'));
  const hintAt = row.indexOf('id: livenessHint');
  const resetAt = row.indexOf('id: resetButton');
  assert.ok(hintAt >= 0 && resetAt > hintAt);
  assert.match(row.slice(hintAt, resetAt), /pointSize: Style\.fontSizeXS/);
  assert.match(row.slice(resetAt), /baseSize: Style\.baseWidgetSize \* 0\.6/);
});

test('Prism owns the sole per-parameter modified indicator', () => {
  assert.doesNotMatch(control, /defaultValue:/);
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
  assert.match(control, /Presentation\.formatValue\(root\.displayedValue, root\.stepSize\)/);
});

test('drain refresh uses the parameter-write and non-sample-tail conjunction', () => {
  const writeDone = source.slice(source.indexOf('function writeDone'), source.indexOf('Process {'));

  assert.match(source, /property bool batchAffectsParams: false/);
  assert.match(source, /batchAffectsParams = batchAffectsParams \|\| Queue\.affectsParams\(item\)/);
  assert.match(writeDone, /var shouldRefresh = Queue\.shouldRefresh\(batchAffectsParams, queue\.inFlight\);\s*var result = Queue\.finish\(queue\);/);
  assert.match(writeDone, /else if \(result\.drained\) \{\s*batchAffectsParams = false;\s*drained\(\);\s*if \(shouldRefresh\) refreshAfterDrag = true;\s*if \(!sliderPressed && refreshAfterDrag\) \{\s*refreshAfterDrag = false;\s*refresh\(\);\s*\}\s*\}/);
});

test('a pressed slider defers reconciliation until its release write drains', () => {
  assert.match(source, /property bool sliderPressed: false/);
  assert.match(source, /property bool refreshAfterDrag: false/);
  assert.match(source, /function setSliderPressed\(pressed\) \{\s*sliderPressed = pressed;\s*\}/);

  assert.match(control, /onPressedChanged: function\(pressed, value\) \{\s*pointerPressed = pressed;\s*if \(pressed\) root\.client\.setSliderPressed\(true\);[\s\S]*if \(!pressed\) \{[\s\S]*sendSlider\(value, false\);\s*root\.client\.setSliderPressed\(false\);/);
  assert.match(control, /Component\.onDestruction:[\s\S]*if \(pointerPressed\) root\.client\.setSliderPressed\(false\)/);

  const describeExit = source.slice(source.indexOf('id: describeProcess'), source.indexOf('id: writeProcess'));
  assert.match(describeExit, /if \(root\.sliderPressed\) \{\s*root\.refreshAfterDrag = true;\s*\} else \{[\s\S]*root\.described\(model\);\s*\}/);
});

test('client and panel expose panel-local preview controls', () => {
  assert.match(source, /function showPreview\(output, side, diagnosticBackground\)/);
  assert.match(source, /function hidePreview\(\)/);
  assert.match(panel, /property bool previewVisible: false/);
  assert.match(panel, /property bool diagnosticBackground: false/);
  assert.match(panel, /Component\.onDestruction: if \(root\.client\) root\.client\.hidePreview\(\)/);
  assert.match(panel, /modelData\.name === "Diagnostics"/);
  assert.doesNotMatch(panel, /glass\.enabled/);
});

test('slider commits keyboard and wheel moves without changing pointer drag behavior', () => {
  assert.match(control, /property bool pointerPressed: false/);
  assert.doesNotMatch(control, /onTriggered: client\.set\(param\.key, valueSlider\.value, false\)/);
  assert.match(control, /property real pendingValue: 0/);
  assert.match(control, /id: commitGate\s*interval: 100\s*repeat: false\s*onTriggered: sendSlider\(valueSlider\.pendingValue, false\)/);
  assert.match(control, /onMoved: function\(value\) \{\s*root\.displayedValue = value;\s*if \(pointerPressed\) \{\s*if \(liveDrag && !sampleGate\.running\)/);
  assert.match(control, /\} else \{\s*pendingValue = value;\s*commitGate\.restart\(\);\s*\}\s*\}/);
  assert.match(control, /onPressedChanged: function\(pressed, value\) \{\s*pointerPressed = pressed;\s*if \(pressed\) root\.client\.setSliderPressed\(true\);\s*commitGate\.stop\(\);\s*if \(!pressed\) \{\s*root\.displayedValue = value;\s*sendSlider\(value, false\);\s*root\.client\.setSliderPressed\(false\);/);
});

test('slider flushes a pending keyboard or wheel write before destruction', () => {
  const slider = control.slice(control.indexOf('NValueSlider {'), control.indexOf('NToggle {'));

  assert.match(slider, /Component\.onDestruction: \{\s*if \(pointerPressed\) root\.client\.setSliderPressed\(false\);\s*if \(commitGate\.running\) \{\s*commitGate\.stop\(\);\s*sendSlider\(valueSlider\.pendingValue, false\);\s*\}\s*\}/);
});

test('every slider write uses the quantizing helper', () => {
  const helper = control.slice(control.indexOf('function sendSlider'), control.indexOf('function selectOptions'));
  const slider = control.slice(control.indexOf('NValueSlider {'), control.indexOf('NToggle {'));

  assert.match(helper, /client\.set\(param\.key, Presentation\.quantizeValue\(value, stepSize\), sample\)/);
  assert.doesNotMatch(slider, /client\.set\(param\.key,/);
  assert.equal(slider.match(/sendSlider\(/g)?.length, 4);
});
