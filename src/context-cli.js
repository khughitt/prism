import { stringify } from 'yaml';
import { isDeepStrictEqual } from 'node:util';
import { withLock } from './lock.js';
import { lockPath } from './paths.js';
import {
  VERB_KINDS, assertKind, assertName, deleteContext, inspectContext, listContexts, readActive, readContext,
  renameContext, wallpaperId, canonicalWallpaperPath, writeActive, writeContext,
} from './contexts.js';
import { activeJson, activeName, loadLayers, loadStore } from './layers.js';
import { readValues } from './values.js';
import { resolveLayered, writeResolved } from './resolve.js';
import { fanOut } from './fanout.js';

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

// Arity and the kind's value set are validated against the declared table (commands.js)
// before a verb runs; assertKind stays as the store's own invariant, assertName as the
// file-name rule the table does not express.
function kindAndName([kind, name]) {
  assertKind(kind);
  assertName(name);
  return { kind, name };
}

// Apply a slot change and return { changedKeys, result }, `result` being the fan-out
// outcome or null when nothing reached the bus. `mutate(active)` computes the next slots and may throw
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
  if (outcome === null || outcome.changedKeys.length === 0) return { changedKeys: [], result: null };
  return { changedKeys: outcome.changedKeys, result: await fanOut({ manifests, resolved: outcome.resolved, changedKeys: outcome.changedKeys, runner }) };
}

// A verb that changes the slots returns changeSlots' { changedKeys, result } for cli.js to
// report; every other verb emits its own value (one JSON object, or the text) and returns
// null.
export async function runContext(sub, rest, { defs, manifests, emit, eprint, json, runner }) {
  switch (sub) {
    case 'list': {
      const { active, all, inspected } = await withLock(lockPath(), async () => {
        const listed = listContexts();
        return {
          active: readActive(),
          all: listed,
          inspected: Object.fromEntries(VERB_KINDS.map((kind) => [kind,
            Object.fromEntries(listed[kind].map((name) => [name, inspectContext(kind, name)]))])),
        };
      });
      const contexts = [];
      for (const kind of VERB_KINDS) {
        const current = activeName(active, kind);
        for (const name of all[kind]) {
          const entry = inspected[kind][name];
          if (entry === null) continue; // removed between the listing and the read
          const isActive = name === current;
          const pinned = kind === 'wallpaper' && isActive && active.wallpaper.pinned === true;
          contexts.push({
            kind, name, active: isActive, untuned: false,
            source: entry.error === null && kind === 'wallpaper' ? entry.context.source : null,
            pinned, error: entry.error,
          });
        }
      }
      if (active.wallpaper && !all.wallpaper.includes(active.wallpaper.id)) {
        contexts.push({
          kind: 'wallpaper', name: active.wallpaper.id, active: true, untuned: true,
          source: active.wallpaper.path, pinned: false, error: null,
        });
      }
      emit({ active: activeJson(active), contexts }, contexts.map((entry) => {
        if (entry.error !== null) return `! ${entry.kind} ${entry.name}  ${entry.error} — run 'prism doctor'\n`;
        const source = entry.kind === 'wallpaper' ? `  ${entry.source}` : '';
        const note = entry.untuned ? ' (untuned)' : entry.pinned ? ' (pinned)' : '';
        return `${entry.active ? '*' : ' '} ${entry.kind} ${entry.name}${source}${note}\n`;
      }).join(''));
      return null;
    }

    // Showing the file is what was asked for, so a file that does not parse is
    // printed as it is, with the reason on stderr.
    case 'show': {
      const { kind, name } = kindAndName(rest);
      const entry = await withLock(lockPath(), async () => inspectContext(kind, name));
      if (entry === null) throw new Error(`${kind} ${name}: no such context`);
      if (entry.error !== null) {
        const detail = `${kind} ${name}: ${entry.error} — run 'prism doctor'`;
        emit({ kind, name, text: entry.text, warnings: [{ kind: 'prism', detail }] }, entry.text);
        if (!json) eprint(`prism: ${detail}\n`);
        return null;
      }
      const { context } = entry;
      const doc = kind === 'wallpaper' ? { _source: context.source, ...context.values } : context.values;
      emit({ kind, name, source: context.source, values: context.values }, stringify(doc));
      return null;
    }

    // A profile is a full snapshot; a wallpaper context holds only what was
    // tuned while pinned. The target is always topmost, so a save can never
    // absorb a layer above it.
    case 'save': {
      const { kind, name } = kindAndName(rest);
      if (kind !== 'profile') throw new Error('save is for profiles; a wallpaper context holds only pinned edits');
      await withLock(lockPath(), async () => {
        const { params } = loadStore(defs);
        writeContext(kind, name, { source: null, values: params });
      });
      emit({ kind, name }, '');
      return null;
    }

    case 'activate': {
      const { kind, name } = kindAndName(rest);
      return changeSlots({ defs, manifests, runner }, (active) => {
        const context = requireContext(kind, name);
        return kind === 'wallpaper'
          ? { ...active, wallpaper: { id: name, path: context.source } }
          : { ...unpinned(active), profile: name };
      });
    }

    case 'pin':
    case 'unpin': {
      const [kind] = rest;
      assertKind(kind);
      if (kind !== 'wallpaper') throw new Error(`pin applies to automatic kinds (wallpaper), not ${kind}`);
      const id = await withLock(lockPath(), async () => {
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
        return active.wallpaper.id;
      });
      emit({ kind, name: id, pinned: sub === 'pin' }, '');
      return null;
    }

    case 'deactivate': {
      const [kind] = rest;
      assertKind(kind);
      return changeSlots({ defs, manifests, runner }, (active) => {
        const next = { ...active };
        delete next[kind];
        return next;
      });
    }

    case 'delete': {
      const { kind, name } = kindAndName(rest);
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
      emit({ kind, from, to }, '');
      return null;
    }

    // The hook's entry point. The same wallpaper again (a second connector, a
    // re-set) changes nothing, pin included; a different one is a new
    // activation and arrives unpinned.
    case 'wallpaper': {
      const wallpaper = canonicalWallpaperPath(rest[0]);
      const id = wallpaperId(wallpaper);
      return changeSlots({ defs, manifests, runner }, (active) => (
        active.wallpaper?.id === id ? active : { ...active, wallpaper: { id, path: wallpaper } }));
    }

    default:
      throw new Error(`prism context ${sub} is declared but not implemented`);
  }
}
