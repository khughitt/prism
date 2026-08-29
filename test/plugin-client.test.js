import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const plugin = new URL('../integrations/noctalia-plugin/', import.meta.url);
const readEntry = (name) => readFile(new URL(name, plugin), 'utf8');

test('widget stores its output before toggling the fully qualified panel', async () => {
  const source = await readEntry('widget.luau');
  const outputAt = source.indexOf('barWidget.outputName()');
  const storeAt = source.indexOf('noctalia.state.set("originOutput", output)');
  const toggleAt = source.indexOf('noctalia.togglePanel("khughitt/prism:panel")');

  assert.ok(outputAt >= 0 && storeAt > outputAt && toggleAt > storeAt);
  assert.match(source, /barWidget\.setGlyph\("wand"\)/);
  assert.doesNotMatch(source, /screen|oppositeSide/);
});

test('panel consumes the Task 2 modules and runs argv through the shell boundary', async () => {
  const source = await readEntry('panel.luau');

  assert.match(source, /require\("\.\/presentation\.luau"\)/);
  assert.match(source, /require\("\.\/queue\.luau"\)/);
  assert.match(source, /require\("\.\/shell\.luau"\)/);
  assert.match(source, /local function run\(argv, callback\)[\s\S]*noctalia\.runAsync\(Shell\.command\(argv\), callback, 10000\)/);
  assert.equal(source.match(/noctalia\.runAsync\(/g)?.length, 1);
  assert.doesNotMatch(source, /noctalia\.runAsync\(\s*["']/);
});

test('panel lifecycle owns refresh, drag cleanup, and live-drag frame ticks', async () => {
  const source = await readEntry('panel.luau');

  assert.match(source, /function onOpen\(context\) refresh\(\) end/);
  assert.match(source, /function onClose\(\)[\s\S]*state\.drag = nil[\s\S]*state\.sampleElapsedMs = 0[\s\S]*panel\.setNeedsFrameTick\(false\)/);
  // Closing the panel has no backend action: there is no preview to tear down.
  const onClose = source.slice(source.indexOf('function onClose()'));
  assert.doesNotMatch(onClose.slice(0, onClose.indexOf('end')), /enqueue|run\(/);
  assert.match(source, /function onFrameTick\(deltaMs\)[\s\S]*if not state\.drag or not state\.drag\.pendingSample then return end[\s\S]*state\.sampleElapsedMs = state\.sampleElapsedMs \+ deltaMs[\s\S]*state\.sampleElapsedMs < 100[\s\S]*enqueue\(state\.drag\.pendingSample\)[\s\S]*state\.drag\.pendingSample = nil/);

  const liveDrag = source.slice(source.indexOf('local function beginDrag'), source.indexOf('local function endDrag'));
  assert.match(liveDrag, /effectiveDrag == "live"[\s\S]*panel\.setNeedsFrameTick\(true\)/);
  assert.equal(source.match(/panel\.setNeedsFrameTick\(true\)/g)?.length, 1);
});

test('describe refresh validates visible parameters and discards stale results', async () => {
  const source = await readEntry('panel.luau');

  for (const field of ['key', 'value', 'default', 'modified', 'control', 'group']) {
    assert.match(source, new RegExp(`param(?:\\.ui)?\\.${field}`));
  }
  assert.match(source, /type\(model\.params\) ~= "table"/);
  assert.match(source, /state\.describeInvalidated/);
  assert.match(source, /state\.refreshAfterDrag = true/);
  assert.match(source, /if invalidated[\s\S]*state\.model = model/);
  assert.match(source, /noctalia\.json\.decode\(result\.stdout\)/);
  assert.match(source, /timedOut/);
  assert.match(source, /exitCode ~= 0/);
});

test('pending refreshes wait for drag release and an idle write queue', async () => {
  const source = await readEntry('panel.luau');
  const finishRefresh = source.slice(
    source.indexOf('local function finishRefresh'),
    source.indexOf('local function described'),
  );

  assert.match(finishRefresh, /if state\.drag or state\.queue\.inFlight ~= nil then return end/);
  assert.match(finishRefresh, /if state\.refreshPending or state\.refreshAfterDrag then[\s\S]*state\.refreshPending = false[\s\S]*state\.refreshAfterDrag = false[\s\S]*refresh\(\)/);
  assert.equal(finishRefresh.match(/refresh\(\)/g)?.length, 1);
});

test('queue is the sole serialization point and refreshes only after a completed batch', async () => {
  const source = await readEntry('panel.luau');

  assert.match(source, /Queue\.enqueue\(state\.queue, item\)/);
  assert.match(source, /Queue\.argvFor\(item\)/);
  assert.match(source, /Queue\.shouldRefresh\(state\.batchAffectsParams, state\.queue\.inFlight\)/);
  assert.match(source, /Queue\.finish\(state\.queue\)/);
  assert.match(source, /local next = Queue\.finish\(state\.queue\)[\s\S]*if next\.launch then[\s\S]*launch\(next\.launch\)[\s\S]*elseif next\.drained then/);
});

test('every native parameter control keeps its required write boundary', async () => {
  const source = await readEntry('panel.luau');

  assert.match(source, /ui\.toggle\(/);
  assert.match(source, /ui\.select\(/);
  assert.match(source, /ui\.slider\(/);
  assert.match(source, /ui\.button\(/);
  assert.match(source, /noctalia\.openColorPicker\(/);
  assert.match(source, /local available = param\.effectiveDrag ~= nil/);
  assert.match(source, /enabled = available/);
  assert.match(source, /pendingSample = \{verb = "set", key = param\.key, value = canonical, sample = true\}/);
  assert.match(source, /local function endDrag[\s\S]*enqueue\(\{verb = "set", key = param\.key, value = drag\.value, sample = false\}\)/);
  assert.match(source, /param\.effectiveDrag == "release"/);
});

test('slider release recognizes canonical keyboard and wheel steps before final commit', async () => {
  const source = await readEntry('panel.luau');
  const endDrag = source.slice(source.indexOf('local function endDrag'), source.indexOf('local function selectIndex'));

  assert.match(endDrag, /Presentation\.canonicalFromSliderStep\(drag\.sliderValue, drag\.originValue, param\)/);
  assert.match(endDrag, /updateParam\(param, canonical\)[\s\S]*enqueue\(\{verb = "set", key = param\.key, value = drag\.value, sample = false\}\)/);
  assert.match(source, /-- ponytail:.*5%.*interaction source/);
});

test('slider rows render the formatted local value beside the native control', async () => {
  const source = await readEntry('panel.luau');
  const parameterRow = source.slice(source.indexOf('local function parameterRow'), source.indexOf('local function appendGroup'));

  assert.match(parameterRow, /local formattedValue = param\.ui\.control == "slider" and Presentation\.formatValue\(param\.value, param\) or nil/);
  assert.match(parameterRow, /ui\.label\(\{text = formattedValue or ""[\s\S]*visible = formattedValue ~= nil\}\)[\s\S]*nativeControl\(param, available\)/);
  assert.match(source, /local function beginDrag[\s\S]*updateParam\(param, canonical\)[\s\S]*render\(\)/);
});

test('presentation grouping keeps Quick open and exposes group and row resets', async () => {
  const source = await readEntry('panel.luau');

  assert.match(source, /Presentation\.titleParam\(state\.model\.params\)/);
  assert.match(source, /Presentation\.groupParams\(state\.model\.params\)/);
  assert.match(source, /group\.name == "Quick" or state\.expandedGroups\[group\.name\] == true/);
  assert.match(source, /Presentation\.modifiedCount\(group\.params\)/);
  assert.match(source, /local function resetGroup[\s\S]*if param\.modified then[\s\S]*unsetParam\(param\)/);
  assert.match(source, /tooltip = "Reset to default"/);
});

test('the isolated preview surface is gone, leaving live terminals as feedback', async () => {
  const source = await readEntry('panel.luau');

  for (const gone of [
    /previewVisible/, /previewItem/, /setPreview/, /diagnosticBackground/,
    /diagnosticRows/, /preview-show/, /preview-hide/, /affectsPreview/,
    /Not in preview/, /Diagnostic background/, /originOutput/,
    /focusedOutputName/, /\bqs\b/,
  ]) {
    assert.doesNotMatch(source, gone, `panel still carries ${gone}`);
  }

  // What replaced it: the release hint on reload-bound rows, and nothing else.
  assert.match(source, /local releaseHint = param\.effectiveDrag == "release"/);
  assert.match(source, /text = "On release"[\s\S]*visible = releaseHint/);
});

test('the queue speaks only to prism', async () => {
  const source = await readEntry('queue.luau');

  assert.match(source, /if item\.verb == "set" then return \{ "prism", "set", item\.key, tostring\(item\.value\) \} end/);
  assert.match(source, /if item\.verb == "unset" then return \{ "prism", "unset", item\.key \} end/);
  assert.match(source, /error\("unknown queue verb: "/);
  assert.doesNotMatch(source, /preview|niri-glass|prismGlass|"qs"/);
  assert.match(source, /function M\.affectsParams\(item\)\n  return item\.verb == "set" or item\.verb == "unset"\n/);
});

test('the plugin describes native material control, not a separate preview', async () => {
  const manifest = await readEntry('plugin.toml');

  assert.doesNotMatch(manifest, /preview/i);
  assert.doesNotMatch(manifest, /"qs"/);
  assert.match(manifest, /dependencies = \["prism"\]/);
  assert.match(manifest, /description = "[^"]*native niri material[^"]*"/);
});

test('errors and unavailable controls are visible without legacy or opposite-side paths', async () => {
  const source = await readEntry('panel.luau');

  assert.match(source, /errorText = nil/);
  assert.match(source, /text = state\.errorText/);
  assert.match(source, /text = "Unavailable"/);
  assert.doesNotMatch(source, /oppositeSide|manifest\.json|\.qml/);
});
