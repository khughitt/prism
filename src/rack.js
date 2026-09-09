import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

export const CATEGORIES = ['source', 'geometry', 'optic', 'post'];
const FIELDS = ['device', 'label', 'category', 'mix', 'rows', 'shared', 'bypass', 'requires'];

// The rack names where each parameter sits in the chain; a def says what the
// parameter is. It lives one directory below the defs so loadDefs, which reads
// every .yaml directly inside defs/ as a list of params, never sees it.
export function loadRack(dir, defs) {
  const file = path.join(dir, 'rack', 'devices.yaml');
  return validateRack(parse(fs.readFileSync(file, 'utf8')), defs);
}

export function validateRack(rack, defs) {
  const fail = (msg) => { throw new Error(`invalid rack: ${msg}`); };
  if (typeof rack?.group !== 'string' || rack.group.trim() === '') fail('group must be a non-empty string');
  if (!Array.isArray(rack.devices) || rack.devices.length === 0) fail('devices must be a non-empty list');
  const group = rack.group;

  // What the group holds: matrix rows by label, stateless visible keys, and
  // the header toggle, which belongs to the section rather than a device.
  const rows = new Map();
  const singles = new Set();
  for (const def of defs.values()) {
    if (def.ui.group !== group || def.ui.control === 'none') continue;
    if (def.ui.state !== undefined) {
      const row = rows.get(def.ui.row) ?? {};
      // loadDefs does not pair rows; the panel's sections() rejects a doubled
      // state, and so must the rack, or one of the two defs silently vanishes.
      if (row[def.ui.state]) fail(`row ${def.ui.row} in group ${group} has two ${def.ui.state} parameters`);
      row[def.ui.state] = def.key;
      rows.set(def.ui.row, row);
    } else if (def.ui.header !== true) {
      singles.add(def.key);
    }
  }
  for (const [label, row] of rows) {
    if (!row.focused || !row.unfocused) fail(`row ${label} in group ${group} lacks a ${row.focused ? 'unfocused' : 'focused'} parameter`);
  }

  const ids = new Set();
  const rowOwner = new Map();
  const keyOwner = new Map();
  for (const device of rack.devices) {
    const id = device?.device;
    const where = `device ${id ?? '?'}`;
    if (typeof id !== 'string' || !/^[a-z][a-zA-Z0-9]*$/.test(id)) fail(`${where}: bad id`);
    if (ids.has(id)) fail(`${where}: duplicate id`);
    for (const field of Object.keys(device)) {
      if (!FIELDS.includes(field)) fail(`${where}: unknown field ${field}`);
    }
    if (typeof device.label !== 'string' || device.label.trim() === '') fail(`${where}: label required`);
    if (!CATEGORIES.includes(device.category)) fail(`${where}: category must be one of ${CATEGORIES.join('|')}`);
    if (!Array.isArray(device.rows) || !Array.isArray(device.shared)) fail(`${where}: rows and shared must be lists`);
    for (const label of [device.mix, ...device.rows]) {
      if (typeof label !== 'string' || !rows.has(label)) fail(`${where}: no matrix row ${label} in group ${group}`);
      if (rowOwner.has(label)) fail(`${where}: row ${label} already belongs to ${rowOwner.get(label)}`);
      rowOwner.set(label, id);
    }
    for (const key of [...device.shared, device.bypass]) {
      if (typeof key !== 'string' || !singles.has(key)) fail(`${where}: no shared parameter ${key} in group ${group}`);
      if (keyOwner.has(key)) fail(`${where}: ${key} already belongs to ${keyOwner.get(key)}`);
      keyOwner.set(key, id);
    }
    const bypass = defs.get(device.bypass);
    if (bypass.type !== 'bool' || bypass.ui.control !== 'toggle') fail(`${where}: bypass ${device.bypass} must be a bool toggle`);
    if (device.requires !== undefined && (typeof device.requires !== 'string' || !ids.has(device.requires))) {
      fail(`${where}: requires must name an earlier device`);
    }
    ids.add(id);
  }
  for (const label of rows.keys()) {
    if (!rowOwner.has(label)) fail(`row ${label} in group ${group} belongs to no device`);
  }
  for (const key of singles) {
    if (!keyOwner.has(key)) fail(`${key} in group ${group} belongs to no device`);
  }
  return rack;
}
