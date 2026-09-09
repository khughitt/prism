import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

// A store the CLI reads but no sink writes: describe is read-only, so the
// contexts can be laid down as files instead of driven through `prism set`.
function describeStore(contexts) {
  const configDir = mkdtempSync(join(tmpdir(), 'prism-contract-cfg-'));
  const stateDir = mkdtempSync(join(tmpdir(), 'prism-contract-state-'));
  // JSON is YAML, so the fixtures need no writer of their own.
  writeFileSync(join(configDir, 'values.yaml'), `${JSON.stringify(contexts.base ?? {})}\n`);
  for (const [name, values] of Object.entries(contexts.profiles ?? {})) {
    mkdirSync(join(configDir, 'contexts', 'profile'), { recursive: true });
    writeFileSync(join(configDir, 'contexts', 'profile', `${name}.yaml`), `${JSON.stringify(values)}\n`);
  }
  if (contexts.active) writeFileSync(join(stateDir, 'active.json'), JSON.stringify(contexts.active));

  const result = spawnSync(prismBin, ['describe', '--json'], {
    encoding: 'utf8',
    env: { ...process.env, PRISM_CONFIG_DIR: configDir, PRISM_STATE_DIR: stateDir },
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
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
  local panel = {render = function(tree) rendered = tree end, setNeedsFrameTick = function() end}
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

  -- render() puts the error label first and hides it when there is nothing to
  -- say, so its text is exactly what validateModel returned.
  local errorLabel = rendered.children[1]
  local report = {error = errorLabel.props.visible and errorLabel.props.text or nil, cells = {}}
  local byKey = {}
  for _, param in ipairs(model.params) do byKey[param.key] = true end
  for _, node in ipairs(collect(rendered)) do
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
  // A profile shifts the write target off `base` and shadows the override
  // below it, which is where the panel reads `layers`, `target` and `active`.
  const tuned = describeStore({
    base: { 'glass.roughness': 0.3 },
    profiles: { night: { 'glass.roughness': 0.7 } },
    active: { profile: 'night', wallpaper: { id: 'abc12345', path: '/nonexistent/wall.png', pinned: false } },
  });
  assert.equal(fresh.target, 'base');
  assert.equal(tuned.target, 'profile');
  // Pin what the fixtures arranged: a renamed parameter would otherwise leave a
  // store with no contexts in it and quietly stop exercising the layer ranks.
  assert.deepEqual(
    tuned.params.filter((param) => param.layer === 'profile')
      .map(({ key, value, fallback }) => ({ key, value, fallback })),
    [{ key: 'glass.roughness', value: 0.7, fallback: 0.3 }],
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
        assert.equal(cell.glyph, 'palette', `${param.key} drew a button that is not the color picker`);
      }
      drawn.add(param.ui.control);
    }
    assert.deepEqual([...emitted].filter((control) => !drawn.has(control)), [],
      'control kinds describe emits that no parameter row drew');
  }
});
