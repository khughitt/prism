import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { parse as parseYaml } from 'yaml';

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

const luaEscapes = { '\\': '\\\\', '"': '\\"', '\n': '\\n', '\r': '\\r', '\t': '\\t' };

// A Lua literal for what `noctalia.json.decode` would hand the panel: nulls
// become absent keys, the way a decoder into Lua tables has to render them.
function luaLiteral(value) {
  if (value === null || value === undefined) return 'nil';
  if (typeof value === 'boolean' || typeof value === 'number') return JSON.stringify(value);
  // Lua spells \u escapes with braces, so escape only what a Lua string must
  // escape and pass every other byte through as the UTF-8 it already is. A
  // decimal escape is padded to three digits, or a digit following it would be
  // read as part of the escape.
  if (typeof value === 'string') {
    return `"${value.replace(/[\\"\u0000-\u001f]/g, (c) =>
      luaEscapes[c] ?? `\\${String(c.charCodeAt(0)).padStart(3, '0')}`)}"`;
  }
  if (Array.isArray(value)) return `{${value.map(luaLiteral).join(',')}}`;
  return `{${Object.entries(value)
    .filter(([, held]) => held !== null && held !== undefined)
    .map(([key, held]) => `[${luaLiteral(key)}]=${luaLiteral(held)}`)
    .join(',')}}`;
}

const prismBin = fileURLToPath(new URL('../../bin/prism', pluginDir));

test('every queue argv shape reaches a CLI command rather than usage parsing', () => {
  const script = String.raw`
local Queue = dofile(arg[1])
local expected = { look = "default", wallpaper = "none" }
local items = {
  { verb = "set", key = "glass.ior", value = 1.6 },
  { verb = "unset", key = "glass.ior" },
  { verb = "reset", mode = "revert" },
  { verb = "reset", mode = "neutral", group = "Focus" },
  { verb = "commit", destination = "base", expected = expected },
  { verb = "commit", destination = "profile", target = "Saved", expected = expected },
  { verb = "commit", destination = "wallpaper", target = "w1", expected = expected },
  { verb = "clear", id = "w1", expected = expected },
  { verb = "activate", name = "Saved" },
  { verb = "deactivate" },
  { verb = "rename", name = "Saved", newName = "New", expected = expected },
  { verb = "delete", name = "Saved", expected = expected },
}
for _, item in ipairs(items) do print(table.concat(Queue.argvFor(item), "\t")) end
`;
  const generated = spawnSync('lua', ['-', fileURLToPath(new URL('queue.luau', pluginDir))],
    { input: script, encoding: 'utf8' });
  assert.equal(generated.status, 0, generated.stderr);
  const commands = generated.stdout.trim().split('\n').map((line) => line.split('\t'));
  assert.equal(commands.length, 12);
  const integrations = mkdtempSync(join(tmpdir(), 'prism-contract-integ-'));
  for (const argv of commands) {
    const configDir = mkdtempSync(join(tmpdir(), 'prism-contract-cfg-'));
    const stateDir = mkdtempSync(join(tmpdir(), 'prism-contract-state-'));
    writeFileSync(join(configDir, 'values.yaml'), '{}\n');
    const result = spawnSync(prismBin, argv.slice(1), { encoding: 'utf8',
      env: { ...process.env, PRISM_CONFIG_DIR: configDir, PRISM_STATE_DIR: stateDir,
        PRISM_INTEGRATIONS_DIR: integrations } });
    assert.doesNotMatch(result.stderr, /usage:|invalid expected|expected slots require|unknown kind|invalid context name/,
      `${argv.join(' ')}: ${result.stderr}`);
  }
});

// A store the CLI reads but no sink writes: describe is read-only, so the
// contexts can be laid down as files instead of driven through `prism set`.
function describeStore(contexts, exercise) {
  const configDir = mkdtempSync(join(tmpdir(), 'prism-contract-cfg-'));
  const stateDir = mkdtempSync(join(tmpdir(), 'prism-contract-state-'));
  // JSON is YAML, so the fixtures need no writer of their own.
  writeFileSync(join(configDir, 'values.yaml'), `${JSON.stringify(contexts.base ?? {})}\n`);
  for (const [name, values] of Object.entries(contexts.profiles ?? {})) {
    mkdirSync(join(configDir, 'contexts', 'profile'), { recursive: true });
    writeFileSync(join(configDir, 'contexts', 'profile', `${name}.yaml`), `${JSON.stringify(values)}\n`);
  }
  if (contexts.active) writeFileSync(join(stateDir, 'active.json'), JSON.stringify(contexts.active));

  const env = { ...process.env, PRISM_CONFIG_DIR: configDir, PRISM_STATE_DIR: stateDir,
    PRISM_INTEGRATIONS_DIR: mkdtempSync(join(tmpdir(), 'prism-contract-integ-')) };
  const run = (args) => spawnSync(prismBin, args, { encoding: 'utf8', env });
  if (exercise) exercise(run, configDir, stateDir);
  const result = run(['describe', '--json']);
  assert.equal(result.status, 0, result.stderr);
  const model = JSON.parse(result.stdout);
  for (const param of model.params) {
    assert.ok(Array.isArray(param.held), `${param.key} held`);
    if (param.ui.control === 'none') continue;
    assert.notEqual(Object.hasOwn(param, 'neutral'), Object.hasOwn(param, 'neutralize'),
      `${param.key} declares exactly one of neutral and neutralize`);
    if (Object.hasOwn(param, 'neutralize')) assert.equal(param.neutralize, false);
  }
  return model;
}

