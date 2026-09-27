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

  // Opening is a fresh gesture: it drops a sticky command error from a previous
  // session before re-reading, since the Luau runtime survives a close.
  assert.match(source, /function onOpen\(context\)\n  state\.errorText = nil\n  state\.errorSticky = false\n  state\.ticks = 0\n  panel\.setWantsSecondTicks\(true\)\n  refresh\(\)\nend/);
  assert.match(source, /function onClose\(\)[\s\S]*state\.drag = nil[\s\S]*state\.sampleElapsedMs = 0[\s\S]*panel\.setNeedsFrameTick\(false\)/);
  // Closing the panel has no backend action: there is no preview to tear down.
  const onClose = source.slice(source.indexOf('function onClose()'));
  assert.doesNotMatch(onClose.slice(0, onClose.indexOf('end')), /enqueue|run\(/);
  // A native slider can fire onChange far more often than the panel can
  // afford to rebuild its tree, whatever the parameter's effectiveDrag; the
  // tick flushes at most one render per frame instead of one per event.
  assert.match(source, /function onFrameTick\(deltaMs\)\n  if not state\.drag then return end\n  if state\.drag\.dirty then[\s\S]*render\(\)[\s\S]*if not state\.drag\.pendingSample then return end[\s\S]*state\.sampleElapsedMs = state\.sampleElapsedMs \+ deltaMs[\s\S]*state\.sampleElapsedMs < 100[\s\S]*enqueue\(state\.drag\.pendingSample\)[\s\S]*state\.drag\.pendingSample = nil/);

  const liveDrag = source.slice(source.indexOf('local function beginDrag'), source.indexOf('local function endDrag'));
  // Every drag requests ticks now, not only live-mode ones: it is what
  // throttles the render, not only the live-mode sample write.
  assert.match(liveDrag, /panel\.setNeedsFrameTick\(true\)/);
  assert.match(liveDrag, /state\.drag\.dirty = true/);
  assert.doesNotMatch(liveDrag, /render\(\)/);
  assert.equal(source.match(/panel\.setNeedsFrameTick\(true\)/g)?.length, 1);
});

test('describe refresh validates visible parameters and discards stale results', async () => {
  const source = await readEntry('panel.luau');

  for (const field of ['key', 'value', 'default', 'layer', 'fallback', 'control', 'group']) {
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
  // The completed item drives the refresh decision before Queue.finish rotates it out.
  assert.match(source, /local completed = state\.queue\.inFlight\n  local shouldRefresh = Queue\.shouldRefresh\(state\.batchAffectsParams, completed\)/);
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
  const parameterRow = source.slice(source.indexOf('local function controlCell'), source.indexOf('local function singleRow'));

  assert.match(parameterRow, /local formattedValue = param\.ui\.control == "slider" and Presentation\.formatValue\(param\.value, param\) or nil/);
  // Reserved on every row, empty text included: a hidden child leaves the flex
  // layout and pulls the control column left on rows without a value.
  assert.match(parameterRow, /ui\.row\(\{width = valueColumnWidth[\s\S]*ui\.label\(\{text = formattedValue or ""[\s\S]*nativeControl\(param, available\)/);
  assert.doesNotMatch(parameterRow, /visible = formattedValue ~= nil/);
  assert.match(source, /local function beginDrag[\s\S]*updateParam\(param, canonical\)[\s\S]*render\(\)/);
});

test('presentation renders every section open with a header toggle, matrix rows, and resets', async () => {
  const source = await readEntry('panel.luau');

  assert.match(source, /Presentation\.titleParam\(state\.model\.params\)/);
  assert.match(source, /Presentation\.sections\(state\.model\.params, rack\.group\)/);
  assert.doesNotMatch(source, /expandedGroups|groupParams|Quick/);
  assert.match(source, /Presentation\.editedCount\(params\)/);
  assert.match(source, /local function matrixRow\(row, indent\)[\s\S]*controlCell\(row\.unfocused, 1\)[\s\S]*controlCell\(row\.focused, 1\)/);
  assert.match(source, /text = "Unfocused"[\s\S]*text = "Focused"/);
  assert.match(source, /local function resetAction[\s\S]*enqueue\(\{verb = "reset", mode = mode, group = group\}\)/);
  assert.match(source, /tooltip = param\.edited and "Revert edit"/);
  assert.match(source, /resetModeButtons\("section", name, sectionParams\)/);
  assert.match(source, /tooltip = param\.description or param\.key/);
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

  // What replaced it: live terminals. Rows mark only what is exceptional -
  // writing on release is the norm here and goes unsaid.
  assert.doesNotMatch(source, /On release/);
  // One row can hold two parameters on different layers, so the hint is chosen
  // across the row in a fixed precedence: an unavailable consumer, then
  // wallpaper provenance, then the mild Live marker.
  assert.match(source, /local function rowHint[\s\S]*text = "Unavailable"[\s\S]*text = "wallpaper"[\s\S]*text = "Live"/);
});

test('row geometry is fixed, so nothing moves when a value crosses its default', async () => {
  const source = await readEntry('panel.luau');

  // Every reset stays in the tree; its state is opacity, not presence.
  assert.doesNotMatch(source, /visible = param\.edited|visible = editedCount > 0/);
  assert.match(source, /opacity = param\.edited and 1\.0 or inertOpacity/);
  assert.match(source, /opacity = spec\.count > 0 and 1\.0 or inertOpacity/);
  // One reserved leading span, shared by the rows and the matrix header, so the
  // header reserves the same leading span as the name controls.
  assert.match(source, /local function headCell[\s\S]*ui\.row\(\{width = headColumnWidth/);
  assert.match(source, /local function matrixHeader[\s\S]*ui\.spacer\(\{width = headColumnWidth, flexGrow = 0\}\)/);
  // The header mirrors matrixRow's children, so each title sits over its cell.
  assert.match(source, /local function matrixHeader[\s\S]*text = "Unfocused"[\s\S]*ui\.separator\(\{orientation = "vertical", spacing = 4\}\)[\s\S]*text = "Focused"/);
  // Sliders take the cell's slack, so both matrix halves end flush.
  assert.match(source, /ui\.slider\(\{[\s\S]*flexGrow = 1/);
});

test('the queue speaks only to prism', async () => {
  const source = await readEntry('queue.luau');

  assert.match(source, /if item\.verb == "set" then return \{ "prism", "set", item\.key, tostring\(item\.value\) \} end/);
  assert.match(source, /if item\.verb == "unset" then return \{ "prism", "unset", item\.key \} end/);
  assert.match(source, /if item\.verb == "clear" then return withExpected\(\{ "prism", "context", "clear", "wallpaper", item\.id \}, item\) end/);
  assert.match(source, /if item\.verb == "commit" then/);
  assert.match(source, /error\("unknown queue verb: "/);
  assert.doesNotMatch(source, /preview|niri-glass|prismGlass|"qs"/);
  // Commits and clears write no parameter but move the resolved values or what
  // the layers hold, so each must leave the model stale and force a re-read.
  assert.match(source, /local staleAfter = \{\n  set = true, unset = true, reset = true, commit = true, clear = true,\n  activate = true, deactivate = true, delete = true, rename = true,\n\}/);
  assert.match(source, /function M\.affectsParams\(item\)\n  return staleAfter\[item\.verb\] == true\nend/);
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
