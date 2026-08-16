import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

export const LIVENESS = ['live', 'reload', 'restart'];

export function loadManifests(dir, defs) {
  if (!fs.existsSync(dir)) return [];
  const manifests = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const file = path.join(dir, entry.name, 'manifest.yaml');
    if (!fs.existsSync(file)) continue;
    const m = parse(fs.readFileSync(file, 'utf8'));
    if (typeof m?.sink !== 'string' || !Array.isArray(m.binds)) {
      throw new Error(`${file}: manifest needs sink and binds`);
    }
    for (const b of m.binds) {
      if (!defs.has(b.param)) throw new Error(`${file}: binds undefined param ${b.param}`);
      if (!LIVENESS.includes(b.liveness)) {
        throw new Error(`${file}: bad liveness ${JSON.stringify(b.liveness)}`);
      }
      if (b.drag !== undefined && b.drag !== 'release') {
        throw new Error(`${file}: bad drag ${JSON.stringify(b.drag)}`);
      }
      if (b.drag === 'release' && b.liveness !== 'live') {
        throw new Error(`${file}: drag: release requires liveness: live`);
      }
    }
    const generates = m.generates ?? [];
    if (!Array.isArray(generates) || generates.some((g) =>
      typeof g !== 'string' || !g || g === '.' || g === '..' || path.basename(g) !== g)) {
      throw new Error(`${file}: generates must be a list of file names`);
    }
    manifests.push({ sink: m.sink, dir: path.join(dir, entry.name), binds: m.binds, generates });
  }
  return manifests;
}
