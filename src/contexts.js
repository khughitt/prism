import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parse, stringify } from 'yaml';
import { activePath, contextsDir, valuesPath } from './paths.js';
import { readJson, writeJsonAtomic } from './store.js';

// Resolution order of the context kinds, lowest first. Base sits below all of
// them and scratch above; the look is base then profile, and the deltas ride
// on top of the look (2026-09-19 compositional profiles design, Section 1).
export const LAYER_ORDER = ['profile', 'wallpaper', 'state'];
// The kinds that are sparse, hook-activated deltas over the look.
export const DELTA_KINDS = ['wallpaper', 'state'];
// Kinds a verb may name. `state` is reserved until its activation sources are designed.
export const VERB_KINDS = ['profile', 'wallpaper'];

const NAME_RE = /^[A-Za-z0-9._-]+$/;

export function assertKind(kind) {
  if (kind === 'state') throw new Error('kind state is reserved');
  if (!VERB_KINDS.includes(kind)) throw new Error(`unknown kind ${kind}`);
}

export function assertName(name) {
  if (typeof name !== 'string' || !NAME_RE.test(name)) {
    throw new Error(`invalid context name ${JSON.stringify(name)}`);
  }
}

export function wallpaperId(wallpaper) {
  if (typeof wallpaper !== 'string' || wallpaper.trim() === '') {
    throw new Error('wallpaper path must not be empty');
  }
  return createHash('sha256').update(wallpaper).digest('hex').slice(0, 8);
}

// The id hashes the canonical path, so the same image reached through a
// symlinked directory (a home-relative and a mount-absolute spelling, say)
// is one wallpaper. A path that does not exist is an error, not a context.
export function canonicalWallpaperPath(wallpaper) {
  if (typeof wallpaper !== 'string' || wallpaper.trim() === '') {
    throw new Error('wallpaper path must not be empty');
  }
  try {
    return fs.realpathSync(wallpaper);
  } catch (err) {
    if (err.code === 'ENOENT') throw new Error(`wallpaper path does not exist: ${wallpaper}`);
    throw err;
  }
}

export function contextPath(kind, name) {
  return path.join(contextsDir(), kind, `${name}.yaml`);
}

export function readActive({ warn = (text) => process.stderr.write(text) } = {}) {
  const active = readJson(activePath(), {});
  if (typeof active !== 'object' || active === null || Array.isArray(active)) {
    throw new Error('active.json must be an object');
  }
  for (const kind of Object.keys(active)) {
    try {
      assertKind(kind);
    } catch (err) {
      throw new Error(`${activePath()}: ${err.message}`);
    }
  }
  if (active.wallpaper !== undefined) {
    const entry = active.wallpaper;
    if (typeof entry !== 'object' || entry === null
        || typeof entry.id !== 'string' || typeof entry.path !== 'string') {
      throw new Error('active wallpaper must carry id and path');
    }
    assertName(entry.id);
    for (const field of Object.keys(entry)) {
      if (!['id', 'path', 'pinned'].includes(field)) {
        throw new Error(`active wallpaper carries unknown field ${field}`);
      }
    }
  }
  if (active.profile !== undefined) assertName(active.profile);
  if (active.wallpaper !== undefined && Object.hasOwn(active.wallpaper, 'pinned')) {
    active.wallpaper = { id: active.wallpaper.id, path: active.wallpaper.path };
    writeActive(active);
    warn('prism: dropped the retired pinned field from active.json\n');
  }
  return active;
}

export function writeActive(active) {
  writeJsonAtomic(activePath(), active);
}

const isMapping = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

function validateValues(values, location) {
  if (!isMapping(values)) throw new Error(`${location} must be a mapping`);
  for (const key of Object.keys(values)) {
    if (key.startsWith('_')) throw new Error(`${location}: unknown metadata ${key}`);
  }
}

export function lookPath(look) {
  if (look === null) return valuesPath();
  assertName(look);
  return contextPath('profile', look);
}