// Loads panel.luau against a model and reports what it did with it: the error
// text validateModel returned, and the control node each parameter row drew.
const harness = String.raw`
local pluginDir, models = arg[1], MODELS

local function collect(tree, found)
  found = found or {}
  if type(tree) ~= "table" then return found end
  if tree.kind ~= nil then found[#found + 1] = tree end
  for _, child in ipairs(tree.children or {}) do collect(child, found) end
  return found
end

local function inspect(model)
  local rendered
  local ui = setmetatable({}, {__index = function(_, kind)
    return function(props, children) return {kind = kind, props = props or {}, children = children or {}} end
  end})
  local panel = {render = function(tree) rendered = tree end, setNeedsFrameTick = function() end, setWantsSecondTicks = function() end}
  local described
  local noctalia = {
    json = {decode = function() return model end},
    runAsync = function(command, callback)
      if command:find("describe", 1, true) then described = callback end
      return true
    end,
  }
  local env = {noctalia = noctalia, panel = panel, ui = ui}
  setmetatable(env, {__index = _G})
  env.require = function(name)
    return assert(loadfile(pluginDir .. name:gsub("^%./", ""), "t", env))()
  end
  assert(loadfile(pluginDir .. "panel.luau", "t", env))()

  env.onOpen({})
  assert(described, "the panel never spawned prism describe")
  described({timedOut = false, exitCode = 0, stdout = "{}", stderr = "",
    stdoutTruncated = false, stderrTruncated = false})

  -- Every card starts collapsed; the contract is that each control kind can
  -- be drawn, so open them all before reading the rows.
  for _, node in ipairs(collect(rendered)) do
    if node.kind == "button" and node.props.tooltip == "Show details" then node.props.onClick() end
  end

  -- render() puts the error label first and hides it when there is nothing to
  -- say, so its text is exactly what validateModel returned.
  local errorLabel = rendered.children[1]
  local report = {error = errorLabel.props.visible and errorLabel.props.text or nil, cells = {}, labels = {}}
  local byKey = {}
  for _, param in ipairs(model.params) do byKey[param.key] = true end
  for _, node in ipairs(collect(rendered)) do
    if node.kind == "label" and node.props.text then report.labels[node.props.text] = true end
    -- controlCell keys its row with the bare parameter key; the row column and
    -- the slider inside it both suffix theirs.
    if node.kind == "row" and byKey[node.props.key] then
      local control = node.children[2]
      report.cells[node.props.key] = {kind = control.kind, glyph = control.props.glyph}
    end
  end
  return report
end

local reports = {}
for index, model in ipairs(models) do reports[index] = inspect(model) end

-- A hand-rolled encoder, because the plugin's only JSON is the host's decoder,
-- and the report has to travel back to the assertions in Node.
local function quote(text)
  return '"' .. text:gsub('[\\"]', "\\%0"):gsub("%c", function(c)
    return string.format("\\u%04x", string.byte(c))
  end) .. '"'
end

local function encode(value)
  if type(value) ~= "table" then
    return type(value) == "string" and quote(value) or tostring(value)
  end
  local parts = {}
  if #value > 0 then
    for _, held in ipairs(value) do parts[#parts + 1] = encode(held) end
    return "[" .. table.concat(parts, ",") .. "]"
  end
  for key, held in pairs(value) do parts[#parts + 1] = quote(key) .. ":" .. encode(held) end
  return "{" .. table.concat(parts, ",") .. "}"
end
io.write(encode(reports))
`;

