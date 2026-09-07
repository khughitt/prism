import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadDefs } from '../src/defs.js';
import { defsDir } from '../src/paths.js';

test('shipped presentation is a Glass section and a Focus matrix', () => {
  const defs = [...loadDefs(defsDir()).values()];
  const visible = defs.filter((def) => def.ui.control !== 'none');
  const ordered = visible.slice().sort((a, b) => a.ui.order - b.ui.order);
  const title = defs.find((def) => def.ui.group === 'Title');
  assert.equal(title.key, 'glass.enabled');
  assert.equal(title.ui.control, 'toggle');

  const glass = ordered.filter((def) => def.ui.group === 'Glass').map((def) => def.key);
  assert.deepEqual(glass, [
    'compositor.gaps',
    'glass.attenuationColor',
    'glass.ior',
    'glass.thickness',
    'glass.distortionScale',
    'glass.backdropBlur',
    'glass.paneLip',
    'glass.paneShiftX',
    'glass.paneShiftY',
    'glass.jellyFlex',
    'glass.jellyRipple',
  ]);

  const focus = ordered.filter((def) => def.ui.group === 'Focus');
  assert.equal(focus[0].key, 'glass.focusSplit');
  const rows = [];
  for (const def of focus.slice(1)) {
    if (!def.ui.state) rows.push({ row: def.ui.label, single: def.key });
    else if (def.ui.state === 'focused') rows.push({ row: def.ui.row, focused: def.key });
    else {
      assert.equal(rows.at(-1).row, def.ui.row, `${def.key} follows its focused twin`);
      rows.at(-1).unfocused = def.key;
    }
  }
  assert.deepEqual(rows.map((row) => row.row), [
    'Terminal opacity', 'Blur', 'Tint distance', 'Fringing', 'Distortion', 'Directional blur',
    'Noise', 'Noise type', 'Saturation',
  ]);
  assert.deepEqual(rows.filter((row) => row.single), [{ row: 'Noise type', single: 'glass.noiseType' }]);
  assert.ok(rows.filter((row) => !row.single).every((row) => row.focused && row.unfocused));

  const groups = new Set(visible.map((def) => def.ui.group));
  assert.deepEqual([...groups].sort(), ['Focus', 'Glass', 'Title']);
  assert.equal(visible.length, 1 + glass.length + 1 + rows.reduce((n, row) => n + (row.single ? 1 : 2), 0));
  assert.ok(ordered.filter((def) => def.ui.group === 'Glass').every((def) => def.ui.order < focus[0].ui.order),
    'the Glass section precedes the Focus section');
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
        exponent: param.ui.exponent,
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
