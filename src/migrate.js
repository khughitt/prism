import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { parse, stringify } from 'yaml';
import { activePath, configDir, contextsDir, scratchPath, stateDir } from './paths.js';
import { assertName, contextPath, listContexts, lookPath, readLook, readRuntime, validateRuntimeRecord, writeLook, writeRuntime } from './contexts.js';
import { checkLayer } from './resolve.js';
import { readJson } from './store.js';

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
  assertPairLayout();
  const files = [];
  for (const name of [null, ...listContexts().profile]) {
    const document = readLook(name);
    const where = name === null ? 'base' : `profile ${name}`;
    const changes = [];
    const migrate = (values, location) => {
      const result = migrateValues(values, defs);
      changes.push(...result.changes.map((change) => ({ ...change, where: location })));
      return result.values;
    };
    document.values = migrate(document.values, where);
    for (const [id, pair] of Object.entries(document.wallpapers)) {
      pair.values = migrate(pair.values, `${where} / wallpaper ${id}`);
    }
    if (changes.length) files.push({ where, kind: 'look', name, path: lookPath(name), document, changes });
  }
  const runtime = readRuntime();
  const scratch = migrateValues(runtime.scratch, defs);
  if (scratch.changes.length) files.push({ where: 'scratch', kind: 'runtime', path: activePath(),
    document: { ...runtime, scratch: scratch.values }, changes: scratch.changes });
  return files;
}

export function backupDir(now) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return path.join(stateDir(), 'migrations', stamp);
}

function backupRelative(file) {
  if ([activePath(), scratchPath()].includes(file)) return path.join('state', path.basename(file));
  const relative = path.relative(configDir(), file);
  if (path.isAbsolute(relative) || relative === '..' || relative.startsWith(`..${path.sep}`)) {
    throw new Error(`backup source outside config directory: ${file}`);
  }
  return relative;
}

export function writeBackup(files, now, { unique = false } = {}) {
  fs.mkdirSync(path.dirname(backupDir(now)), { recursive: true });
  let backup;
  if (unique) backup = fs.mkdtempSync(backupDir(now) + '-');
  else {
    backup = backupDir(now);
    try { fs.mkdirSync(backup); }
    catch (error) {
      if (error.code === 'EEXIST') throw new Error(`backup ${backup} already exists`);
      throw error;
    }
  }
  for (const file of files) {
    const copy = path.join(backup, backupRelative(file.path));
    fs.mkdirSync(path.dirname(copy), { recursive: true });
    fs.copyFileSync(file.path, copy, fs.constants.COPYFILE_EXCL);
  }
  return backup;
}

export function writeMigrated(file) {
  if (file.kind === 'runtime') writeRuntime(file.document);
  else writeLook(file.name, file.document);
}