function inspectModels(models) {
  const script = harness.replace('MODELS', () => `{${models.map(luaLiteral).join(',')}}`);
  const result = spawnSync('lua', ['-', fileURLToPath(pluginDir)], { input: script, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

// The node each control kind must draw. `color` opens the host picker from a
// button, so the glyph is what separates it from the reset beside it.
const controlNode = { slider: 'slider', toggle: 'toggle', select: 'select', color: 'button' };

test('real describe output satisfies the panel model validator', () => {
  const fresh = describeStore({});
  // A profile shadows the override below it, which is where the panel reads
  // `layers` and `active`.
  const tuned = describeStore({
    base: { 'glass.roughness': 0.3 },
    profiles: { night: { 'glass.roughness': 0.7 } },
    active: { profile: 'night', wallpaper: { id: 'abc12345', path: '/nonexistent/wall.png' } },
  });
  assert.deepEqual(
    tuned.params.filter((param) => param.layer === 'profile')
      .map(({ key, value, fallback }) => ({ key, value, fallback })),
    [{ key: 'glass.roughness', value: 0.7, fallback: 0.7 }],
  );

  const [freshReport, tunedReport] = inspectModels([fresh, tuned]);
  for (const [model, report] of [[fresh, freshReport], [tuned, tunedReport]]) {
    assert.equal(report.error, undefined,
      `prism describe and the panel disagree about the model shape: ${report.error}`);

    // Every drawn parameter draws the control its `ui.control` names, and every
    // kind describe emits reaches at least one row.
    const emitted = new Set();
    const drawn = new Set();
    for (const param of model.params) {
      if (param.ui.control === 'none') continue;
      const expected = controlNode[param.ui.control];
      assert.ok(expected, `describe emits control kind ${param.ui.control}, which the panel cannot draw`);
      emitted.add(param.ui.control);
      // The title and section-header toggles render in headers, not in rows.
      const cell = report.cells[param.key];
      if (!cell) continue;
      assert.equal(cell.kind, expected, `${param.key} drew ${cell.kind}, not ${expected}`);
      if (param.ui.control === 'color') {
        const when = param.ui.when;
        const open = when === undefined
          || when.in.includes(model.params.find((other) => other.key === when.param).value);
        assert.equal(cell.glyph, open ? 'palette' : 'lock',
          `${param.key} drew ${cell.glyph}, not the ${open ? 'picker' : 'read-only lock'}`);
      }
      drawn.add(param.ui.control);
    }
    assert.deepEqual([...emitted].filter((control) => !drawn.has(control)), [],
      'control kinds describe emits that no parameter row drew');
  }
});


test('pair controls reconcile real CLI transitions, locality, guards, and replacement', () => {
  const pair = (values, source = '/W.jpg') => ({ _source: source, ...values });
  const profiles = {
    Aurora: { 'glass.roughness': 0.4, 'glass.noise': 0.1,
      _wallpapers: { other: pair({ 'glass.noise': 0.6 }, '/other.jpg') } },
    Dark: { 'glass.roughness': 0.8, 'glass.noise': 0.3,
      _wallpapers: { w1: pair({ 'glass.noise': 0.35 }), other: pair({ 'glass.noise': 0.7 }, '/other.jpg') } },
  };
  describeStore({ profiles, active: { profile: 'Aurora', wallpaper: { id: 'w1', path: '/W.jpg' } } },
    (run, configDir, stateDir) => {
      const ok = (...args) => {
        const result = run(args);
        assert.equal(result.status, 0, result.stderr);
        return result.stdout;
      };
      const describe = () => JSON.parse(ok('describe', '--json'));
      const profileBytes = (look) => readFileSync(join(configDir, 'contexts', 'profile', `${look}.yaml`), 'utf8');
      const runtime = () => JSON.parse(readFileSync(join(stateDir, 'active.json'), 'utf8'));
      const visible = (model) => model.params.filter((p) => p.ui.control !== 'none');
      const pending = (model) => visible(model).filter((p) => p.held.includes('scratch')).length;
      const value = (model, key) => model.params.find((p) => p.key === key).value;
      const guards = ['--expect-look', 'profile:Aurora', '--expect-wallpaper', 'id:w1'];
      const initial = describe();
      ok('set', 'glass.roughness', '0.55'); ok('set', 'glass.noise', '0.2');
      const edited = describe();
      assert.equal(pending(edited), 2);
      ok('context', 'activate', 'profile', 'Dark');
      const dark = describe();
      assert.equal(pending(dark), 0);
      assert.equal(value(dark, 'glass.roughness'), 0.8);
      assert.equal(value(dark, 'glass.noise'), 0.35);
      for (const destination of [['profile'], ['wallpaper', 'w1']]) {
        const before = [profileBytes('Dark'), JSON.stringify(runtime())];
        const refused = run(['commit', ...destination, ...guards]);
        assert.equal(refused.status, 1);
        assert.match(refused.stderr, /changed|expected|stale/);
        assert.deepEqual([profileBytes('Dark'), JSON.stringify(runtime())], before);
      }
      ok('context', 'activate', 'profile', 'Aurora');
      const restored = describe();
      assert.equal(pending(restored), 0);
      assert.equal(value(restored, 'glass.roughness'), 0.55);
      assert.equal(value(restored, 'glass.noise'), 0.2);
      const reports = inspectModels([initial, edited, dark, restored]);
      assert.ok(reports[0].labels['0 for Aurora + this wallpaper']);
      assert.ok(reports[1].labels['2 edits']);
      assert.ok(reports[2].labels['1 for Dark + this wallpaper']);
      assert.ok(reports[3].labels['2 for Aurora + this wallpaper']);
      for (const index of [0, 2, 3]) assert.ok(reports[index].labels['No edits']);

      const saved = profileBytes('Aurora');
      ok('reset', 'neutral'); ok('reset', 'revert');
      assert.equal(profileBytes('Aurora'), saved, 'Neutral/Revert cannot rewrite the look or pairs');
      assert.equal(value(describe(), 'glass.roughness'), 0.55);
      const darkBytes = profileBytes('Dark');
      ok('set', 'glass.roughness', '0.6');
      ok('commit', 'profile', ...guards);
      assert.equal(value(describe(), 'glass.roughness'), 0.6);
      assert.equal(profileBytes('Dark'), darkBytes);
      ok('set', 'glass.noise', '0.25');
      const scratch = runtime()._scratch;
      ok('context', 'clear', 'wallpaper', 'w1', ...guards);
      assert.deepEqual(runtime()._scratch, scratch, 'Clear preserves scratch');
      assert.equal(profileBytes('Dark'), darkBytes);
      const shown = describe();
      ok('commit', 'profile', 'Dark', ...guards);
      const snapshot = describe();
      assert.equal(value(snapshot, 'glass.roughness'), value(shown, 'glass.roughness'));
      assert.equal(value(snapshot, 'glass.noise'), value(shown, 'glass.noise'));
      assert.ok(inspectModels([snapshot])[0].labels['0 for Dark + this wallpaper']);
      const other = parseYaml(ok('context', 'show', 'wallpaper', 'other', '--look', 'profile:Dark'));
      assert.equal(other['glass.noise'], 0.7);
      const auroraOther = parseYaml(ok('context', 'show', 'wallpaper', 'other', '--look', 'profile:Aurora'));
      assert.equal(auroraOther['glass.noise'], 0.6);

      // A genuine slider write behind selection is incoming scratch.
      ok('context', 'activate', 'profile', 'Aurora'); ok('set', 'glass.noise', '0.45');
      assert.equal(runtime().profile, 'Aurora');
      assert.equal(runtime()._scratch['glass.noise'], 0.45);
      const destinationBytes = profileBytes('Dark');
      ok('commit', 'wallpaper', 'w1', ...guards);
      assert.equal(pending(describe()), 0);
      assert.equal(value(describe(), 'glass.noise'), 0.45);
      assert.equal(profileBytes('Dark'), destinationBytes);
      assert.equal(parseYaml(ok('context', 'show', 'wallpaper', 'other', '--look', 'profile:Aurora'))['glass.noise'], 0.6);
      ok('context', 'activate', 'wallpaper', 'other');
      for (const destination of [['profile'], ['wallpaper', 'w1']]) {
        const before = [profileBytes('Aurora'), JSON.stringify(runtime())];
        assert.equal(run(['commit', ...destination, ...guards]).status, 1);
        assert.deepEqual([profileBytes('Aurora'), JSON.stringify(runtime())], before);
      }
    });
});

test('tint pickers are editable only under manual, and the mix shows only under noctalia', () => {
  for (const source of ['noctalia', 'manual']) {
    const model = describeStore({ base: { 'glass.tintSource': source } });
    const [report] = inspectModels([model]);
    assert.equal(report.error, undefined);
    assert.equal(report.cells['glass.tintSource'].kind, 'select');
    if (source === 'noctalia') assert.equal(report.cells['glass.tintAccentMix'].kind, 'slider');
    else assert.equal(report.cells['glass.tintAccentMix'], undefined, 'the mix hides under manual');
    for (const key of ['glass.attenuationColor', 'glass.inactive.attenuationColor']) {
      assert.equal(report.cells[key].glyph, source === 'manual' ? 'palette' : 'lock', `${key} under ${source}`);
      assert.equal(model.params.find((param) => param.key === key).value, '#dfe8ff', 'the stored tint is untouched');
    }
  }
});
