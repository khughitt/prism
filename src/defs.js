import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { parse } from 'yaml';
import { validateValue } from './values.js';

export const TYPES = ['float', 'int', 'bool', 'color', 'enum', 'string', 'list'];
export const CONTROLS = ['slider', 'toggle', 'color', 'select', 'none'];
export const DISPLAYS = ['raw', 'percent', 'normalized'];
export const SCALES = ['linear', 'logarithmic', 'power'];
export const STATES = ['focused', 'unfocused'];
const KEY_RE = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+$/;
// Controls the panel can draw twice in one focus row. A select is left out:
// an enum shared by both states belongs in a single-parameter row instead.
export const MATRIX_CONTROLS = ['slider', 'toggle', 'color'];
// What a gated control shows while its source holds none of the listed values:
// the color the sink reported, or nothing.
export const WHEN_OTHERWISE = ['effective', 'hidden'];

export function loadDefs(dir) {
  const defs = new Map();
  const orders = new Map();
  const headers = new Map();
  const rows = new Map();
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.yaml')).sort();
  if (files.length === 0) throw new Error(`no def files in ${dir}`);
  for (const f of files) {
    const list = parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (!Array.isArray(list)) throw new Error(`${f}: expected a YAML list of defs`);
    for (const def of list) {
      validateDef(def, f);
      if (defs.has(def.key)) throw new Error(`duplicate def ${def.key} (${f})`);
      if (def.ui.control !== 'none' && orders.has(def.ui.order)) {
        throw new Error(`duplicate ui.order ${def.ui.order}: ${orders.get(def.ui.order)} and ${def.key}`);
      }
      if (def.ui.control !== 'none') orders.set(def.ui.order, def.key);
      if (def.ui.header === true) {
        if (headers.has(def.ui.group)) {
          throw new Error(`group ${def.ui.group} has two header toggles: ${headers.get(def.ui.group)} and ${def.key}`);
        }
        headers.set(def.ui.group, def.key);
      }
      if (def.ui.state !== undefined) {
        if (def.neutralize === false) {
          throw new Error(`invalid def ${def.key}: a matrix row's halves must declare a neutral`);
        }
        const id = `${def.ui.group}\u0000${def.ui.row}`;
        const twin = rows.get(id);
        if (twin === undefined) rows.set(id, def);
        else if (!isDeepStrictEqual(twin.neutral, def.neutral)) {
          throw new Error(`group ${def.ui.group} row ${def.ui.row}: ${twin.key} and ${def.key} `
            + 'declare different neutrals; a row\'s halves must neutralize alike');
        } else if (!isDeepStrictEqual(twin.ui.when, def.ui.when)) {
          throw new Error(`group ${def.ui.group} row ${def.ui.row}: ${twin.key} and ${def.key} `
            + 'declare different ui.when; a row\'s halves share one gate');
        }
      }
      defs.set(def.key, def);
    }
  }
  checkSubgroups(defs);
  checkWhens(defs);
  // A replacement is a rename across a release: the old key must be gone
  // from the definitions, or the store could hold both with a straight face.
  const replacedBy = new Map();
  for (const def of defs.values()) {
    if (def.replaces === undefined) continue;
    if (defs.has(def.replaces)) {
      throw new Error(`${def.key} replaces ${def.replaces}, which is still defined`);
    }
    if (replacedBy.has(def.replaces)) {
      throw new Error(`${def.replaces} is replaced by both ${replacedBy.get(def.replaces)} and ${def.key}`);
    }
    replacedBy.set(def.replaces, def.key);
  }
  return defs;
}