function oldWallpapers() {
  let files = [];
  try { files = fs.readdirSync(path.join(contextsDir(), 'wallpaper')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  return files.filter((name) => name.endsWith('.yaml')).map((name) => name.slice(0, -5)).sort();
}

export function pairLayoutSources() {
  const sources = oldWallpapers().map((id) => contextPath('wallpaper', id));
  if (fs.existsSync(scratchPath())) sources.push(scratchPath());
  const runtime = readJson(activePath(), {});
  if (runtime?.wallpaper && Object.hasOwn(runtime.wallpaper, 'pinned')) sources.push(`${activePath()} (retired pinned)`);
  return sources;
}

export function assertPairLayout() {
  const sources = pairLayoutSources();
  if (sources.length) throw new Error(`old pair layout: ${sources.join(', ')} — run 'prism migrate pairs'`);
}

function yamlMap(file) {
  const doc = parse(fs.readFileSync(file, 'utf8'));
  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) throw new Error(`${file}: expected a mapping`);
  return doc;
}

function lookText(look) {
  const pairs = Object.fromEntries(Object.entries(look.wallpapers).map(([id, pair]) => [id, { _source: pair.source, ...pair.values }]));
  return stringify({ ...look.values, ...(Object.keys(pairs).length ? { _wallpapers: pairs } : {}) });
}

// This plan lives for one locked invocation only. A retry always reads current files.
export function planPairMigration(defs) {
  const validate = (values, where) => checkLayer(defs, migrateValues(values, defs).values, where);
  const globals = oldWallpapers().map((id) => {
    assertName(id);
    const { _source: source, ...values } = yamlMap(contextPath('wallpaper', id));
    if (typeof source !== 'string') throw new Error(`wallpaper ${id}: missing _source`);
    validate(values, `old wallpaper ${id}`);
    return { id, source, values };
  });
  const outputs = [], copies = [];
  const addOutput = (file, text) => outputs.push({ path: file, text, existed: fs.existsSync(file) });
  for (const name of [null, ...listContexts().profile]) {
    const document = readLook(name);
    const where = name === null ? 'Default' : `profile ${name}`;
    validate(document.values, where);
    for (const [id, pair] of Object.entries(document.wallpapers)) validate(pair.values, `${where} / wallpaper ${id}`);
    let changed = false;
    for (const { id, source, values } of globals) {
      const existing = Object.hasOwn(document.wallpapers, id);
      if (existing && !isDeepStrictEqual(document.wallpapers[id], { source, values })) {
        throw new Error(`${where} / wallpaper ${id}: conflicting existing pair`);
      }
      if (!existing) { document.wallpapers = { ...document.wallpapers, [id]: { source, values } }; changed = true; }
      copies.push({ look: name, id, existing });
    }
    if (changed) addOutput(lookPath(name), lookText(document));
  }
  const original = readJson(activePath(), {});
  const record = structuredClone(original);
  if (record?.wallpaper) delete record.wallpaper.pinned;
  const runtime = validateRuntimeRecord(record);
  const oldScratch = fs.existsSync(scratchPath());
  if (oldScratch) {
    const values = yamlMap(scratchPath());
    if (Object.hasOwn(record, '_scratch') && !isDeepStrictEqual(runtime.scratch, values)) {
      throw new Error('conflicting scratch sources');
    }
    runtime.scratch = values;
  }
  validate(runtime.scratch, 'scratch');
  const nextRecord = { ...runtime.active, ...(Object.keys(runtime.scratch).length ? { _scratch: runtime.scratch } : {}) };
  validateRuntimeRecord(nextRecord);
  if (!isDeepStrictEqual(original, nextRecord)) addOutput(activePath(), JSON.stringify(nextRecord, null, 2) + '\n');
  const removals = globals.map(({ id }) => contextPath('wallpaper', id));
  if (oldScratch) removals.push(scratchPath());
  if (!outputs.length && !removals.length) return null;
  const originals = [...new Set([...outputs.filter((file) => file.existed).map((file) => file.path), ...removals])].map((file) => ({ path: file }));
  return { originals, outputs, removals, copies };
}

export function runPairMigration(defs, { print, now = new Date() }) {
  const plan = planPairMigration(defs);
  if (plan === null) { print('migrate pairs: nothing to migrate\n'); return 0; }
  const backup = writeBackup(plan.originals, now, { unique: true });
  const absent = plan.outputs.filter((file) => !file.existed).map((file) =>
    file.path === activePath() ? 'state/active.json' : path.join('config', path.relative(configDir(), file.path)));
  fs.writeFileSync(path.join(backup, 'originally-absent.txt'), absent.join('\n') + (absent.length ? '\n' : ''), { flag: 'wx' });
  print(`migrate pairs: backup ${backup}\n`);
  for (const output of plan.outputs) {
    fs.mkdirSync(path.dirname(output.path), { recursive: true });
    const tmp = `${output.path}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, output.text);
    fs.renameSync(tmp, output.path);
  }
  for (const file of plan.removals) fs.unlinkSync(file);
  for (const copy of plan.copies) print(`migrate pairs: ${copy.look === null ? 'Default' : `profile ${copy.look}`} / wallpaper ${copy.id}: ${copy.existing ? 'already matching' : 'copied'}\n`);
  if (plan.removals.includes(scratchPath())) print('migrate pairs: scratch moved to active.json\n');
  return plan.copies.length;
}