function validateWallpapers(wallpapers, location) {
  if (!isMapping(wallpapers)) throw new Error(`${location} _wallpapers must be a mapping`);
  for (const [id, pair] of Object.entries(wallpapers)) {
    assertName(id);
    if (!isMapping(pair)) throw new Error(`${location} wallpaper ${id} must be a mapping`);
    if (typeof pair._source !== 'string') throw new Error(`${location} wallpaper ${id}: missing _source`);
    const { _source, ...values } = pair;
    validateValues(values, `${location} wallpaper ${id}`);
  }
}

export function readLook(look) {
  const file = lookPath(look);
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return look === null ? { values: {}, wallpapers: {} } : null;
    throw err;
  }
  let doc;
  try {
    doc = parse(text) ?? {};
  } catch (err) {
    throw new Error(`${file}: invalid YAML: ${err.message.split('\n')[0]}`);
  }
  if (!isMapping(doc)) throw new Error(`${file}: look must be a mapping`);
  const { _wallpapers, ...values } = doc;
  validateValues(values, file);
  const pairs = Object.hasOwn(doc, '_wallpapers') ? _wallpapers : {};
  validateWallpapers(pairs, file);
  const wallpapers = Object.fromEntries(Object.entries(pairs).map(([id, pair]) => {
    const { _source, ...pairValues } = pair;
    return [id, { source: _source, values: pairValues }];
  }));
  return { values, wallpapers };
}

export function writeLook(look, document) {
  const file = lookPath(look);
  if (!isMapping(document) || Object.keys(document).some((key) => !['values', 'wallpapers'].includes(key))) {
    throw new Error('look document must contain only values and wallpapers');
  }
  validateValues(document.values, file);
  if (!isMapping(document.wallpapers)) throw new Error(`${file} _wallpapers must be a mapping`);
  const pairs = Object.fromEntries(Object.entries(document.wallpapers).map(([id, pair]) => {
    assertName(id);
    if (!isMapping(pair)) throw new Error(`${file} wallpaper ${id} must be a mapping`);
    if (typeof pair.source !== 'string') throw new Error(`${file} wallpaper ${id}: missing source`);
    if (Object.keys(pair).some((key) => !['source', 'values'].includes(key))) {
      throw new Error(`${file} wallpaper ${id}: unknown field`);
    }
    validateValues(pair.values, `${file} wallpaper ${id}`);
    return [id, { _source: pair.source, ...pair.values }];
  }));
  const doc = { ...document.values, ...(Object.keys(pairs).length ? { _wallpapers: pairs } : {}) };
  const yaml = stringify(doc);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, yaml);
  fs.renameSync(tmp, file);
}

export function readPair(look, id) {
  assertName(id);
  const document = readLook(look);
  if (document === null) throw new Error(`profile ${look}: no such look`);
  return Object.hasOwn(document.wallpapers, id) ? document.wallpapers[id] : null;
}

export function listPairs() {
  const out = [];
  for (const look of [null, ...listContexts().profile]) {
    const document = readLook(look);
    for (const [id, pair] of Object.entries(document.wallpapers)) {
      out.push({ look, id, source: pair.source, values: pair.values });
    }
  }
  return out;
}

function validateRuntimeRecord(record) {
  if (!isMapping(record)) throw new Error('active.json must be an object');
  for (const field of Object.keys(record)) {
    if (!['profile', 'wallpaper', '_scratch'].includes(field)) throw new Error(`unknown active field ${field}`);
  }
  if (record.profile !== undefined) assertName(record.profile);
  if (record.wallpaper !== undefined) {
    const entry = record.wallpaper;
    if (!isMapping(entry) || typeof entry.id !== 'string' || typeof entry.path !== 'string') {
      throw new Error('active wallpaper must carry id and path');
    }
    assertName(entry.id);
    for (const field of Object.keys(entry)) {
      if (!['id', 'path'].includes(field)) throw new Error(`active wallpaper carries unknown field ${field}`);
    }
  }
  const scratch = Object.hasOwn(record, '_scratch') ? record._scratch : {};
  validateValues(scratch, '_scratch');
  const active = { ...(record.profile === undefined ? {} : { profile: record.profile }),
    ...(record.wallpaper === undefined ? {} : { wallpaper: record.wallpaper }) };
  return { active, scratch };
}