export function validateDef(def, src) {
  const fail = (msg) => { throw new Error(`invalid def ${def?.key ?? '?'} (${src}): ${msg}`); };
  if (typeof def?.key !== 'string' || !KEY_RE.test(def.key)) fail('bad key');
  if (Object.hasOwn(def, 'replaces')) {
    if (typeof def.replaces !== 'string' || !KEY_RE.test(def.replaces)) fail('replaces must name a key');
    if (def.replaces === def.key) fail('a def cannot replace itself');
  }
  if (!TYPES.includes(def.type)) fail(`type must be one of ${TYPES.join('|')}`);
  if (!CONTROLS.includes(def.ui?.control)) fail(`ui.control must be one of ${CONTROLS.join('|')}`);
  if (typeof def.ui?.group !== 'string') fail('ui.group required');
  if (def.ui.control !== 'none') {
    if (typeof def.ui.label !== 'string' || def.ui.label.trim() === '') fail('ui.label required');
    if (!Number.isInteger(def.ui.order)) fail('ui.order must be an integer');
  }
  if (typeof def.description !== 'string') fail('description required');
  const numeric = def.type === 'float' || def.type === 'int';
  const slider = def.ui.control === 'slider';
  const has = (key) => Object.hasOwn(def.ui, key);
  const display = has('display') ? def.ui.display : 'raw';
  const scale = has('scale') ? def.ui.scale : 'linear';
  if (def.type === 'enum' && !Array.isArray(def.values)) fail('enum requires values');
  if (def.type === 'list' && def.items !== 'string') fail('list requires items: string');
  if ((def.type === 'list' || def.type === 'string') && def.ui.control !== 'none') fail(`${def.type} must declare control: none`);
  if (numeric && (!(Array.isArray(def.range) && def.range.length === 2)
      || !def.range.every(Number.isFinite) || def.range[0] >= def.range[1])) {
    fail('numeric def requires range with two finite increasing endpoints');
  }
  if (!slider && ['display', 'scale', 'unit', 'exponent'].some(has)) {
    fail('ui.display, ui.scale, ui.unit, and ui.exponent are slider-only');
  }
  if (has('state') !== has('row')) {
    fail(has('state') ? 'ui.state requires ui.row' : 'ui.row requires ui.state');
  }
  if (has('header')) {
    if (def.ui.control !== 'toggle') fail('ui.header is toggle-only');
    if (def.ui.header !== true) fail('ui.header must be true when present');
  }
  if (def.ui.control === 'none' && ['subgroup', 'column', 'when'].some(has)) {
    fail('control: none takes no ui.subgroup, ui.column or ui.when');
  }
  if (has('subgroup')) {
    if (typeof def.ui.subgroup !== 'string' || def.ui.subgroup.trim() === '') fail('ui.subgroup must be a non-empty string');
    if (has('header')) fail('header toggle takes no ui.subgroup');
  }
  // A single row drawn under the Focused column alone, with a dash under
  // Unfocused: the focus light shows only on the focused window.
  if (has('column')) {
    if (def.ui.column !== 'focused') fail('ui.column must be focused');
    if (has('state')) fail('ui.column and ui.state are exclusive');
    if (has('header')) fail('ui.column is not valid on a header toggle');
  }
  if (has('when')) {
    const when = def.ui.when;
    if (typeof when !== 'object' || when === null || Array.isArray(when)) fail('ui.when must be a mapping');
    for (const field of Object.keys(when)) {
      if (!['param', 'in', 'otherwise'].includes(field)) fail(`ui.when has unknown field ${field}`);
    }
    if (typeof when.param !== 'string' || !KEY_RE.test(when.param)) fail('ui.when.param must name a key');
    if (!Array.isArray(when.in) || when.in.length === 0 || !when.in.every((value) => typeof value === 'string')) {
      fail('ui.when.in must be a non-empty list of values');
    }
    if (!WHEN_OTHERWISE.includes(when.otherwise)) fail(`ui.when.otherwise must be one of ${WHEN_OTHERWISE.join('|')}`);
    if (when.otherwise === 'effective' && def.ui.control !== 'color') fail('ui.when otherwise: effective is color-only');
    if (has('header')) fail('a header toggle takes no ui.when');
  }
  if (has('state')) {
    if (!MATRIX_CONTROLS.includes(def.ui.control)) {
      fail(`ui.state and ui.row are not supported on control ${def.ui.control}`);
    }
    if (!STATES.includes(def.ui.state)) fail(`ui.state must be one of ${STATES.join('|')}`);
    if (typeof def.ui.row !== 'string' || def.ui.row.trim() === '') fail('ui.row must be a non-empty string');
  }
  if (slider) {
    if (!DISPLAYS.includes(display)) fail(`ui.display must be one of ${DISPLAYS.join('|')}`);
    if (!SCALES.includes(scale)) fail(`ui.scale must be one of ${SCALES.join('|')}`);
    if (!numeric) fail('slider requires a numeric definition');
    if (def.type === 'int' && !def.range.every(Number.isInteger)) {
      fail('int slider requires integer range endpoints');
    }
    if (!Number.isFinite(def.ui.step) || def.ui.step <= 0) fail('slider requires finite positive ui.step');
    if (def.type === 'int' && !Number.isInteger(def.ui.step)) fail('int slider requires integer ui.step');
    if (has('unit') && (typeof def.ui.unit !== 'string' || def.ui.unit === '')) fail('ui.unit must be a non-empty string');
    if (has('unit') && display !== 'raw') fail('ui.unit requires raw display');
    if (scale === 'logarithmic' && def.range[0] <= 0) fail('logarithmic scale requires a positive range');
    // A curved scale only shapes the track; the label may still read raw, percent, or normalized.
    if (scale === 'power') {
      if (!has('exponent')) fail('power scale requires ui.exponent');
      if (!Number.isFinite(def.ui.exponent) || def.ui.exponent <= 1) fail('ui.exponent must be greater than 1');
    } else if (has('exponent')) {
      fail('ui.exponent requires scale: power');
    }
    const stepCount = (def.range[1] - def.range[0]) / def.ui.step;
    const tolerance = Number.EPSILON * Math.max(1, Math.abs(stepCount)) * 16;
    if (Math.abs(stepCount - Math.round(stepCount)) > tolerance) {
      fail('range span must be an integer multiple of ui.step');
    }
  }
  if (def.default === undefined) fail('default required');
  const declaresNeutral = Object.hasOwn(def, 'neutral');
  const declaresNeutralize = Object.hasOwn(def, 'neutralize');
  if (def.ui.control === 'none') {
    if (declaresNeutral || declaresNeutralize) fail('control: none takes no neutral or neutralize');
  } else {
    if (declaresNeutral === declaresNeutralize) {
      fail('a visible def declares exactly one of neutral and neutralize');
    }
    if (declaresNeutralize && def.neutralize !== false) fail('neutralize must be false when present');
    if (declaresNeutral) validateValue(def, def.neutral);
  }
}

