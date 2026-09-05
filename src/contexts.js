import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parse, stringify } from 'yaml';
import { activePath, contextsDir } from './paths.js';
import { readJson, writeJsonAtomic } from './store.js';

// Resolution order of the context kinds, lowest first. Base sits below all of them.
export const LAYER_ORDER = ['wallpaper', 'state', 'profile'];
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

export function contextPath(kind, name) {
  return path.join(contextsDir(), kind, `${name}.yaml`);
}

export function readActive() {
  const active = readJson(activePath(), {});
  if (typeof active !== 'object' || active === null || Array.isArray(active)) {
    throw new Error('active.json must be an object');
  }
  for (const kind of Object.keys(active)) assertKind(kind);
  if (active.wallpaper !== undefined) {
    const entry = active.wallpaper;
    if (typeof entry !== 'object' || entry === null
        || typeof entry.id !== 'string' || typeof entry.path !== 'string') {
      throw new Error('active wallpaper must carry id and path');
    }
    assertName(entry.id);
  }
  if (active.profile !== undefined) assertName(active.profile);
  return active;
}

export function writeActive(active) {
  writeJsonAtomic(activePath(), active);
}

// null when the file is missing; a malformed file is an error.
export function readContext(kind, name) {
  let text;
  try {
    text = fs.readFileSync(contextPath(kind, name), 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
  const doc = parse(text) ?? {};
  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
    throw new Error(`${kind} ${name}: context must be a flat object`);
  }
  const { _source: source, ...values } = doc;
  if (kind !== 'wallpaper' && source !== undefined) {
    throw new Error(`${kind} ${name}: _source is only allowed in wallpaper contexts`);
  }
  if (kind === 'wallpaper' && typeof source !== 'string') {
    throw new Error(`wallpaper ${name}: missing _source`);
  }
  return { source: source ?? null, values };
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