export function readRuntime() {
  return validateRuntimeRecord(readJson(activePath(), {}));
}

export function writeRuntime(state) {
  if (!isMapping(state) || Object.keys(state).some((key) => !['active', 'scratch'].includes(key))) {
    throw new Error('runtime must contain only active and scratch');
  }
  const { active, scratch } = state;
  if (!isMapping(active)) throw new Error('active must be an object');
  for (const field of Object.keys(active)) {
    if (!['profile', 'wallpaper'].includes(field)) throw new Error(`unknown active field ${field}`);
  }
  validateValues(scratch, '_scratch');
  const record = { ...active, ...(Object.keys(scratch).length ? { _scratch: scratch } : {}) };
  validateRuntimeRecord(record);
  writeJsonAtomic(activePath(), record);
}

// A context file that does not parse. `reason` is the message without the
// "<kind> <name>: " prefix, for verbs that print it beside the name.
class ContextError extends Error {
  constructor(kind, name, reason) {
    super(`${kind} ${name}: ${reason}`);
    this.reason = reason;
  }
}

function parseContext(kind, name, text) {
  let doc;
  try {
    doc = parse(text) ?? {};
  } catch (err) {
    throw new ContextError(kind, name, `invalid YAML: ${err.message.split('\n')[0]}`);
  }
  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
    throw new ContextError(kind, name, 'context must be a flat object');
  }
  const { _source: source, ...values } = doc;
  if (kind !== 'wallpaper' && source !== undefined) {
    throw new ContextError(kind, name, '_source is only allowed in wallpaper contexts');
  }
  if (kind === 'wallpaper' && typeof source !== 'string') {
    throw new ContextError(kind, name, 'missing _source');
  }
  return { source: source ?? null, values };
}

// The raw file, or null when it is missing. Never parses.
export function readContextText(kind, name) {
  try {
    return fs.readFileSync(contextPath(kind, name), 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

// null when the file is missing; a malformed file is an error.
export function readContext(kind, name) {
  const text = readContextText(kind, name);
  return text === null ? null : parseContext(kind, name, text);
}

// For discovery verbs, which degrade where diagnosis verbs fail: a file that
// does not parse comes back with its raw text and the reason instead of a
// throw, so one broken context cannot hide the others. null when missing.
export function inspectContext(kind, name) {
  const text = readContextText(kind, name);
  if (text === null) return null;
  try {
    return { context: parseContext(kind, name, text), text, error: null };
  } catch (err) {
    if (!(err instanceof ContextError)) throw err;
    return { context: null, text, error: err.reason };
  }
}

export function writeContext(kind, name, { source, values }) {
  const file = contextPath(kind, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const doc = kind === 'wallpaper' ? { _source: source, ...values } : values;
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, stringify(doc));
  fs.renameSync(tmp, file);
}

export function deleteContext(kind, name) {
  try {
    fs.unlinkSync(contextPath(kind, name));
  } catch (err) {
    if (err.code === 'ENOENT') throw new Error(`${kind} ${name}: no such context`);
    throw err;
  }
}

// A file move only. The caller holds the store lock and has decided what the
// slots do; renaming never changes an effective value.
export function renameContext(kind, from, to) {
  if (readContextText(kind, from) === null) throw new Error(`${kind} ${from}: no such context`);
  if (readContextText(kind, to) !== null) throw new Error(`${kind} ${to} already exists`);
  fs.renameSync(contextPath(kind, from), contextPath(kind, to));
}

export function listContexts() {
  const out = {};
  for (const kind of VERB_KINDS) {
    let files = [];
    try {
      files = fs.readdirSync(path.join(contextsDir(), kind));
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    out[kind] = files.filter((f) => f.endsWith('.yaml')).map((f) => f.slice(0, -5)).sort();
  }
  return out;
}
