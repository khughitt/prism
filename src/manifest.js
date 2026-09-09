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
    const requires = m.requires ?? [];
    if (!Array.isArray(requires)) throw new Error(`${file}: requires must be a list`);
    for (const r of requires) {
      const forms = ['command', 'probe'].filter((key) => r?.[key] !== undefined);
      if (forms.length !== 1) {
        throw new Error(`${file}: each requires entry needs exactly one of command or probe`);
      }
      const [form] = forms;
      if (typeof r[form] !== 'string' || r[form] === '') {
        throw new Error(`${file}: bad ${form} ${JSON.stringify(r[form])}`);
      }
      if (typeof r.fix !== 'string' || r.fix.trim() === '') {
        throw new Error(`${file}: requires ${r[form]} needs a fix`);
      }
      if (form === 'probe') {
        // "Beside apply" is the whole contract: a name carrying a separator
        // would reach out of the sink's directory, and X_OK alone is satisfied
        // by a directory, which cannot be spawned.
        if (path.basename(r.probe) !== r.probe || r.probe === '.' || r.probe === '..') {
          throw new Error(`${file}: probe ${JSON.stringify(r.probe)} must be a bare name`);
        }
        const probe = path.join(dir, entry.name, `probe-${r.probe}`);
        let stat = null;
        try {
          stat = fs.statSync(probe);
        } catch {
          throw new Error(`${file}: probe ${r.probe} is missing at ${probe}`);
        }
        if (!stat.isFile()) throw new Error(`${file}: probe ${r.probe} is not a file at ${probe}`);
        try {
          fs.accessSync(probe, fs.constants.X_OK);
        } catch {
          throw new Error(`${file}: probe ${r.probe} is not executable at ${probe}`);
        }
      }
      if (r.when !== undefined) {
        const def = defs.get(r.when);
        if (!def) throw new Error(`${file}: when names undefined param ${r.when}`);
        if (def.type !== 'bool') throw new Error(`${file}: when param ${r.when} must be type bool`);
      }
    }
    manifests.push({ sink: m.sink, dir: path.join(dir, entry.name), binds: m.binds, generates, requires });
  }
  return manifests;
}
