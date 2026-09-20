import fs from 'node:fs';
import path from 'node:path';
import { configDir, stateDir, valuesPath } from './paths.js';
import { readValues, writeValues } from './values.js';
import { VERB_KINDS, contextPath, listContexts, readContext, writeContext } from './contexts.js';

export function replacements(defs) {
  const map = new Map();
  for (const def of defs.values()) {
    if (def.replaces !== undefined) map.set(def.replaces, def);
  }
  return map;
}

export function convertValue(value, def) {
  const admitsZero = def.range !== undefined && def.range[0] <= 0 && def.range[1] >= 0;
  return value === 0 && admitsZero ? 0 : def.default;
}

export function migrateValues(values, defs) {
  const out = { ...values };
  const changes = [];
  for (const [from, def] of replacements(defs)) {
    if (!Object.hasOwn(out, from)) continue;
    const old = out[from];
    delete out[from];
    const kept = Object.hasOwn(out, def.key);
    if (!kept) out[def.key] = convertValue(old, def);
    changes.push({ from, to: def.key, old, value: out[def.key], kept });
  }
  return { values: out, changes };
}

export function planMigration(defs) {
  const files = [];
  const base = migrateValues(readValues(), defs);
  if (base.changes.length > 0) {
    files.push({ where: 'base', kind: 'base', name: null, path: valuesPath(), source: null, ...base });
  }
  const all = listContexts();
  for (const kind of VERB_KINDS) {
    for (const name of all[kind]) {
      const context = readContext(kind, name);
      const migrated = migrateValues(context.values, defs);
      if (migrated.changes.length === 0) continue;
      files.push({
        where: `${kind} ${name}`, kind, name, path: contextPath(kind, name), source: context.source, ...migrated,
      });
    }
  }
  return files;
}

export function backupDir(now) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return path.join(stateDir(), 'migrations', stamp);
}

export function writeBackup(files, now) {
  const backup = backupDir(now);
  fs.mkdirSync(path.dirname(backup), { recursive: true });
  try {
    fs.mkdirSync(backup);
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error(`backup ${backup} already exists`);
    throw error;
  }
  for (const file of files) {
    const copy = path.join(backup, path.relative(configDir(), file.path));
    fs.mkdirSync(path.dirname(copy), { recursive: true });
    fs.copyFileSync(file.path, copy, fs.constants.COPYFILE_EXCL);
  }
  return backup;
}

export function writeMigrated(file) {
  if (file.kind === 'base') writeValues(file.values);
  else writeContext(file.kind, file.name, { source: file.source, values: file.values });
}
