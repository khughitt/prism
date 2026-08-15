import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

export const TYPES = ['float', 'int', 'bool', 'color', 'enum', 'string', 'list'];
export const CONTROLS = ['slider', 'toggle', 'color', 'select', 'none'];

export function loadDefs(dir) {
  const defs = new Map();
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.yaml')).sort();
  if (files.length === 0) throw new Error(`no def files in ${dir}`);
  for (const f of files) {
    const list = parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (!Array.isArray(list)) throw new Error(`${f}: expected a YAML list of defs`);
    for (const def of list) {
      validateDef(def, f);
      if (defs.has(def.key)) throw new Error(`duplicate def ${def.key} (${f})`);
      defs.set(def.key, def);
    }
  }
  return defs;
}

export function validateDef(def, src) {
  const fail = (msg) => { throw new Error(`invalid def ${def?.key ?? '?'} (${src}): ${msg}`); };
  if (typeof def?.key !== 'string' || !/^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+$/.test(def.key)) fail('bad key');
  if (!TYPES.includes(def.type)) fail(`type must be one of ${TYPES.join('|')}`);
  if (!CONTROLS.includes(def.ui?.control)) fail(`ui.control must be one of ${CONTROLS.join('|')}`);
  if (typeof def.ui?.group !== 'string') fail('ui.group required');
  if (typeof def.description !== 'string') fail('description required');
  if (def.type === 'enum' && !Array.isArray(def.values)) fail('enum requires values');
  if (def.type === 'list' && def.items !== 'string') fail('list requires items: string');
  if ((def.type === 'list' || def.type === 'string') && def.ui.control !== 'none') fail(`${def.type} must declare control: none`);
  if ((def.type === 'float' || def.type === 'int')
      && !(Array.isArray(def.range) && def.range.length === 2)) fail('numeric def requires range');
  if (def.default === undefined) fail('default required');
}
