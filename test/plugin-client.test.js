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

test('panel lifecycle owns refresh, preview cleanup, and live-drag frame ticks', async () => {
  const source = await readEntry('panel.luau');

  assert.match(source, /function onOpen\(context\) refresh\(\) end/);
  assert.match(source, /function onClose\(\)[\s\S]*state\.drag = nil[\s\S]*state\.sampleElapsedMs = 0[\s\S]*panel\.setNeedsFrameTick\(false\)[\s\S]*enqueue\(\{verb = "preview-hide"\}\)/);
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

test('presentation grouping keeps Quick open and exposes group and row resets', async () => {
  const source = await readEntry('panel.luau');

  assert.match(source, /Presentation\.titleParam\(state\.model\.params\)/);
  assert.match(source, /Presentation\.groupParams\(state\.model\.params\)/);
  assert.match(source, /group\.name == "Quick" or state\.expandedGroups\[group\.name\] == true/);
  assert.match(source, /Presentation\.modifiedCount\(group\.params\)/);
  assert.match(source, /local function resetGroup[\s\S]*if param\.modified then[\s\S]*unsetParam\(param\)/);
  assert.match(source, /tooltip = "Reset to default"/);
});

test('preview is output-scoped, left-sided, and keeps contextual controls usable', async () => {
  const source = await readEntry('panel.luau');

  assert.match(source, /noctalia\.state\.get\("originOutput"\)/);
  assert.match(source, /if output == nil then output = noctalia\.focusedOutputName\(\) end/);
  assert.match(source, /verb = "preview-show", output = output, side = "left"/);
  assert.match(source, /ui\.affectsPreview ~= true/);
  assert.match(source, /text = "Not in preview"/);
  assert.match(source, /opacity = notInPreview and 0\.55 or 1/);
  assert.match(source, /text = "Preview"/);
  assert.match(source, /text = "Diagnostic background"/);
});

test('errors and unavailable controls are visible without legacy or opposite-side paths', async () => {
  const source = await readEntry('panel.luau');

  assert.match(source, /errorText = nil/);
  assert.match(source, /text = state\.errorText/);
  assert.match(source, /text = "Unavailable"/);
  assert.doesNotMatch(source, /oppositeSide|manifest\.json|\.qml/);
});
