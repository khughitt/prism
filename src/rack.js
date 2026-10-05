import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { loadPipeline } from './pipeline.js';

// The rack names which pipeline stage each device controls and how it is
// presented; the schema (defs/rack/pipeline.json) decides order, site, scope,
// and family, and the sink's dry file decides which device requires which.
// It lives one directory below the defs so loadDefs, which reads every .yaml
// directly inside defs/ as a list of params, never sees it.
const FIELDS = ['device', 'label', 'stage', 'mix', 'rows', 'shared', 'bypass'];
const DERIVED = {
  category: "category is derived from the stage's site; remove it",
  requires: 'requires is derived from the schema and the dry file; remove it',
};

export const FAMILIES = {
  source: 'source',
  normal: 'geometry',
  taps: 'transmission', behind: 'transmission', attenuation: 'transmission',
  within: 'light', specular: 'light', emissive: 'light',
  post: 'post',
};

export function familyOf(site) {
  const family = FAMILIES[site];
  if (family === undefined) throw new Error(`site ${site} has no family; no device may sit there`);
  return family;
}

// `dry` is the sinks' dry tables (src/dry.js), `nodes` the
// prism-key-to-native-node map from the manifests (src/nodes.js).
export function loadRack(dir, defs, { dry, nodes }) {
  const file = path.join(dir, 'rack', 'devices.yaml');
  return validateRack(parse(fs.readFileSync(file, 'utf8')), defs, loadPipeline(dir), dry, nodes);
}

