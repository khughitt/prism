import { stringify } from 'yaml';
import { isDeepStrictEqual } from 'node:util';
import { withLock } from './lock.js';
import { lockPath } from './paths.js';
import {
  VERB_KINDS, assertKind, assertName, deleteContext, inspectContext, listContexts, readActive, readContext,
  renameContext, wallpaperId, canonicalWallpaperPath, writeActive, writeContext,
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

// The pin is a gesture about the wallpaper on screen. Loading a profile puts
// an explicit layer above it, so the gesture ends there.
function unpinned(active) {
  if (active.wallpaper === undefined) return active;
  const { pinned, ...wallpaper } = active.wallpaper;
  return { ...active, wallpaper: pinned === undefined ? wallpaper : { ...wallpaper, pinned: false } };
}

function kindAndName(rest, verb) {
  if (rest.length !== 2) throw usage(`${verb} <kind> <name>`);
  const [kind, name] = rest;
  assertKind(kind);
  assertName(name);
  return { kind, name };
}

// Apply a slot change. `mutate(active)` computes the next slots and may throw
// (e.g. activating a context that does not exist), but writes nothing itself;
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
export async function runContext(args, { defs, manifests, print, eprint, runner }) {
  const [sub, ...rest] = args;
  switch (sub) {
    case 'list': {
      if (rest.length !== 0) throw usage('list');
      const { active, all, inspected } = await withLock(lockPath(), async () => {
        const listed = listContexts();
        return {
          active: readActive(),
          all: listed,
          inspected: Object.fromEntries(VERB_KINDS.map((kind) => [kind,
            Object.fromEntries(listed[kind].map((name) => [name, inspectContext(kind, name)]))])),
        };
      });
      for (const kind of VERB_KINDS) {
        const current = activeName(active, kind);
        for (const name of all[kind]) {
          const entry = inspected[kind][name];
          if (entry === null) continue; // removed between the listing and the read
          if (entry.error !== null) {
            print(`! ${kind} ${name}  ${entry.error} — run 'prism doctor'\n`);
            continue;
          }
          const marker = name === current ? '*' : ' ';
          const source = kind === 'wallpaper' ? `  ${entry.context.source}` : '';
          const pinned = kind === 'wallpaper' && name === current && active.wallpaper.pinned === true ? ' (pinned)' : '';
          print(`${marker} ${kind} ${name}${source}${pinned}\n`);
        }
      }
      if (active.wallpaper && !all.wallpaper.includes(active.wallpaper.id)) {
        print(`* wallpaper ${active.wallpaper.id}  ${active.wallpaper.path} (untuned)\n`);
      }
      return null;
    }

    // Showing the file is what was asked for, so a file that does not parse is
    // printed as it is, with the reason on stderr.
    case 'show': {
      const { kind, name } = kindAndName(rest, 'show');
      const entry = await withLock(lockPath(), async () => inspectContext(kind, name));
      if (entry === null) throw new Error(`${kind} ${name}: no such context`);
      if (entry.error !== null) {
        print(entry.text);
        eprint(`prism: ${kind} ${name}: ${entry.error} — run 'prism doctor'\n`);
        return null;
      }
      const { context } = entry;
      const doc = kind === 'wallpaper' ? { _source: context.source, ...context.values } : context.values;
      print(stringify(doc));
      return null;
    }

    // A profile is a full snapshot; a wallpaper context holds only what was
    // tuned while pinned. The target is always topmost, so a save can never
    // absorb a layer above it.
    case 'save': {
      const { kind, name } = kindAndName(rest, 'save');
      if (kind !== 'profile') throw new Error('save is for profiles; a wallpaper context holds only pinned edits');
      await withLock(lockPath(), async () => {
        const { params } = loadStore(defs);
        writeContext(kind, name, { source: null, values: params });
      });
      return null;
    }

    case 'activate': {
      const { kind, name } = kindAndName(rest, 'activate');
      return changeSlots({ defs, manifests, runner }, (active) => {
        const context = requireContext(kind, name);
        return kind === 'wallpaper'
          ? { ...active, wallpaper: { id: name, path: context.source } }
          : { ...unpinned(active), profile: name };
      });
    }

    case 'pin':
    case 'unpin': {
      if (rest.length !== 1) throw usage(`${sub} <kind>`);
      const [kind] = rest;
      assertKind(kind);
      if (kind !== 'wallpaper') throw new Error(`pin applies to automatic kinds (wallpaper), not ${kind}`);
      await withLock(lockPath(), async () => {
        const active = readActive();
        if (active.wallpaper === undefined) throw new Error('no active wallpaper');
        if (sub === 'pin') {
          if (active.profile !== undefined) {
            throw new Error(`profile ${active.profile} is active; deactivate it to tune the wallpaper`);
          }
          writeActive({ ...active, wallpaper: { ...active.wallpaper, pinned: true } });
        } else {
          if (active.wallpaper.pinned !== true) throw new Error('wallpaper is not pinned');
          writeActive(unpinned(active));
        }
      });
      return null;
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

    // A profile keeps its identity under a new name: the file moves and, when
    // it is the loaded one, the slot follows. Nothing effective changes, so
    // resolved.json and the sinks are never touched. A wallpaper's name is a
    // hash of its path, so it has nothing to rename.
    case 'rename': {
      if (rest.length !== 3) throw usage('rename <kind> <old> <new>');
      const [kind, from, to] = rest;
      assertKind(kind);
      assertName(from);
      assertName(to);
      if (kind !== 'profile') throw new Error('rename is for profiles; a wallpaper is named by its path');
      await withLock(lockPath(), async () => {
        const active = readActive();
        renameContext(kind, from, to);
        if (active.profile === from) writeActive({ ...active, profile: to });
      });
      return null;
    }

    // The hook's entry point. The same wallpaper again (a second connector, a
    // re-set) changes nothing, pin included; a different one is a new
    // activation and arrives unpinned.
    case 'wallpaper': {
      if (rest.length !== 1) throw usage('wallpaper <path>');
      const wallpaper = canonicalWallpaperPath(rest[0]);
      const id = wallpaperId(wallpaper);
      return changeSlots({ defs, manifests, runner }, (active) => (
        active.wallpaper?.id === id ? active : { ...active, wallpaper: { id, path: wallpaper } }));
    }

    default:
      throw usage('list|show|save|rename|activate|deactivate|delete|pin|unpin|wallpaper');
  }
}