// A subgroup is one run of rows under one heading: every visible non-header
// row of a group names one or none does, and each name's rows are contiguous
// in ui.order, or the panel would draw the same heading twice.
function checkSubgroups(defs) {
  const groups = new Map();
  for (const def of defs.values()) {
    if (def.ui.control === 'none' || def.ui.header === true) continue;
    if (!groups.has(def.ui.group)) groups.set(def.ui.group, []);
    groups.get(def.ui.group).push(def);
  }
  for (const [group, list] of groups) {
    if (!list.some((def) => def.ui.subgroup !== undefined)) continue;
    const bare = list.find((def) => def.ui.subgroup === undefined);
    if (bare) {
      throw new Error(`group ${group}: ${bare.key} has no ui.subgroup; either every row of a group names one or none does`);
    }
    list.sort((a, b) => a.ui.order - b.ui.order);
    const closed = new Set();
    list.forEach((def, index) => {
      const name = def.ui.subgroup;
      if (closed.has(name)) {
        throw new Error(`group ${group}: ${def.key} splits subgroup ${name}; its rows must be contiguous in ui.order`);
      }
      if (list[index + 1]?.ui.subgroup !== name) closed.add(name);
    });
  }
}

// A gate reads an enum the panel holds, under values that enum can take.
function checkWhens(defs) {
  for (const def of defs.values()) {
    const when = def.ui.when;
    if (when === undefined) continue;
    const source = defs.get(when.param);
    if (source?.type !== 'enum') {
      throw new Error(`invalid def ${def.key}: ui.when.param ${when.param} is not an enum def`);
    }
    const unknown = when.in.filter((value) => !source.values.includes(value));
    if (unknown.length > 0) {
      throw new Error(`invalid def ${def.key}: ui.when.in names ${unknown.join(', ')}, not values of ${when.param}`);
    }
  }
}
