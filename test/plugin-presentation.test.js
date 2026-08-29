import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadDefs } from '../src/defs.js';
import { defsDir } from '../src/paths.js';

test('shipped presentation has the exact Quick and advanced structure', () => {
  const defs = [...loadDefs(defsDir()).values()];
  const visible = defs.filter((def) => def.ui.control !== 'none');
  const ordered = visible.slice().sort((a, b) => a.ui.order - b.ui.order);
  const groups = [
    { name: 'Quick', params: ordered.filter((def) => def.ui.group === 'Quick') },
    ...['Opacity & Focus', 'Glass Shape', 'Glass Optics', 'Motion', 'Debug']
      .map((name) => ({ name, params: ordered.filter((def) => def.ui.group === name) })),
  ];
  assert.deepEqual(groups.map((group) => group.name), [
    'Quick', 'Opacity & Focus', 'Glass Shape', 'Glass Optics', 'Motion', 'Debug',
  ]);
  // The Diagnostics group had no native consumer and is gone with its members.
  assert.equal(visible.some((def) => def.ui.group === 'Diagnostics'), false);
  assert.deepEqual(groups[0].params.map((param) => param.key), [
    'terminal.background.opacity.active',
    'terminal.background.opacity.inactive',
    'compositor.gaps',
    'glass.attenuationColor',
  ]);
  assert.deepEqual(groups.at(-1).params.map((param) => param.key), ['debug.backdrop']);
  const renderedKeys = groups.flatMap((group) => group.params.map((param) => param.key));
  const title = defs.find((def) => def.ui.group === 'Title');
  assert.equal(title.key, 'glass.enabled');
  assert.equal(title.ui.control, 'toggle');
  assert.equal(renderedKeys.length, 20);
  assert.equal(new Set(renderedKeys).size, 20);
  const allRenderedKeys = [title.key].concat(renderedKeys);
  assert.equal(allRenderedKeys.length, 21);
  assert.equal(new Set(allRenderedKeys).size, 21);
  assert.deepEqual(allRenderedKeys.slice().sort(), visible.map((def) => def.key).sort());
});

test('shipped defs declare exact value presentation', () => {
  const defs = loadDefs(defsDir());
  assert.equal(defs.has('glass.transmission'), false);
  assert.equal(defs.get('terminal.background.opacity.active').ui.display, 'percent');
  assert.equal(defs.get('compositor.gaps').ui.unit, 'px');
  assert.deepEqual(
    [...defs.values()].filter((def) => Object.hasOwn(def.ui, 'affectsPreview'))
      .map((def) => def.key),
    [],
  );
});

test('every shipped slider maps one host step to one canonical grid step', () => {
  const params = [...loadDefs(defsDir()).values()]
    .filter((param) => param.ui.control === 'slider')
    .map((param) => ({
      key: param.key,
      range: param.range,
      default: param.default,
      ui: {
        control: param.ui.control,
        step: param.ui.step,
        display: param.ui.display,
        scale: param.ui.scale,
      },
    }));
  const toLua = (value) => {
    if (Array.isArray(value)) return `{${value.map(toLua).join(',')}}`;
    if (value && typeof value === 'object') {
      return `{${Object.entries(value).map(([key, item]) => `[${JSON.stringify(key)}]=${toLua(item)}`).join(',')}}`;
    }
    if (value === undefined) return 'nil';
    return JSON.stringify(value);
  };
  const luaParams = toLua(params);
  const presentationPath = fileURLToPath(new URL(
    '../integrations/noctalia-plugin/presentation.luau', import.meta.url,
  ));
  const script = `
local Presentation = dofile(${JSON.stringify(presentationPath)})
local params = ${luaParams}
local function close(actual, expected)
  return math.abs(actual - expected) <= 1e-9 * math.max(1, math.abs(expected))
end
for _, param in ipairs(params) do
  for _, current in ipairs({param.range[1], param.default, param.range[2]}) do
    local shown = Presentation.toSliderValue(current, param)
    local nativeStep = Presentation.sliderStep(param)
    if nativeStep == 0 then nativeStep = (Presentation.sliderTo(param) - Presentation.sliderFrom(param)) * 0.05 end
    for _, direction in ipairs({-1, 1}) do
      local incoming = shown + direction * nativeStep
      if incoming >= Presentation.sliderFrom(param) and incoming <= Presentation.sliderTo(param) then
        local expected = Presentation.stepCanonicalValue(current, direction, param)
        local actual = Presentation.canonicalFromSliderStep(incoming, current, param)
          or Presentation.canonicalFromSlider(incoming, param)
        assert(close(actual, expected), param.key .. " failed direction " .. direction .. " at " .. current)
      end
    end
  end
end
`;
  const result = spawnSync('lua', ['-e', script], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});
