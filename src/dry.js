import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

// What "off" means for each rack device is sink knowledge: a sink declares it
// in dry.yaml beside its manifest, keyed by bypass parameter. The rack loader
// reads every sink's table to derive which device requires which; the sink
// reads its own to render bypassed devices.
export function readDry(file, label = file) {
  const dry = parse(fs.readFileSync(file, 'utf8'));
  for (const [key, fields] of Object.entries(dry)) {
    if (!key.startsWith('glass.bypass.')) throw new Error(`${label}: ${key} is not a bypass key`);
    if (typeof fields !== 'object' || fields === null || Object.keys(fields).length === 0) {
      throw new Error(`${label}: ${key} must map to at least one field`);
    }
  }
  return dry;
}

export function loadDry(dir) {
  const merged = {};
  const declaredBy = new Map();
  const entries = fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const file = path.join(dir, entry.name, 'dry.yaml');
    if (!fs.existsSync(file)) continue;
    const label = `${entry.name}/dry.yaml`;
    for (const [key, fields] of Object.entries(readDry(file, label))) {
      if (declaredBy.has(key)) throw new Error(`${label}: ${key} is already declared by ${declaredBy.get(key)}`);
      declaredBy.set(key, label);
      merged[key] = fields;
    }
  }
  return merged;
}
