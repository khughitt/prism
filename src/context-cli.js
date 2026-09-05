import { stringify } from 'yaml';
import { isDeepStrictEqual } from 'node:util';
import { withLock } from './lock.js';
import { lockPath } from './paths.js';
import {
  VERB_KINDS, assertKind, assertName, deleteContext, listContexts, readActive, readContext,
  wallpaperId, writeActive, writeContext,
} from './contexts.js';
import { activeName, loadLayers, loadStore } from './layers.js';
import { readValues } from './values.js';
import { resolveLayered, writeResolved } from './resolve.js';
import { fanOut } from './fanout.js';

function usage(text) {
  return new Error(`usage: prism context ${text}`);
}

function requireContext(kind, name) {
  const context = readContext(kind, name);
  if (context === null) throw new Error(`${kind} ${name}: no such context`);
  return context;
}

function kindAndName(rest, verb) {
  if (rest.length !== 2) throw usage(`${verb} <kind> <name>`);
  const [kind, name] = rest;
  assertKind(kind);
  assertName(name);
  return { kind, name };
}

// Apply a slot change. `mutate(active)` is pure and returns the next slots;
// `commit()` performs any file change (a delete) and runs only after the
// resulting state has resolved, so a refused change leaves every file and
// slot as it was. The resulting state is always validated, even when the
// slots do not change, so re-activating a broken context fails loudly. The
// previous state is allowed not to resolve, in which case every bound key
// fans out (the apply contract): that is how a broken active context is
// recovered from.
async function changeSlots({ defs, manifests, runner }, mutate, commit = () => {}) {
  let outcome = null;
  await withLock(lockPath(), async () => {
    const active = readActive();
    let previous = null;
    try {
      previous = loadStore(defs).params;
    } catch {
      previous = null;
    }
    const next = mutate(active);
    const { params } = resolveLayered(defs, readValues(), loadLayers(next));
    commit();
    if (isDeepStrictEqual(next, active)) return;
    writeActive(next);
    const resolved = writeResolved(params);
    const changedKeys = previous === null
      ? [...new Set(manifests.flatMap((manifest) => manifest.binds.map((bind) => bind.param)))]
      : Object.keys(params).filter((key) => !isDeepStrictEqual(params[key], previous[key]));
    outcome = { resolved, changedKeys };
  });
  if (outcome === null || outcome.changedKeys.length === 0) return null;
  return fanOut({ manifests, resolved: outcome.resolved, changedKeys: outcome.changedKeys, runner });
}

// Returns a fan-out result, or null when nothing reached the bus.
export async function runContext(args, { defs, manifests, print, runner }) {
  const [sub, ...rest] = args;
  switch (sub) {
    case 'list': {
      if (rest.length !== 0) throw usage('list');
      const { active, all, sources } = await withLock(lockPath(), async () => {
        const listed = listContexts();
        return {
          active: readActive(),
          all: listed,
          sources: Object.fromEntries(listed.wallpaper.map((name) => [name, readContext('wallpaper', name).source])),
        };
      });
      for (const kind of VERB_KINDS) {
        const current = activeName(active, kind);
        for (const name of all[kind]) {
          const marker = name === current ? '*' : ' ';
          const source = kind === 'wallpaper' ? `  ${sources[name]}` : '';
          print(`${marker} ${kind} ${name}${source}\n`);
        }
      }
      if (active.wallpaper && !all.wallpaper.includes(active.wallpaper.id)) {
        print(`* wallpaper ${active.wallpaper.id}  ${active.wallpaper.path} (untuned)\n`);
      }
      return null;
    }

    case 'show': {
      const { kind, name } = kindAndName(rest, 'show');
      const context = await withLock(lockPath(), async () => requireContext(kind, name));
      const doc = kind === 'wallpaper' ? { _source: context.source, ...context.values } : context.values;
      print(stringify(doc));
      return null;
    }

    case 'save': {
      const { kind, name } = kindAndName(rest, 'save');
      await withLock(lockPath(), async () => {
        const source = kind === 'wallpaper' ? requireContext(kind, name).source : null;
        const { params } = loadStore(defs);
        writeContext(kind, name, { source, values: params });
      });
      return null;
    }

    case 'activate': {
      const { kind, name } = kindAndName(rest, 'activate');
      return changeSlots({ defs, manifests, runner }, (active) => {
        const context = requireContext(kind, name);
        return kind === 'wallpaper'
          ? { ...active, wallpaper: { id: name, path: context.source } }
          : { ...active, profile: name };
      });
    }

    case 'deactivate': {
      if (rest.length !== 1) throw usage('deactivate <kind>');
      const [kind] = rest;
      assertKind(kind);
      return changeSlots({ defs, manifests, runner }, (active) => {
        const next = { ...active };
        delete next[kind];
        return next;
      });
    }

    case 'delete': {
      const { kind, name } = kindAndName(rest, 'delete');
      return changeSlots({ defs, manifests, runner }, (active) => {
        const next = { ...active };
        if (activeName(active, kind) === name) delete next[kind];
        return next;
      }, () => deleteContext(kind, name));
    }

    case 'wallpaper': {
      if (rest.length !== 1) throw usage('wallpaper <path>');
      const [wallpaper] = rest;
      const id = wallpaperId(wallpaper);
      return changeSlots({ defs, manifests, runner }, (active) => ({ ...active, wallpaper: { id, path: wallpaper } }));
    }

    default:
      throw usage('list|show|save|activate|deactivate|delete|wallpaper');
  }
}