export function validateRack(rack, defs, schema, dry, nodes) {
  const fail = (msg) => { throw new Error(`invalid rack: ${msg}`); };
  if (typeof rack?.group !== 'string' || rack.group.trim() === '') fail('group must be a non-empty string');
  if (!Array.isArray(rack.devices) || rack.devices.length === 0) fail('devices must be a non-empty list');
  if (!Array.isArray(rack.shared) || rack.shared.some((s) => typeof s !== 'string')) fail('shared must be a list of stage ids');
  for (const stage of rack.shared) {
    if (!schema.stageById.has(stage)) fail(`shared names unknown stage ${stage}`);
  }
  const group = rack.group;

  // What the group holds: matrix rows by label, stateless visible keys, and
  // the header toggle, which belongs to the section rather than a device.
  const rows = new Map();
  const singles = new Set();
  for (const def of defs.values()) {
    if (def.ui.group !== group || def.ui.control === 'none') continue;
    if (def.ui.state !== undefined) {
      const row = rows.get(def.ui.row) ?? {};
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

  // Which stage owns each native node, for the ownership rule.
  const ownerOf = new Map();
  for (const stage of schema.stages) {
    for (const node of stage.owns) ownerOf.set(node, stage.id);
  }
  for (const [key, node] of nodes) {
    if (!ownerOf.has(node)) fail(`${key} binds node ${node}, which no stage owns`);
  }

  const ids = new Set();
  const rowOwner = new Map();
  const keyOwner = new Map();
  const stageOwner = new Map();
  let lastStage = -1;
  const devices = [];
  for (const device of rack.devices) {
    const id = device?.device;
    const where = `device ${id ?? '?'}`;
    if (typeof id !== 'string' || !/^[a-z][a-zA-Z0-9]*$/.test(id)) fail(`${where}: bad id`);
    if (ids.has(id)) fail(`${where}: duplicate id`);
    for (const field of Object.keys(device)) {
      if (field in DERIVED) fail(`${where}: ${DERIVED[field]}`);
      if (!FIELDS.includes(field)) fail(`${where}: unknown field ${field}`);
    }
    if (typeof device.label !== 'string' || device.label.trim() === '') fail(`${where}: label required`);
    if (device.stage === undefined) fail(`${where}: stage required`);
    const stage = schema.stageById.get(device.stage);
    if (stage === undefined) fail(`${where}: unknown stage ${device.stage}`);
    if (stageOwner.has(stage.id)) fail(`${where}: stage ${stage.id} already belongs to ${stageOwner.get(stage.id)}`);
    const index = schema.stageIndex.get(stage.id);
    if (index < lastStage) {
      const previous = schema.stages[lastStage].id;
      fail(`${where}: out of stage order; stage ${stage.id} precedes stage ${previous} in the schema`);
    }
    lastStage = index;
    stageOwner.set(stage.id, id);
    if (!Array.isArray(device.rows) || !Array.isArray(device.shared)) fail(`${where}: rows and shared must be lists`);
    const keys = [];
    for (const label of [device.mix, ...device.rows]) {
      if (typeof label !== 'string' || !rows.has(label)) fail(`${where}: no matrix row ${label} in group ${group}`);
      if (rowOwner.has(label)) fail(`${where}: row ${label} already belongs to ${rowOwner.get(label)}`);
      rowOwner.set(label, id);
      keys.push(rows.get(label).focused, rows.get(label).unfocused);
    }
    if (defs.get(rows.get(device.mix).focused).ui.when?.otherwise === 'hidden') {
      fail(`${where}: mix row ${device.mix} cannot be hidden by ui.when; a card has no head without it`);
    }
    for (const key of [...device.shared, device.bypass]) {
      if (typeof key !== 'string' || !singles.has(key)) fail(`${where}: no shared parameter ${key} in group ${group}`);
      if (keyOwner.has(key)) fail(`${where}: ${key} already belongs to ${keyOwner.get(key)}`);
      keyOwner.set(key, id);
    }
    keys.push(...device.shared);
    const bypass = defs.get(device.bypass);
    if (bypass.type !== 'bool' || bypass.ui.control !== 'toggle') fail(`${where}: bypass ${device.bypass} must be a bool toggle`);
    // Ownership: every key with a native node sits at this device's stage.
    for (const key of keys) {
      const node = nodes.get(key);
      if (node === undefined) continue;
      const owner = ownerOf.get(node);
      if (owner !== stage.id) fail(`${where}: ${key} writes ${node}, which stage ${owner} owns, not stage ${stage.id}`);
    }
    ids.add(id);
    devices.push({ ...device, site: stage.site, scope: stage.scope, family: familyOf(stage.site), keys });
  }
  for (const label of rows.keys()) {
    if (!rowOwner.has(label)) fail(`row ${label} in group ${group} belongs to no device`);
  }
  for (const key of singles) {
    if (!keyOwner.has(key)) fail(`${key} in group ${group} belongs to no device`);
  }

  // Every stage prism writes to is a device or a declared shared stage.
  const written = new Map();
  for (const [key, node] of nodes) {
    const owner = ownerOf.get(node);
    if (owner !== undefined && !written.has(owner)) written.set(owner, { key, node });
  }
  for (const [stageId, { key, node }] of written) {
    if (!stageOwner.has(stageId) && !rack.shared.includes(stageId)) {
      fail(`stage ${stageId} owns ${node}, written by ${key}, but has no device and is not in shared`);
    }
  }

  // Derived requires and resolved interactions.
  const deviceOfStage = new Map(devices.map((d) => [d.stage, d.device]));
  const deviceOfBypass = new Map(devices.map((d) => [d.bypass, d.device]));
  for (const bypassKey of Object.keys(dry)) {
    if (!deviceOfBypass.has(bypassKey)) fail(`dry entry ${bypassKey} names no device's bypass`);
  }
  const position = new Map(devices.map((d, i) => [d.device, i]));
  const nodesOfDevice = new Map(devices.map((d) => [d.device, new Set(d.keys.map((k) => nodes.get(k)).filter((n) => n !== undefined))]));
  for (const device of devices) {
    const interactions = [];
    const requiresFrom = [];
    // A requires edge lands on the dependent (its `from`) naming what it needs;
    // an attenuates or shadows edge lands on the affected stage (its `on`)
    // naming what acts on it. Both read as "this card, because of that one".
    for (const edge of schema.interactions) {
      const [here, there] = edge.kind === 'requires' ? [edge.from, edge.on] : [edge.on, edge.from];
      if (here !== device.stage) continue;
      const other = deviceOfStage.get(there);
      if (other === undefined) continue;
      interactions.push({ kind: edge.kind, device: other, why: edge.why });
      if (edge.kind === 'requires') requiresFrom.push({ device: other, source: 'schema' });
    }
    for (const [bypassKey, fields] of Object.entries(dry)) {
      const other = deviceOfBypass.get(bypassKey);
      if (other === undefined || other === device.device) continue;
      const mine = nodesOfDevice.get(device.device);
      const written = Object.keys(fields).map((f) => fieldNode(f, ownerOf)).filter((n) => mine.has(n));
      if (written.length === 0) continue;
      interactions.push({ kind: 'requires', device: other, why: `the ${bypassKey} dry entry writes ${written.join(', ')}` });
      requiresFrom.push({ device: other, source: 'dry' });
    }
    const distinct = [...new Set(requiresFrom.map((r) => r.device))];
    if (distinct.length > 1) {
      const named = [...requiresFrom].sort((a, b) => a.source.localeCompare(b.source)).map((r) => `${r.device} (${r.source})`).join(' and ');
      fail(`device ${device.device}: requires would name ${named}; one source only until a consumer needs more`);
    }
    delete device.keys;
    device.interactions = interactions;
    if (distinct.length === 1) {
      // The panel resolves requires against the cards before this one, which
      // also rules out cycles.
      if (position.get(distinct[0]) > position.get(device.device)) {
        fail(`device ${device.device}: requires ${distinct[0]}, which comes after it; a device may only require an earlier one`);
      }
      device.requires = distinct[0];
    }
  }
  return { group, shared: rack.shared, devices };
}

// The dry file spells fields as render.js does (camelCase); the schema
// spells nodes as the renderer does (kebab-case). A field whose node is not
// owned by any stage is an error, not a silent miss: the `=` nodes
// (`noise type=`) have no dry entry today and would need a table here.
function fieldNode(field, ownerOf) {
  const node = field.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  if (!ownerOf.has(node)) throw new Error(`invalid rack: dry field ${field} maps to ${node}, which no stage owns`);
  return node;
}
